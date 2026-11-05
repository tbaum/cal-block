import type { OccurrenceTime } from "./occurrences.ts";

export interface Blocker {
  readonly key: string;
  readonly sourceId: string;
  readonly hash: string;
  readonly time: OccurrenceTime;
}

export interface ExistingBlocker extends Blocker {
  readonly eventId: string;
}

export interface ChangePlan {
  readonly create: readonly Blocker[];
  readonly update: readonly { readonly eventId: string; readonly blocker: Blocker }[];
  readonly delete: readonly ExistingBlocker[];
}
