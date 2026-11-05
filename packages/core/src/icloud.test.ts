import { describe, expect, it } from "vitest";
import type { DAVCalendar } from "tsdav";
import { discoverEventCalendars, fetchIcloudCalendarTexts, type CalDavClient } from "./icloud.ts";

const work: DAVCalendar = { url: "https://p1-caldav.icloud.com/1/calendars/work/", displayName: "Work", components: ["VEVENT"] };
const reminders: DAVCalendar = { url: "https://p1-caldav.icloud.com/1/calendars/tasks/", displayName: "Tasks", components: ["VTODO"] };
const unnamed: DAVCalendar = { url: "https://p1-caldav.icloud.com/1/calendars/x/", components: ["VEVENT", "VTODO"] };

function fakeClient(): CalDavClient & { requests: { url: string; start: string; end: string }[] } {
  const requests: { url: string; start: string; end: string }[] = [];
  return {
    requests,
    fetchCalendars: async () => [work, reminders, unnamed],
    fetchCalendarObjects: async ({ calendar, timeRange }) => {
      requests.push({ url: calendar.url, ...timeRange });
      return [{ url: `${calendar.url}a.ics`, data: `ICS:${calendar.url}` }, { url: `${calendar.url}b.ics` }];
    },
  };
}

const range = { start: new Date("2026-11-04T23:00:00.000Z"), end: new Date("2027-01-03T23:00:00.000Z") };

describe("discoverEventCalendars", () => {
  it("lists calendars that hold events", async () => {
    expect(await discoverEventCalendars(fakeClient())).toEqual([
      { url: work.url, name: "Work" },
      { url: unnamed.url, name: unnamed.url },
    ]);
  });
});

describe("fetchIcloudCalendarTexts", () => {
  it("fetches the selected calendars within the range", async () => {
    const client = fakeClient();
    const texts = await fetchIcloudCalendarTexts(client, ["https://p1-caldav.icloud.com/1/calendars/work"], range);
    expect(texts).toEqual([`ICS:${work.url}`]);
    expect(client.requests).toEqual([{ url: work.url, start: "2026-11-04T23:00:00.000Z", end: "2027-01-03T23:00:00.000Z" }]);
  });

  it("fails when a selected calendar no longer exists", async () => {
    await expect(fetchIcloudCalendarTexts(fakeClient(), ["https://p1-caldav.icloud.com/1/calendars/gone/"], range)).rejects.toThrow(
      /not found/,
    );
  });
});
