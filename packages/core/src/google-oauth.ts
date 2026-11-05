import { randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { CodeChallengeMethod, OAuth2Client } from "google-auth-library";

export const GOOGLE_SCOPES = ["https://www.googleapis.com/auth/calendar.app.created"];
export const LOOPBACK_TIMEOUT_MS = 5 * 60_000;

export interface GoogleClientCredentials {
  readonly clientId: string;
  readonly clientSecret: string;
}

export interface TokenExchange {
  (client: OAuth2Client, request: { code: string; codeVerifier: string; redirectUri: string }): Promise<string | null | undefined>;
}

export interface LoopbackOptions {
  readonly openBrowser: (url: string) => void | Promise<void>;
  readonly timeoutMs?: number;
  readonly exchangeCode?: TokenExchange;
}

const SUCCESS_PAGE = "<!doctype html><meta charset=utf-8><title>cal-block</title><p>cal-block ist mit Google verbunden. Dieses Fenster kann geschlossen werden.</p>";

export async function authorizeWithLoopback(credentials: GoogleClientCredentials, options: LoopbackOptions): Promise<string> {
  const server = await listenOnLoopback();
  try {
    const redirectUri = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const client = new OAuth2Client({ ...credentials, redirectUri });
    const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync();
    const state = randomBytes(16).toString("hex");
    const code = waitForAuthorizationCode(server, redirectUri, state, options.timeoutMs ?? LOOPBACK_TIMEOUT_MS);
    await options.openBrowser(consentUrl(client, state, codeChallenge ?? ""));
    const refreshToken = await (options.exchangeCode ?? exchangeWithGoogle)(client, { code: await code, codeVerifier, redirectUri });
    if (!refreshToken) throw new Error("Google returned no refresh token");
    return refreshToken;
  } finally {
    server.close();
  }
}

export function authorizedClient(credentials: GoogleClientCredentials, refreshToken: string): OAuth2Client {
  const client = new OAuth2Client(credentials);
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

function consentUrl(client: OAuth2Client, state: string, codeChallenge: string): string {
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: CodeChallengeMethod.S256,
  });
}

const exchangeWithGoogle: TokenExchange = async (client, { code, codeVerifier, redirectUri }) =>
  (await client.getToken({ code, codeVerifier, redirect_uri: redirectUri })).tokens.refresh_token;

function listenOnLoopback(): Promise<Server> {
  const server = createServer();
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function waitForAuthorizationCode(server: Server, redirectUri: string, state: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Google sign-in timed out")), timeoutMs);
    const settle = (outcome: () => void) => {
      clearTimeout(timer);
      outcome();
    };
    server.on("request", (request: IncomingMessage, response: ServerResponse) => {
      const url = new URL(request.url ?? "/", redirectUri);
      if (url.pathname !== "/") return respond(response, 404, "not found");
      const params = url.searchParams;
      if (params.get("state") !== state) {
        respond(response, 400, "state mismatch");
        return settle(() => reject(new Error("Google sign-in returned an unexpected state")));
      }
      const error = params.get("error");
      const code = params.get("code");
      if (error || !code) {
        respond(response, 400, "sign-in failed");
        return settle(() => reject(new Error(`Google sign-in failed: ${error ?? "no code"}`)));
      }
      respond(response, 200, SUCCESS_PAGE, "text/html; charset=utf-8");
      settle(() => resolve(code));
    });
  });
}

function respond(response: ServerResponse, status: number, body: string, contentType = "text/plain; charset=utf-8"): void {
  response.writeHead(status, { "content-type": contentType, connection: "close" });
  response.end(body);
}
