import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, saveConfig, type Config } from "./config.ts";
import { googleBlockerCalendar } from "./google.ts";
import { fakeEvents } from "./google-fake.ts";
import { calendar, vevent } from "./ics-fixtures.ts";
import { appPaths, type AppPaths } from "./paths.ts";
import { inMemorySecretStore } from "./secrets.ts";
import { readStatus } from "./status.ts";
import { syncOnce } from "./sync-once.ts";

const NOW = new Date("2026-11-05T17:00:00.000Z");
const noWait = { attempts: 2, baseDelayMs: 0, sleep: async () => {} };

const config: Config = {
  ...DEFAULT_CONFIG,
  sources: [
    { id: "work", name: "Work", kind: "ics", enabled: true, ownerEmails: ["me@example.com"] },
    { id: "home", name: "Home", kind: "ics", enabled: true, ownerEmails: [] },
  ],
};

const meeting = (start: string, end: string, extra: Record<string, string> = {}) =>
  vevent({ UID: "meeting", "DTSTART;TZID=Europe/Berlin": start, "DTEND;TZID=Europe/Berlin": end, ...extra });

let paths: AppPaths;
let google: ReturnType<typeof fakeEvents>;
let feeds: Record<string, string | Error>;

beforeEach(async () => {
  paths = appPaths(await mkdtemp(join(tmpdir(), "cal-block-home-")));
  await saveConfig(paths.configFile, config);
  google = fakeEvents(100);
  feeds = {
    "https://feeds/work.ics": calendar(
      meeting("20261110T140000", "20261110T153000"),
      vevent({ UID: "standup", "DTSTART;TZID=Europe/Berlin": "20261106T090000", "DTEND;TZID=Europe/Berlin": "20261106T091500", RRULE: "FREQ=DAILY;COUNT=3" }),
      vevent({ UID: "declined", DTSTART: "20261111T080000Z", DTEND: "20261111T090000Z", ATTENDEE: ";PARTSTAT=DECLINED:mailto:me@example.com" }),
    ),
    "https://feeds/home.ics": calendar(vevent({ UID: "trip", "DTSTART;VALUE=DATE": "20261120", "DTEND;VALUE=DATE": "20261122" })),
  };
});

const run = (dryRun = false) =>
  syncOnce({
    paths,
    secrets: inMemorySecretStore({ "source:work": "https://feeds/work.ics", "source:home": "https://feeds/home.ics" }),
    dryRun,
    now: () => NOW,
    openCalendar: async () => googleBlockerCalendar(google.api, "cal", noWait),
    readSourceTexts: async (source, secrets) => {
      const feed = feeds[(await secrets.get(`source:${source.id}`)) ?? ""];
      if (feed instanceof Error) throw feed;
      return [feed ?? ""];
    },
  });

const summaries = () => [...google.events.values()].map((event) => event.start?.dateTime ?? event.start?.date).sort();

describe("syncOnce", () => {
  it("mirrors busy occurrences and the horizon block", async () => {
    const result = await run();
    expect(result).toMatchObject({ outcome: "ok", counts: { created: 6, updated: 0, deleted: 0 }, errors: [] });
    expect(summaries()).toEqual([
      "2026-11-06T08:00:00.000Z",
      "2026-11-07T08:00:00.000Z",
      "2026-11-08T08:00:00.000Z",
      "2026-11-10T13:00:00.000Z",
      "2026-11-20",
      "2027-01-04",
    ]);
    expect(await readStatus(paths.statusFile)).toMatchObject({ outcome: "ok", counts: { created: 6 } });
    expect(await readFile(paths.logFile, "utf8")).toMatch(/ok: applied \+6 ~0 -0/);
  });

  it("makes no writes on an unchanged second run", async () => {
    await run();
    const writesAfterFirstRun = google.writes.length;
    expect((await run()).counts).toEqual({ created: 0, updated: 0, deleted: 0 });
    expect(google.writes).toHaveLength(writesAfterFirstRun);
  });

  it("moves, releases and removes blockers when the source changes", async () => {
    await run();
    feeds["https://feeds/work.ics"] = calendar(meeting("20261110T160000", "20261110T170000", { STATUS: "CONFIRMED" }));
    const result = await run();
    expect(result.counts).toEqual({ created: 0, updated: 1, deleted: 3 });
    expect(summaries()).toEqual(["2026-11-10T15:00:00.000Z", "2026-11-20", "2027-01-04"]);
  });

  it("keeps blockers of a failing source and reports a partial run", async () => {
    await run();
    feeds["https://feeds/home.ics"] = new Error("ICS download failed: HTTP 503");
    const result = await run();
    expect(result).toMatchObject({ outcome: "partial", counts: { created: 0, updated: 0, deleted: 0 } });
    expect(result.errors).toEqual(["Home: ICS download failed: HTTP 503"]);
    expect(summaries()).toContain("2026-11-20");
  });

  it("redacts secrets from errors", async () => {
    feeds["https://feeds/home.ics"] = new Error("fetch https://feeds/home.ics failed");
    expect((await run()).errors).toEqual(["Home: fetch [redacted] failed"]);
  });

  it("plans without writing in dry-run mode and leaves the status untouched", async () => {
    const result = await run(true);
    expect(result).toMatchObject({ outcome: "ok", dryRun: true, counts: { created: 6 } });
    expect(result.plan?.create).toHaveLength(6);
    expect(google.writes).toEqual([]);
    expect(await readStatus(paths.statusFile)).toBeUndefined();
  });

  it("records a failed run when Google is not connected", async () => {
    const result = await syncOnce({ paths, secrets: inMemorySecretStore(), dryRun: false, now: () => NOW });
    expect(result).toMatchObject({ outcome: "failed", errors: ["Google is not connected, connect it in the app"] });
    expect(await readStatus(paths.statusFile)).toMatchObject({ outcome: "failed" });
  });
});
