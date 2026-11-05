import { DEFAULT_HORIZON_DAYS } from "./horizon.ts";
import type { Source } from "./sources.ts";

export interface Config {
  readonly sources: readonly Source[];
  readonly horizonDays: number;
  readonly blockerTitle: string;
  readonly syncIntervalMinutes: number;
  readonly startAtLogin: boolean;
  readonly google: { readonly clientId?: string; readonly calendarId?: string };
}

export const DEFAULT_CONFIG: Config = {
  sources: [],
  horizonDays: DEFAULT_HORIZON_DAYS,
  blockerTitle: "Busy",
  syncIntervalMinutes: 60,
  startAtLogin: true,
  google: {},
};
