import { loadConfig, type Config } from "./config.ts";
import { todayLocal } from "./dates.ts";
import { googleApis, googleBlockerCalendar, type BlockerCalendar } from "./google.ts";
import { authorizedClient } from "./google-oauth.ts";
import { withLock } from "./lock.ts";
import type { AppPaths } from "./paths.ts";
import { recordingSecretStore, redact } from "./redact.ts";
import { secretAccounts, type SecretStore } from "./secrets.ts";
import { sourceTextReader, type SourceTextReader } from "./source-reader.ts";
import { appendLog, logLines, writeStatus } from "./status.ts";
import { failedResult, runSync, type SyncResult } from "./sync-run.ts";

export type CalendarOpener = (config: Config, secrets: SecretStore) => Promise<BlockerCalendar>;

export interface SyncOnceOptions {
  readonly paths: AppPaths;
  readonly secrets: SecretStore;
  readonly dryRun: boolean;
  readonly now?: () => Date;
  readonly openCalendar?: CalendarOpener;
  readonly readSourceTexts?: SourceTextReader;
}

export function syncOnce(options: SyncOnceOptions): Promise<SyncResult> {
  return withLock(options.paths.lockFile, () => syncAndRecord(options));
}

export const openGoogleBlockerCalendar: CalendarOpener = async (config, secrets) => {
  const { clientId, calendarId } = config.google;
  const clientSecret = await secrets.get(secretAccounts.googleClientSecret);
  const refreshToken = await secrets.get(secretAccounts.googleRefreshToken);
  if (!clientId || !clientSecret || !refreshToken || !calendarId) throw new Error("Google is not connected, connect it in the app");
  return googleBlockerCalendar(googleApis(authorizedClient({ clientId, clientSecret }, refreshToken)).events, calendarId);
};

async function syncAndRecord(options: SyncOnceOptions): Promise<SyncResult> {
  const now = options.now ?? (() => new Date());
  const secrets = recordingSecretStore(options.secrets);
  const startedAt = now();
  const result = redactResult(await runSafely(options, secrets, now, startedAt), secrets.revealed);
  if (!options.dryRun) await writeStatus(options.paths.statusFile, result);
  await appendLog(options.paths.logFile, logLines(result));
  return result;
}

async function runSafely(options: SyncOnceOptions, secrets: SecretStore, now: () => Date, startedAt: Date): Promise<SyncResult> {
  try {
    const config = await loadConfig(options.paths.configFile);
    return await runSync({
      config,
      secrets,
      calendar: await (options.openCalendar ?? openGoogleBlockerCalendar)(config, secrets),
      readSourceTexts: options.readSourceTexts ?? sourceTextReader(),
      today: todayLocal(startedAt),
      dryRun: options.dryRun,
      now,
    });
  } catch (error) {
    return failedResult(error, startedAt, now(), options.dryRun);
  }
}

function redactResult(result: SyncResult, secrets: ReadonlySet<string>): SyncResult {
  return {
    ...result,
    errors: result.errors.map((error) => redact(error, secrets)),
    sources: result.sources.map((source) => (source.error ? { ...source, error: redact(source.error, secrets) } : source)),
  };
}
