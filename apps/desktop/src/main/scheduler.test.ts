import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SyncScheduler } from "./scheduler.ts";

const HOUR = 60 * 60_000;

function harness(options: { lastRunAt?: Date; interval?: number; failing?: boolean } = {}) {
  let lastRunAt = options.lastRunAt;
  let interval = options.interval ?? HOUR;
  const runs: Date[] = [];
  let release: (() => void) | undefined;
  let blockNextRun = false;
  const scheduler = new SyncScheduler({
    run: async () => {
      runs.push(new Date());
      if (blockNextRun) await new Promise<void>((resolve) => (release = resolve));
      if (options.failing) throw new Error("boom");
      lastRunAt = new Date();
    },
    intervalMs: async () => interval,
    lastRunAt: async () => lastRunAt,
    onError: () => {},
  });
  return {
    scheduler,
    runs,
    setInterval: (ms: number) => (interval = ms),
    block: () => (blockNextRun = true),
    release: () => {
      blockNextRun = false;
      release?.();
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-05T17:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("SyncScheduler", () => {
  it("runs at start and then every interval", async () => {
    const { scheduler, runs } = harness();
    await scheduler.start();
    expect(runs).toHaveLength(1);
    expect(scheduler.info().nextRunAt).toBe("2026-11-05T18:00:00.000Z");
    await vi.advanceTimersByTimeAsync(HOUR);
    expect(runs).toHaveLength(2);
    scheduler.stop();
  });

  it("does not start a second run while one is active", async () => {
    const h = harness();
    h.block();
    const first = h.scheduler.runNow();
    await vi.advanceTimersByTimeAsync(0);
    expect(h.scheduler.info().running).toBe(true);
    const second = h.scheduler.runNow();
    expect(second).toBe(first);
    h.release();
    await first;
    expect(h.runs).toHaveLength(1);
    expect(h.scheduler.info().running).toBe(false);
    h.scheduler.stop();
  });

  it("runs on wake only when the last run is overdue", async () => {
    const h = harness({ lastRunAt: new Date("2026-11-05T16:30:00.000Z") });
    await h.scheduler.onWake();
    expect(h.runs).toHaveLength(0);
    expect(h.scheduler.info().nextRunAt).toBe("2026-11-05T17:30:00.000Z");
    vi.setSystemTime(new Date("2026-11-05T19:00:00.000Z"));
    await h.scheduler.onWake();
    expect(h.runs).toHaveLength(1);
    h.scheduler.stop();
  });

  it("re-arms with a changed interval", async () => {
    const h = harness();
    await h.scheduler.start();
    h.setInterval(30 * 60_000);
    await h.scheduler.rearm();
    expect(h.scheduler.info().nextRunAt).toBe("2026-11-05T17:30:00.000Z");
    h.scheduler.stop();
  });

  it("waits a full interval after a failed run instead of retrying immediately", async () => {
    const h = harness({ failing: true });
    await h.scheduler.start();
    expect(h.scheduler.info().nextRunAt).toBe("2026-11-05T18:00:00.000Z");
    await vi.advanceTimersByTimeAsync(HOUR - 1);
    expect(h.runs).toHaveLength(1);
    h.scheduler.stop();
  });

  it("runs soon when idle", async () => {
    const h = harness();
    h.scheduler.runSoon();
    await vi.advanceTimersByTimeAsync(0);
    expect(h.runs).toHaveLength(1);
    h.scheduler.stop();
  });

  it("runs once more after the active run when asked to run soon", async () => {
    const h = harness();
    h.block();
    const first = h.scheduler.runNow();
    await vi.advanceTimersByTimeAsync(0);
    h.scheduler.runSoon();
    h.scheduler.runSoon();
    h.release();
    await first;
    await vi.advanceTimersByTimeAsync(0);
    expect(h.runs).toHaveLength(2);
    h.scheduler.stop();
  });

  it("stops scheduling after stop", async () => {
    const h = harness();
    await h.scheduler.start();
    h.scheduler.stop();
    await vi.advanceTimersByTimeAsync(3 * HOUR);
    expect(h.runs).toHaveLength(1);
  });
});
