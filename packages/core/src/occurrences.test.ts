import { describe, expect, it } from "vitest";
import { syncWindow, windowRange } from "./horizon.ts";
import { calendar, vevent } from "./ics-fixtures.ts";
import { expandCalendar } from "./occurrences.ts";

const range = windowRange(syncWindow({ year: 2026, month: 11, day: 5 }, 60));
const expand = (...events: string[]) => expandCalendar(calendar(...events), "src", range);

describe("expandCalendar", () => {
  it("converts a timed event in a VTIMEZONE to UTC instants", () => {
    const [occurrence] = expand(
      vevent({ UID: "a", "DTSTART;TZID=Europe/Berlin": "20261110T140000", "DTEND;TZID=Europe/Berlin": "20261110T153000" }),
    );
    expect(occurrence).toMatchObject({
      sourceId: "src",
      uid: "a",
      time: { allDay: false, start: "2026-11-10T13:00:00.000Z", end: "2026-11-10T14:30:00.000Z" },
    });
    expect(occurrence?.recurrenceId).toBeUndefined();
  });

  it("keeps UTC times", () => {
    const [occurrence] = expand(vevent({ UID: "u", DTSTART: "20261110T080000Z", DTEND: "20261110T090000Z" }));
    expect(occurrence?.time).toEqual({ allDay: false, start: "2026-11-10T08:00:00.000Z", end: "2026-11-10T09:00:00.000Z" });
  });

  it("interprets floating times in the system time zone", () => {
    const [occurrence] = expand(vevent({ UID: "f", DTSTART: "20261110T140000", DTEND: "20261110T150000" }));
    expect(occurrence?.time).toEqual({ allDay: false, start: "2026-11-10T13:00:00.000Z", end: "2026-11-10T14:00:00.000Z" });
  });

  it("maps all-day events with exclusive end date", () => {
    const [occurrence] = expand(vevent({ UID: "d", "DTSTART;VALUE=DATE": "20261112", "DTEND;VALUE=DATE": "20261114" }));
    expect(occurrence?.time).toEqual({ allDay: true, startDate: "2026-11-12", endDate: "2026-11-14" });
  });

  it("gives an all-day event without DTEND one day", () => {
    const [occurrence] = expand(vevent({ UID: "d1", "DTSTART;VALUE=DATE": "20261130" }));
    expect(occurrence?.time).toEqual({ allDay: true, startDate: "2026-11-30", endDate: "2026-12-01" });
  });

  it("drops events outside the window and keeps events overlapping its start", () => {
    const occurrences = expand(
      vevent({ UID: "past", DTSTART: "20261101T080000Z", DTEND: "20261101T090000Z" }),
      vevent({ UID: "spans", "DTSTART;TZID=Europe/Berlin": "20261104T230000", "DTEND;TZID=Europe/Berlin": "20261105T010000" }),
      vevent({ UID: "beyond", "DTSTART;VALUE=DATE": "20270104" }),
    );
    expect(occurrences.map((o) => o.uid)).toEqual(["spans"]);
  });

  it("expands a weekly series with a moved instance", () => {
    const occurrences = expand(
      vevent({
        UID: "w",
        "DTSTART;TZID=Europe/Berlin": "20261102T100000",
        "DTEND;TZID=Europe/Berlin": "20261102T110000",
        RRULE: "FREQ=WEEKLY;COUNT=4",
      }),
      vevent({
        UID: "w",
        "RECURRENCE-ID;TZID=Europe/Berlin": "20261116T100000",
        "DTSTART;TZID=Europe/Berlin": "20261117T150000",
        "DTEND;TZID=Europe/Berlin": "20261117T160000",
      }),
    );
    expect(occurrences.map((o) => [o.recurrenceId, o.time.allDay ? "" : o.time.start])).toEqual([
      ["2026-11-09T09:00:00.000Z", "2026-11-09T09:00:00.000Z"],
      ["2026-11-16T09:00:00.000Z", "2026-11-17T14:00:00.000Z"],
      ["2026-11-23T09:00:00.000Z", "2026-11-23T09:00:00.000Z"],
    ]);
  });

  it("honours EXDATE", () => {
    const occurrences = expand(
      vevent({
        UID: "x",
        "DTSTART;TZID=Europe/Berlin": "20261106T100000",
        "DTEND;TZID=Europe/Berlin": "20261106T110000",
        RRULE: "FREQ=DAILY;COUNT=3",
        "EXDATE;TZID=Europe/Berlin": "20261107T100000",
      }),
    );
    expect(occurrences.map((o) => o.recurrenceId)).toEqual(["2026-11-06T09:00:00.000Z", "2026-11-08T09:00:00.000Z"]);
  });

  it("keeps local wall time across the DST change", () => {
    const occurrences = expandCalendar(
      calendar(
        vevent({
          UID: "dst",
          "DTSTART;TZID=Europe/Berlin": "20270327T100000",
          "DTEND;TZID=Europe/Berlin": "20270327T110000",
          RRULE: "FREQ=DAILY;COUNT=2",
        }),
      ),
      "src",
      windowRange(syncWindow({ year: 2027, month: 3, day: 27 }, 2)),
    );
    expect(occurrences.map((o) => (o.time.allDay ? "" : o.time.start))).toEqual([
      "2027-03-27T09:00:00.000Z",
      "2027-03-28T08:00:00.000Z",
    ]);
  });

  it("reads status, transparency and attendees per occurrence", () => {
    const occurrences = expand(
      vevent({
        UID: "s",
        DTSTART: "20261106T080000Z",
        DTEND: "20261106T090000Z",
        RRULE: "FREQ=DAILY;COUNT=2",
        TRANSP: "TRANSPARENT",
        ATTENDEE: ";PARTSTAT=DECLINED:mailto:Me@Example.com",
      }),
      vevent({ UID: "s", "RECURRENCE-ID": "20261107T080000Z", DTSTART: "20261107T080000Z", DTEND: "20261107T090000Z", STATUS: "CANCELLED" }),
    );
    expect(occurrences[0]).toMatchObject({ transparency: "TRANSPARENT", attendees: [{ email: "me@example.com", partstat: "DECLINED" }] });
    expect(occurrences[1]).toMatchObject({ status: "CANCELLED", attendees: [] });
  });

  it("skips events without UID", () => {
    expect(expand(vevent({ DTSTART: "20261110T080000Z", DTEND: "20261110T090000Z" }))).toEqual([]);
  });
});
