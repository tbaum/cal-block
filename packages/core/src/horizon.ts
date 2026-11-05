import { HORIZON_KEY, makeBlocker, type Blocker, type ExistingBlocker } from "./blockers.ts";
import { addDays, formatLocalDate, localMidnight, type LocalDate, type TimeRange } from "./dates.ts";
import { diffBlockers, type ChangePlan } from "./plan.ts";

export const DEFAULT_HORIZON_DAYS = 60;

export interface SyncWindow {
  readonly start: LocalDate;
  readonly endExclusive: LocalDate;
}

export function syncWindow(today: LocalDate, horizonDays: number): SyncWindow {
  return { start: today, endExclusive: addDays(today, horizonDays) };
}

export function windowRange(window: SyncWindow): TimeRange {
  return { start: localMidnight(window.start), end: localMidnight(window.endExclusive) };
}

export function horizonBlockStart(window: SyncWindow): LocalDate {
  return window.endExclusive;
}

export function horizonBlocker(window: SyncWindow, title: string): Blocker {
  const start = horizonBlockStart(window);
  return makeBlocker(HORIZON_KEY, "", {
    title,
    time: { allDay: true, startDate: formatLocalDate(start), endDate: formatLocalDate(addDays(start, 1)) },
    recurrence: ["RRULE:FREQ=DAILY"],
  });
}

export function planHorizonBlock(existing: readonly ExistingBlocker[], window: SyncWindow, title: string): ChangePlan {
  return diffBlockers(
    [horizonBlocker(window, title)],
    existing.filter((blocker) => blocker.key === HORIZON_KEY),
    () => true,
  );
}
