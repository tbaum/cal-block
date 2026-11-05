import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { makeBlocker } from "./blockers.ts";
import { appendLog, LOG_LIMIT_BYTES, planLines, readStatus, writeStatus } from "./status.ts";
import type { SyncResult } from "./sync-run.ts";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "cal-block-status-"));
});

const result: SyncResult = {
  outcome: "ok",
  dryRun: false,
  startedAt: "2026-11-05T17:00:00.000Z",
  finishedAt: "2026-11-05T17:00:02.000Z",
  sources: [],
  counts: { created: 1, updated: 0, deleted: 0 },
  errors: [],
  plan: { create: [], update: [], delete: [] },
};

describe("status file", () => {
  it("round-trips the result without the plan", async () => {
    const file = join(dir, "status.json");
    await writeStatus(file, result);
    const { plan: _plan, ...expected } = result;
    expect(await readStatus(file)).toEqual(expected);
  });

  it("is undefined before the first run", async () => {
    expect(await readStatus(join(dir, "missing.json"))).toBeUndefined();
  });
});

describe("appendLog", () => {
  it("appends lines and starts over above the size limit", async () => {
    const file = join(dir, "logs", "sync.log");
    await appendLog(file, ["one"]);
    await appendLog(file, ["two"]);
    expect(await readFile(file, "utf8")).toBe("one\ntwo\n");
    await writeFile(file, "x".repeat(LOG_LIMIT_BYTES));
    await appendLog(file, ["fresh"]);
    expect((await stat(file)).size).toBe("fresh\n".length);
  });
});

describe("planLines", () => {
  it("describes planned changes", () => {
    const timed = makeBlocker("k", "work", { title: "Busy", time: { allDay: false, start: "2026-11-10T13:00:00.000Z", end: "2026-11-10T14:00:00.000Z" } });
    const allDay = makeBlocker("horizon", "", { title: "Busy", time: { allDay: true, startDate: "2027-01-04", endDate: "2027-01-05" } });
    expect(planLines({ create: [timed], update: [{ eventId: "e", blocker: allDay }], delete: [{ ...timed, eventId: "d" }] })).toEqual([
      "+ 2026-11-10T13:00:00.000Z – 2026-11-10T14:00:00.000Z [work]",
      "~ 2027-01-04 – 2027-01-05 (all day) [horizon]",
      "- 2026-11-10T13:00:00.000Z – 2026-11-10T14:00:00.000Z [work]",
    ]);
  });
});
