import type { Blocker, ExistingBlocker } from "./blockers.ts";
import type { SyncWindow } from "./horizon.ts";

export interface BlockerCalendar {
  listBlockers(window: SyncWindow): Promise<ExistingBlocker[]>;
  listHorizonBlockers(): Promise<ExistingBlocker[]>;
  insert(blocker: Blocker): Promise<void>;
  update(eventId: string, blocker: Blocker): Promise<void>;
  remove(eventId: string): Promise<void>;
}
