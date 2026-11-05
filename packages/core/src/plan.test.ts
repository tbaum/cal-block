import { describe, expect, it } from "vitest";
import { HORIZON_KEY, makeBlocker, type Blocker, type ExistingBlocker } from "./blockers.ts";
import { isEmptyPlan, planChanges } from "./plan.ts";

const blocker = (key: string, sourceId: string, start = "2026-11-10T13:00:00.000Z"): Blocker =>
  makeBlocker(key, sourceId, { title: "Busy", time: { allDay: false, start, end: "2026-11-10T15:00:00.000Z" } });
const existing = (b: Blocker, eventId = `ev-${b.key}`): ExistingBlocker => ({ ...b, eventId });
const sources = (...ids: string[]) => new Set(ids);

describe("planChanges", () => {
  it("creates missing blockers", () => {
    const plan = planChanges({ desired: [blocker("k1", "a")], existing: [], readSourceIds: sources("a"), activeSourceIds: sources("a") });
    expect(plan.create.map((b) => b.key)).toEqual(["k1"]);
  });

  it("updates a moved blocker instead of recreating it", () => {
    const plan = planChanges({
      desired: [blocker("k1", "a", "2026-11-10T14:00:00.000Z")],
      existing: [existing(blocker("k1", "a"))],
      readSourceIds: sources("a"),
      activeSourceIds: sources("a"),
    });
    expect(plan).toMatchObject({ create: [], delete: [], update: [{ eventId: "ev-k1" }] });
  });

  it("does nothing when nothing changed", () => {
    const plan = planChanges({
      desired: [blocker("k1", "a")],
      existing: [existing(blocker("k1", "a"))],
      readSourceIds: sources("a"),
      activeSourceIds: sources("a"),
    });
    expect(isEmptyPlan(plan)).toBe(true);
  });

  it("deletes blockers whose occurrence is gone", () => {
    const plan = planChanges({ desired: [], existing: [existing(blocker("k1", "a"))], readSourceIds: sources("a"), activeSourceIds: sources("a") });
    expect(plan.delete.map((b) => b.eventId)).toEqual(["ev-k1"]);
  });

  it("keeps blockers of a source that failed to read", () => {
    const plan = planChanges({ desired: [], existing: [existing(blocker("k1", "a"))], readSourceIds: sources(), activeSourceIds: sources("a") });
    expect(isEmptyPlan(plan)).toBe(true);
  });

  it("deletes blockers of a removed or disabled source", () => {
    const plan = planChanges({ desired: [], existing: [existing(blocker("k1", "gone"))], readSourceIds: sources(), activeSourceIds: sources("a") });
    expect(plan.delete.map((b) => b.eventId)).toEqual(["ev-k1"]);
  });

  it("deletes duplicate blockers with the same key", () => {
    const plan = planChanges({
      desired: [blocker("k1", "a")],
      existing: [existing(blocker("k1", "a"), "ev-1"), existing(blocker("k1", "a"), "ev-2")],
      readSourceIds: sources("a"),
      activeSourceIds: sources("a"),
    });
    expect(plan).toMatchObject({ create: [], update: [], delete: [{ eventId: "ev-2" }] });
  });

  it("creates one blocker for duplicate desired occurrences", () => {
    const plan = planChanges({ desired: [blocker("k1", "a"), blocker("k1", "a")], existing: [], readSourceIds: sources("a"), activeSourceIds: sources("a") });
    expect(plan.create).toHaveLength(1);
  });

  it("leaves the horizon block alone", () => {
    const plan = planChanges({ desired: [], existing: [existing(blocker(HORIZON_KEY, ""))], readSourceIds: sources(), activeSourceIds: sources() });
    expect(isEmptyPlan(plan)).toBe(true);
  });
});
