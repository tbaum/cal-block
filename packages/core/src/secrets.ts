import { AsyncEntry } from "@napi-rs/keyring";
import { APP_ID } from "./paths.ts";

export interface SecretStore {
  get(account: string): Promise<string | undefined>;
  set(account: string, value: string): Promise<void>;
  remove(account: string): Promise<void>;
}

export const secretAccounts = {
  googleRefreshToken: "google-refresh-token",
  googleClientSecret: "google-client-secret",
  source: (sourceId: string) => `source:${sourceId}`,
} as const;

export function keychainSecretStore(service: string = APP_ID): SecretStore {
  const entry = (account: string) => new AsyncEntry(service, account);
  return {
    get: async (account) => (await entry(account).getPassword()) ?? undefined,
    set: (account, value) => entry(account).setPassword(value),
    remove: async (account) => {
      await entry(account).deletePassword();
    },
  };
}

export function inMemorySecretStore(initial: Record<string, string> = {}): SecretStore {
  const secrets = new Map(Object.entries(initial));
  return {
    get: async (account) => secrets.get(account),
    set: async (account, value) => {
      secrets.set(account, value);
    },
    remove: async (account) => {
      secrets.delete(account);
    },
  };
}
