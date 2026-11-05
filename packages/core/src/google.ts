import type { SyncWindow } from "./horizon.ts";
import type { Blocker, ExistingBlocker } from "./plan.ts";

export interface BlockerCalendar {
  listBlockers(window: SyncWindow): Promise<ExistingBlocker[]>;
  insert(blocker: Blocker): Promise<void>;
  update(eventId: string, blocker: Blocker): Promise<void>;
  remove(eventId: string): Promise<void>;
}
