import { describe, expect, it } from "vitest";
import { blockerFor } from "./blockers.ts";
import type { Occurrence } from "./occurrences.ts";

const occurrence: Occurrence = {
  sourceId: "src",
  uid: "u",
  recurrenceId: "2026-11-10T13:00:00.000Z",
  time: { allDay: false, start: "2026-11-10T13:00:00.000Z", end: "2026-11-10T14:00:00.000Z" },
  attendees: [],
};

describe("blockerFor", () => {
  it("is stable for the same occurrence", () => {
    expect(blockerFor(occurrence, "Busy")).toEqual(blockerFor({ ...occurrence }, "Busy"));
  });

  it("keeps the key but changes the hash when the time moves", () => {
    const moved = blockerFor(
      { ...occurrence, time: { allDay: false, start: "2026-11-10T14:00:00.000Z", end: "2026-11-10T15:00:00.000Z" } },
      "Busy",
    );
    const original = blockerFor(occurrence, "Busy");
    expect(moved.key).toBe(original.key);
    expect(moved.hash).not.toBe(original.hash);
  });

  it("changes the hash when the title changes", () => {
    expect(blockerFor(occurrence, "Blocked").hash).not.toBe(blockerFor(occurrence, "Busy").hash);
  });

  it("separates keys by source, uid and recurrence id", () => {
    const keys = new Set([
      blockerFor(occurrence, "Busy").key,
      blockerFor({ ...occurrence, sourceId: "other" }, "Busy").key,
      blockerFor({ ...occurrence, uid: "v" }, "Busy").key,
      blockerFor({ ...occurrence, recurrenceId: "2026-11-17T13:00:00.000Z" }, "Busy").key,
    ]);
    expect(keys.size).toBe(4);
  });
});
