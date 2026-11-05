import { randomUUID } from "node:crypto";
import {
  AlreadyRunningError,
  authorizedClient,
  authorizeWithLoopback,
  connectIcloud,
  discoverEventCalendars,
  ensureBlockerCalendar,
  errorMessage,
  fetchIcs,
  googleApis,
  loadConfig,
  readBusyOccurrences,
  readStatus,
  redact,
  saveConfig,
  secretAccounts,
  sourceTextReader,
  syncOnce,
  syncWindow,
  todayLocal,
  windowRange,
  type AppPaths,
  type CalDavClient,
  type CalendarOpener,
  type CalendarSummary,
  type Config,
  type GoogleCalendarsApi,
  type GoogleClientCredentials,
  type SecretStore,
  type Source,
  type SourceTextReader,
  type StoredStatus,
} from "@cal-block/core";
import type { GoogleCredentialsInput, IcloudLogin, SourceDraft, SourceTestResult, SyncSettings } from "../shared/api.ts";

export interface LoginItem {
  setEnabled(enabled: boolean): void;
}

export interface AppServiceDeps {
  readonly paths: AppPaths;
  readonly secrets: SecretStore;
  readonly openBrowser: (url: string) => Promise<void>;
  readonly loginItem: LoginItem;
  readonly authorize?: (credentials: GoogleClientCredentials, openBrowser: (url: string) => Promise<void>) => Promise<string>;
  readonly googleCalendars?: (credentials: GoogleClientCredentials, refreshToken: string) => GoogleCalendarsApi;
  readonly connectCalDav?: (appleId: string, password: string) => Promise<CalDavClient>;
  readonly readSourceTexts?: SourceTextReader;
  readonly openCalendar?: CalendarOpener;
  readonly now?: () => Date;
}

export interface ServiceState {
  readonly config: Config;
  readonly google: { readonly connected: boolean; readonly clientId?: string | undefined; readonly calendarId?: string | undefined };
  readonly status?: StoredStatus;
}

export type ChangeKind = "config" | "state";

export type AppService = ReturnType<typeof createAppService>;

export function createAppService(deps: AppServiceDeps) {
  const listeners = new Set<(kind: ChangeKind) => void>();
  const now = deps.now ?? (() => new Date());
  const connectCalDav = deps.connectCalDav ?? connectIcloud;
  const readSourceTexts = deps.readSourceTexts ?? sourceTextReader({ downloadIcs: (url) => fetchIcs(url), connectCalDav });
  const notify = (kind: ChangeKind) => listeners.forEach((listener) => listener(kind));
  const config = () => loadConfig(deps.paths.configFile);
  const updateConfig = async (change: (current: Config) => Config) => {
    await saveConfig(deps.paths.configFile, change(await config()));
    notify("config");
  };

  return {
    onChange(listener: (kind: ChangeKind) => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    async state(): Promise<ServiceState> {
      const current = await config();
      const refreshToken = await deps.secrets.get(secretAccounts.googleRefreshToken);
      const status = await readStatus(deps.paths.statusFile);
      return {
        config: current,
        google: { connected: Boolean(refreshToken && current.google.calendarId), ...current.google },
        ...(status && { status }),
      };
    },

    async intervalMs(): Promise<number> {
      return (await config()).syncIntervalMinutes * 60_000;
    },

    async lastRunAt(): Promise<Date | undefined> {
      const status = await readStatus(deps.paths.statusFile);
      return status ? new Date(status.finishedAt) : undefined;
    },

    async applyLoginItem(): Promise<void> {
      deps.loginItem.setEnabled((await config()).startAtLogin);
    },

    async saveSettings(settings: SyncSettings): Promise<void> {
      await updateConfig((current) => ({ ...current, ...settings }));
      deps.loginItem.setEnabled(settings.startAtLogin);
    },

    async saveSource(draft: SourceDraft): Promise<void> {
      const current = await config();
      const id = draft.id ?? randomUUID().slice(0, 8);
      const hasStoredSecret = Boolean(await deps.secrets.get(secretAccounts.source(id)));
      if (!draft.secret && !hasStoredSecret) throw new Error(draft.kind === "ics" ? "ICS-URL fehlt" : "App-Passwort fehlt");
      const source = sourceFromDraft(id, draft);
      await saveConfig(deps.paths.configFile, { ...current, sources: upsert(current.sources, source) });
      if (draft.secret) await deps.secrets.set(secretAccounts.source(id), draft.secret);
      notify("config");
    },

    async removeSource(sourceId: string): Promise<void> {
      await updateConfig((current) => ({ ...current, sources: current.sources.filter((source) => source.id !== sourceId) }));
      await deps.secrets.remove(secretAccounts.source(sourceId));
    },

    async testSource(draft: SourceDraft): Promise<SourceTestResult> {
      const id = draft.id ?? "draft";
      const secret = draft.secret || (await deps.secrets.get(secretAccounts.source(id)));
      try {
        if (!secret) throw new Error(draft.kind === "ics" ? "ICS-URL fehlt" : "App-Passwort fehlt");
        const window = syncWindow(todayLocal(now()), (await config()).horizonDays);
        const busy = await readBusyOccurrences(sourceFromDraft(id, draft), singleSecret(id, secret), readSourceTexts, windowRange(window));
        return { ok: true, busyOccurrences: busy.length };
      } catch (error) {
        return { ok: false, error: redact(errorMessage(error), secret ? [secret] : []) };
      }
    },

    async discoverIcloudCalendars(login: IcloudLogin): Promise<CalendarSummary[]> {
      const password = login.password || (login.sourceId && (await deps.secrets.get(secretAccounts.source(login.sourceId))));
      if (!password) throw new Error("App-Passwort fehlt");
      return discoverEventCalendars(await connectCalDav(login.appleId, password));
    },

    async connectGoogle(input: GoogleCredentialsInput): Promise<void> {
      const clientSecret = input.clientSecret || (await deps.secrets.get(secretAccounts.googleClientSecret));
      if (!input.clientId || !clientSecret) throw new Error("Client-ID und Client-Secret werden benötigt");
      const credentials = { clientId: input.clientId, clientSecret };
      const refreshToken = await (deps.authorize ?? authorizeInBrowser)(credentials, deps.openBrowser);
      const calendars = (deps.googleCalendars ?? googleCalendarsFor)(credentials, refreshToken);
      const calendarId = await ensureBlockerCalendar(calendars, (await config()).google.calendarId);
      await deps.secrets.set(secretAccounts.googleClientSecret, clientSecret);
      await deps.secrets.set(secretAccounts.googleRefreshToken, refreshToken);
      await updateConfig((current) => ({ ...current, google: { clientId: input.clientId, calendarId } }));
    },

    async disconnectGoogle(): Promise<void> {
      await deps.secrets.remove(secretAccounts.googleRefreshToken);
      notify("state");
    },

    async sync(): Promise<void> {
      try {
        await syncOnce({
          paths: deps.paths,
          secrets: deps.secrets,
          dryRun: false,
          now,
          readSourceTexts,
          ...(deps.openCalendar && { openCalendar: deps.openCalendar }),
        });
      } catch (error) {
        if (!(error instanceof AlreadyRunningError)) throw error;
      } finally {
        notify("state");
      }
    },
  };
}

function authorizeInBrowser(credentials: GoogleClientCredentials, openBrowser: (url: string) => Promise<void>): Promise<string> {
  return authorizeWithLoopback(credentials, { openBrowser });
}

function googleCalendarsFor(credentials: GoogleClientCredentials, refreshToken: string): GoogleCalendarsApi {
  return googleApis(authorizedClient(credentials, refreshToken)).calendars;
}

function sourceFromDraft(id: string, draft: SourceDraft): Source {
  const base = { id, name: draft.name.trim(), enabled: draft.enabled, ownerEmails: [...draft.ownerEmails] };
  return draft.kind === "ics"
    ? { ...base, kind: "ics" }
    : { ...base, kind: "icloud", appleId: draft.appleId?.trim() ?? "", calendarUrls: [...(draft.calendarUrls ?? [])] };
}

function upsert(sources: readonly Source[], source: Source): Source[] {
  return sources.some((existing) => existing.id === source.id)
    ? sources.map((existing) => (existing.id === source.id ? source : existing))
    : [...sources, source];
}

function singleSecret(sourceId: string, secret: string): SecretStore {
  return {
    get: async (account) => (account === secretAccounts.source(sourceId) ? secret : undefined),
    set: async () => {},
    remove: async () => {},
  };
}
