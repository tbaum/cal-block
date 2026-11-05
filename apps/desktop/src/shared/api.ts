import type { CalendarSummary, Config, StoredStatus } from "@cal-block/core";

export interface ScheduleInfo {
  readonly running: boolean;
  readonly nextRunAt?: string;
}

export interface AppState {
  readonly config: Config;
  readonly google: { readonly connected: boolean; readonly clientId?: string | undefined; readonly calendarId?: string | undefined };
  readonly status?: StoredStatus;
  readonly schedule: ScheduleInfo;
}

export interface SourceDraft {
  readonly id?: string;
  readonly kind: "ics" | "icloud";
  readonly name: string;
  readonly enabled: boolean;
  readonly ownerEmails: readonly string[];
  readonly secret?: string;
  readonly appleId?: string;
  readonly calendarUrls?: readonly string[];
}

export interface SyncSettings {
  readonly horizonDays: number;
  readonly blockerTitle: string;
  readonly syncIntervalMinutes: number;
  readonly startAtLogin: boolean;
}

export interface GoogleCredentialsInput {
  readonly clientId: string;
  readonly clientSecret?: string;
}

export interface IcloudLogin {
  readonly appleId: string;
  readonly password?: string;
  readonly sourceId?: string;
}

export type SourceTestResult = { readonly ok: true; readonly busyOccurrences: number } | { readonly ok: false; readonly error: string };

export interface CalBlockCommands {
  getState(): Promise<AppState>;
  saveSettings(settings: SyncSettings): Promise<AppState>;
  saveSource(draft: SourceDraft): Promise<AppState>;
  removeSource(sourceId: string): Promise<AppState>;
  testSource(draft: SourceDraft): Promise<SourceTestResult>;
  discoverIcloudCalendars(login: IcloudLogin): Promise<CalendarSummary[]>;
  connectGoogle(credentials: GoogleCredentialsInput): Promise<AppState>;
  disconnectGoogle(): Promise<AppState>;
  syncNow(): Promise<AppState>;
}

export interface CalBlockApi extends CalBlockCommands {
  onStateChanged(listener: (state: AppState) => void): () => void;
}

export const COMMAND_NAMES = [
  "getState",
  "saveSettings",
  "saveSource",
  "removeSource",
  "testSource",
  "discoverIcloudCalendars",
  "connectGoogle",
  "disconnectGoogle",
  "syncNow",
] as const satisfies readonly (keyof CalBlockCommands)[];

export const STATE_CHANNEL = "calblock:state";

export const commandChannel = (name: keyof CalBlockCommands) => `calblock:${name}`;
