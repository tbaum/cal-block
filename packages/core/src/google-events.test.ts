import { describe, expect, it } from "vitest";
import { makeBlocker } from "./blockers.ts";
import { eventBody, existingBlocker } from "./google-events.ts";

const timed = makeBlocker("k1", "src", { title: "Busy", time: { allDay: false, start: "2026-11-10T13:00:00.000Z", end: "2026-11-10T14:30:00.000Z" } });
const horizon = makeBlocker("horizon", "", {
  title: "Busy",
  time: { allDay: true, startDate: "2027-01-04", endDate: "2027-01-05" },
  recurrence: ["RRULE:FREQ=DAILY"],
});

describe("eventBody", () => {
  it("creates an anonymous opaque private event with marker properties", () => {
    expect(eventBody(timed)).toEqual({
      summary: "Busy",
      start: { dateTime: "2026-11-10T13:00:00.000Z" },
      end: { dateTime: "2026-11-10T14:30:00.000Z" },
      transparency: "opaque",
      visibility: "private",
      reminders: { useDefault: false, overrides: [] },
      extendedProperties: { private: { calblock: "1", calblockKey: "k1", calblockSource: "src", calblockHash: timed.hash } },
    });
  });

  it("writes all-day recurring blockers with dates", () => {
    expect(eventBody(horizon)).toMatchObject({ start: { date: "2027-01-04" }, end: { date: "2027-01-05" }, recurrence: ["RRULE:FREQ=DAILY"] });
  });
});

describe("existingBlocker", () => {
  it("reads back what eventBody wrote", () => {
    expect(existingBlocker({ ...eventBody(timed), id: "ev1" })).toEqual({ ...timed, eventId: "ev1" });
    expect(existingBlocker({ ...eventBody(horizon), id: "ev2" })).toEqual({ ...horizon, eventId: "ev2" });
  });

  it("normalises offset date-times returned by Google", () => {
    const event = { ...eventBody(timed), id: "ev1", start: { dateTime: "2026-11-10T14:00:00+01:00" }, end: { dateTime: "2026-11-10T15:30:00+01:00" } };
    expect(existingBlocker(event)?.time).toEqual(timed.time);
  });

  it("ignores events without the marker", () => {
    expect(existingBlocker({ id: "foreign", summary: "Lunch", start: { dateTime: "2026-11-10T12:00:00Z" }, end: { dateTime: "2026-11-10T13:00:00Z" } })).toBeUndefined();
  });
});
