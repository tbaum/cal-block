import { describe, expect, it } from "vitest";
import { isBusy } from "./busy.ts";
import type { Occurrence } from "./occurrences.ts";

const base: Occurrence = {
  sourceId: "src",
  uid: "u",
  time: { allDay: false, start: "2026-11-10T13:00:00.000Z", end: "2026-11-10T14:00:00.000Z" },
  attendees: [],
};

describe("isBusy", () => {
  it("treats a plain event as busy", () => {
    expect(isBusy(base, [])).toBe(true);
  });

  it("releases cancelled events", () => {
    expect(isBusy({ ...base, status: "CANCELLED" }, [])).toBe(false);
  });

  it("releases events marked free", () => {
    expect(isBusy({ ...base, transparency: "TRANSPARENT" }, [])).toBe(false);
  });

  it("releases events declined by an owner address, case-insensitively", () => {
    const declined = { ...base, attendees: [{ email: "me@example.com", partstat: "DECLINED" }] };
    expect(isBusy(declined, ["Me@Example.com"])).toBe(false);
  });

  it("stays busy when someone else declined", () => {
    const declined = { ...base, attendees: [{ email: "other@example.com", partstat: "DECLINED" }] };
    expect(isBusy(declined, ["me@example.com"])).toBe(true);
  });

  it("stays busy when the owner accepted", () => {
    const accepted = { ...base, attendees: [{ email: "me@example.com", partstat: "ACCEPTED" }] };
    expect(isBusy(accepted, ["me@example.com"])).toBe(true);
  });
});
