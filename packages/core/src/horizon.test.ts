import { describe, expect, it } from "vitest";
import { formatLocalDate } from "./dates.ts";
import { DEFAULT_HORIZON_DAYS, horizonBlockStart, syncWindow } from "./horizon.ts";

const nov5 = { year: 2026, month: 11, day: 5 };
const nov6 = { year: 2026, month: 11, day: 6 };

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
