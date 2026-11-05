import { describe, expect, it } from "vitest";
import { makeBlocker } from "./blockers.ts";
import { ensureBlockerCalendar, googleBlockerCalendar, type GoogleCalendarsApi, type GoogleEventsApi } from "./google.ts";
import { horizonBlocker, syncWindow } from "./horizon.ts";
import type { RetryPolicy } from "./retry.ts";
import { fakeEvents, notFound } from "./google-fake.ts";

const noWait: RetryPolicy = { attempts: 3, baseDelayMs: 0, sleep: async () => {} };
const window = syncWindow({ year: 2026, month: 11, day: 5 }, 60);

const blocker = (key: string, start: string, end: string) => makeBlocker(key, "src", { title: "Busy", time: { allDay: false, start, end } });

describe("googleBlockerCalendar", () => {
  it("lists marked blockers across pages from the window start, without the horizon block", async () => {
    const fake = fakeEvents();
    const calendar = googleBlockerCalendar(fake.api, "cal", noWait);
    await calendar.insert(blocker("past", "2026-11-01T08:00:00.000Z", "2026-11-01T09:00:00.000Z"));
    for (const day of ["10", "11", "12"]) await calendar.insert(blocker(`k${day}`, `2026-11-${day}T08:00:00.000Z`, `2026-11-${day}T09:00:00.000Z`));
    await calendar.insert(horizonBlocker(window, "Busy"));
    fake.events.set("foreign", { id: "foreign", summary: "Lunch", start: { dateTime: "2026-11-10T12:00:00Z" }, end: { dateTime: "2026-11-10T13:00:00Z" } });

    const listed = await calendar.listBlockers(window);

    expect(listed.map((b) => b.key).sort()).toEqual(["k10", "k11", "k12"]);
    expect(fake.listCalls[0]).toMatchObject({ calendarId: "cal", singleEvents: false, timeMin: "2026-11-04T23:00:00.000Z" });
    expect(fake.listCalls[0]?.timeMax).toBeUndefined();
  });

  it("lists the horizon block without time bounds", async () => {
    const fake = fakeEvents();
    const calendar = googleBlockerCalendar(fake.api, "cal", noWait);
    await calendar.insert(horizonBlocker(window, "Busy"));
    expect((await calendar.listHorizonBlockers()).map((b) => b.key)).toEqual(["horizon"]);
    expect(fake.listCalls[0]?.timeMin).toBeUndefined();
  });

  it("updates and removes blockers, tolerating already deleted events", async () => {
    const fake = fakeEvents();
    const calendar = googleBlockerCalendar(fake.api, "cal", noWait);
    await calendar.insert(blocker("k1", "2026-11-10T08:00:00.000Z", "2026-11-10T09:00:00.000Z"));
    await calendar.update("ev1", blocker("k1", "2026-11-10T10:00:00.000Z", "2026-11-10T11:00:00.000Z"));
    expect(fake.events.get("ev1")?.start).toEqual({ dateTime: "2026-11-10T10:00:00.000Z" });
    await calendar.remove("ev1");
    await expect(calendar.remove("ev1")).resolves.toBeUndefined();
    expect(fake.events.size).toBe(0);
  });

  it("retries rate-limited writes", async () => {
    const fake = fakeEvents();
    let failures = 1;
    const flaky: GoogleEventsApi = {
      ...fake.api,
      insert: async (params) => {
        if (failures-- > 0) throw Object.assign(new Error("rate"), { status: 429 });
        return fake.api.insert(params);
      },
    };
    await googleBlockerCalendar(flaky, "cal", noWait).insert(blocker("k1", "2026-11-10T08:00:00.000Z", "2026-11-10T09:00:00.000Z"));
    expect(fake.events.size).toBe(1);
  });
});

describe("ensureBlockerCalendar", () => {
  const calendars = (existing: string[]) => {
    const created: string[] = [];
    const api: GoogleCalendarsApi = {
      get: async ({ calendarId }) => {
        if (!existing.includes(calendarId)) throw notFound();
        return { data: { id: calendarId } };
      },
      insert: async ({ requestBody }) => {
        created.push(requestBody.summary ?? "");
        return { data: { id: "new-cal" } };
      },
    };
    return { api, created };
  };

  it("reuses the stored calendar when it still exists", async () => {
    const fake = calendars(["stored"]);
    expect(await ensureBlockerCalendar(fake.api, "stored")).toBe("stored");
    expect(fake.created).toEqual([]);
  });

  it("creates a Blocker calendar when none is stored or it was deleted", async () => {
    const fake = calendars([]);
    expect(await ensureBlockerCalendar(fake.api, "deleted")).toBe("new-cal");
    expect(await ensureBlockerCalendar(fake.api)).toBe("new-cal");
    expect(fake.created).toEqual(["Blocker", "Blocker"]);
  });
});
