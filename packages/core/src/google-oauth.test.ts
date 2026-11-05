import { describe, expect, it } from "vitest";
import { authorizeWithLoopback, GOOGLE_SCOPES, type TokenExchange } from "./google-oauth.ts";

const credentials = { clientId: "client-id.apps.googleusercontent.com", clientSecret: "client-secret" };

function browserThatAnswers(answer: (consent: URL) => Record<string, string>) {
  const opened: URL[] = [];
  const responses: Promise<Response>[] = [];
  const openBrowser = (url: string) => {
    const consent = new URL(url);
    opened.push(consent);
    const redirect = new URL(consent.searchParams.get("redirect_uri") ?? "");
    for (const [key, value] of Object.entries(answer(consent))) redirect.searchParams.set(key, value);
    responses.push(fetch(redirect));
  };
  return { openBrowser, opened, responses };
}

describe("authorizeWithLoopback", () => {
  it("exchanges the code from the loopback redirect for a refresh token", async () => {
    const browser = browserThatAnswers((consent) => ({ code: "auth-code", state: consent.searchParams.get("state") ?? "" }));
    const exchanged: Parameters<TokenExchange>[1][] = [];
    const refreshToken = await authorizeWithLoopback(credentials, {
      openBrowser: browser.openBrowser,
      exchangeCode: async (_client, request) => {
        exchanged.push(request);
        return "refresh-token";
      },
    });

    expect(refreshToken).toBe("refresh-token");
    const consent = browser.opened[0];
    expect(consent?.searchParams.get("scope")).toBe(GOOGLE_SCOPES.join(" "));
    expect(consent?.searchParams.get("access_type")).toBe("offline");
    expect(consent?.searchParams.get("code_challenge_method")).toBe("S256");
    expect(consent?.searchParams.get("redirect_uri")).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(exchanged[0]).toMatchObject({ code: "auth-code", redirectUri: consent?.searchParams.get("redirect_uri") });
    expect(exchanged[0]?.codeVerifier).toMatch(/.{43,}/);
    expect((await browser.responses[0])?.status).toBe(200);
  });

  it("rejects a redirect with a foreign state", async () => {
    const browser = browserThatAnswers(() => ({ code: "auth-code", state: "forged" }));
    await expect(authorizeWithLoopback(credentials, { openBrowser: browser.openBrowser, exchangeCode: async () => "x" })).rejects.toThrow(
      /unexpected state/,
    );
  });

  it("rejects a denied consent", async () => {
    const browser = browserThatAnswers((consent) => ({ error: "access_denied", state: consent.searchParams.get("state") ?? "" }));
    await expect(authorizeWithLoopback(credentials, { openBrowser: browser.openBrowser, exchangeCode: async () => "x" })).rejects.toThrow(
      /access_denied/,
    );
  });

  it("fails when Google returns no refresh token", async () => {
    const browser = browserThatAnswers((consent) => ({ code: "c", state: consent.searchParams.get("state") ?? "" }));
    await expect(authorizeWithLoopback(credentials, { openBrowser: browser.openBrowser, exchangeCode: async () => null })).rejects.toThrow(
      /no refresh token/,
    );
  });

  it("times out when the browser never comes back", async () => {
    await expect(authorizeWithLoopback(credentials, { openBrowser: () => {}, timeoutMs: 50, exchangeCode: async () => "x" })).rejects.toThrow(
      /timed out/,
    );
  });
});
