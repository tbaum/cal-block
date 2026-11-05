import { addDays, type LocalDate } from "./dates.ts";

export const DEFAULT_HORIZON_DAYS = 60;

export interface SyncWindow {
  readonly start: LocalDate;
  readonly endExclusive: LocalDate;
}

export function syncWindow(today: LocalDate, horizonDays: number): SyncWindow {
  return { start: today, endExclusive: addDays(today, horizonDays) };
}

export function horizonBlockStart(window: SyncWindow): LocalDate {
  return window.endExclusive;
}
