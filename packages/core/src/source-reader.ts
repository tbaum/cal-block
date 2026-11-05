import type { TimeRange } from "./dates.ts";
import { connectIcloud, fetchIcloudCalendarTexts, type CalDavClient } from "./icloud.ts";
import { fetchIcs } from "./ics-fetch.ts";
import { secretAccounts, type SecretStore } from "./secrets.ts";
import type { Source } from "./sources.ts";

export type SourceTextReader = (source: Source, secrets: SecretStore, range: TimeRange) => Promise<string[]>;

export interface SourceReaderDeps {
  readonly downloadIcs: (url: string) => Promise<string>;
  readonly connectCalDav: (appleId: string, appPassword: string) => Promise<CalDavClient>;
}

const DEFAULT_SOURCE_READER_DEPS: SourceReaderDeps = { downloadIcs: (url) => fetchIcs(url), connectCalDav: connectIcloud };

export function sourceTextReader(deps: SourceReaderDeps = DEFAULT_SOURCE_READER_DEPS): SourceTextReader {
  return async (source, secrets, range) => {
    const secret = await requiredSecret(secrets, source);
    if (source.kind === "ics") return [await deps.downloadIcs(secret)];
    return fetchIcloudCalendarTexts(await deps.connectCalDav(source.appleId, secret), source.calendarUrls, range);
  };
}

async function requiredSecret(secrets: SecretStore, source: Source): Promise<string> {
  const secret = await secrets.get(secretAccounts.source(source.id));
  if (!secret) throw new Error(`${source.kind === "ics" ? "ICS URL" : "app-specific password"} missing in Keychain`);
  return secret;
}
