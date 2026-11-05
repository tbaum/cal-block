import { DEFAULT_HORIZON_DAYS } from "./horizon.ts";
import type { Source } from "./sources.ts";

export interface Config {
  readonly sources: readonly Source[];
  readonly horizonDays: number;
  readonly blockerTitle: string;
  readonly schedule: { readonly enabled: boolean; readonly intervalMinutes: number };
  readonly google: { readonly clientId?: string; readonly calendarId?: string };
}

export const DEFAULT_CONFIG: Config = {
  sources: [],
  horizonDays: DEFAULT_HORIZON_DAYS,
  blockerTitle: "Busy",
  schedule: { enabled: false, intervalMinutes: 60 },
  google: {},
};
