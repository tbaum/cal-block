import { describe, expect, it } from "vitest";
import type { ExistingBlocker } from "./blockers.ts";
import { formatLocalDate } from "./dates.ts";
import { DEFAULT_HORIZON_DAYS, horizonBlocker, horizonBlockStart, planHorizonBlock, syncWindow } from "./horizon.ts";
import { isEmptyPlan } from "./plan.ts";

const nov5 = { year: 2026, month: 11, day: 5 };
const nov6 = { year: 2026, month: 11, day: 6 };
const asExisting = (eventId: string, blocker = horizonBlocker(syncWindow(nov5, 60), "Busy")): ExistingBlocker => ({ ...blocker, eventId });

describe("syncWindow", () => {
  it("spans the default horizon from the start of today", () => {
    const window = syncWindow(nov5, DEFAULT_HORIZON_DAYS);
    expect(formatLocalDate(window.start)).toBe("2026-11-05");
    expect(formatLocalDate(window.endExclusive)).toBe("2027-01-04");
  });

  it("starts the beyond-horizon block on the first day after the window", () => {
    expect(formatLocalDate(horizonBlockStart(syncWindow(nov5, 60)))).toBe("2027-01-04");
    expect(formatLocalDate(horizonBlockStart(syncWindow(nov6, 60)))).toBe("2027-01-05");
  });
});

describe("horizonBlocker", () => {
  it("is a daily recurring all-day blocker from the horizon start", () => {
    expect(horizonBlocker(syncWindow(nov5, 60), "Busy")).toMatchObject({
      key: "horizon",
      time: { allDay: true, startDate: "2027-01-04", endDate: "2027-01-05" },
      recurrence: ["RRULE:FREQ=DAILY"],
    });
  });
});

describe("planHorizonBlock", () => {
  it("creates the block when missing", () => {
    expect(planHorizonBlock([], syncWindow(nov5, 60), "Busy").create).toHaveLength(1);
  });

  it("does nothing on the same day", () => {
    expect(isEmptyPlan(planHorizonBlock([asExisting("h1")], syncWindow(nov5, 60), "Busy"))).toBe(true);
  });

  it("moves the block start on the next day", () => {
    const plan = planHorizonBlock([asExisting("h1")], syncWindow(nov6, 60), "Busy");
    expect(plan.update).toMatchObject([{ eventId: "h1", blocker: { time: { startDate: "2027-01-05" } } }]);
  });

  it("removes extra horizon blocks", () => {
    const plan = planHorizonBlock([asExisting("h1"), asExisting("h2")], syncWindow(nov5, 60), "Busy");
    expect(plan.delete.map((b) => b.eventId)).toEqual(["h2"]);
  });
});
