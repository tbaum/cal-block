import type { SecretStore } from "./secrets.ts";

export const REDACTED = "[redacted]";

export interface RecordingSecretStore extends SecretStore {
  readonly revealed: ReadonlySet<string>;
}

export function recordingSecretStore(inner: SecretStore): RecordingSecretStore {
  const revealed = new Set<string>();
  return {
    revealed,
    get: async (account) => {
      const value = await inner.get(account);
      if (value) revealed.add(value);
      return value;
    },
    set: (account, value) => inner.set(account, value),
    remove: (account) => inner.remove(account),
  };
}

export function redact(text: string, secrets: Iterable<string>): string {
  let result = text;
  for (const secret of [...secrets].sort((a, b) => b.length - a.length)) {
    if (secret.length >= 4) result = result.replaceAll(secret, REDACTED);
  }
  return result;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
