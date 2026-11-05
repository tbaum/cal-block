import { createHash } from "node:crypto";
import type { Occurrence, OccurrenceTime } from "./occurrences.ts";

export const HORIZON_KEY = "horizon";

export interface BlockerContent {
  readonly title: string;
  readonly time: OccurrenceTime;
  readonly recurrence?: readonly string[];
}

export interface Blocker extends BlockerContent {
  readonly key: string;
  readonly sourceId: string;
  readonly hash: string;
}

export interface ExistingBlocker extends Blocker {
  readonly eventId: string;
}

export function blockerFor(occurrence: Occurrence, title: string): Blocker {
  return makeBlocker(occurrenceKey(occurrence), occurrence.sourceId, { title, time: occurrence.time });
}

export function makeBlocker(key: string, sourceId: string, content: BlockerContent): Blocker {
  return { ...content, key, sourceId, hash: contentHash(content) };
}

export function occurrenceKey(occurrence: Occurrence): string {
  return shortHash([occurrence.sourceId, occurrence.uid, occurrence.recurrenceId ?? ""].join("\u0000"));
}

export function contentHash(content: BlockerContent): string {
  return shortHash(JSON.stringify([content.title, content.time, content.recurrence ?? []]));
}

function shortHash(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 32);
}
