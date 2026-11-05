import type { ScheduleInfo } from "../shared/api.ts";

export interface SchedulerDeps {
  readonly run: () => Promise<void>;
  readonly intervalMs: () => Promise<number>;
  readonly lastRunAt: () => Promise<Date | undefined>;
  readonly now?: () => Date;
  readonly onChange?: () => void;
  readonly onError?: (error: unknown) => void;
}

export class SyncScheduler {
  readonly #deps: SchedulerDeps;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #current: Promise<void> | undefined;
  #lastAttemptAt: Date | undefined;
  #nextRunAt: Date | undefined;
  #stopped = false;

  constructor(deps: SchedulerDeps) {
    this.#deps = deps;
  }

  info(): ScheduleInfo {
    return { running: this.#current !== undefined, ...(this.#nextRunAt && { nextRunAt: this.#nextRunAt.toISOString() }) };
  }

  start(): Promise<void> {
    return this.runNow();
  }

  runNow(): Promise<void> {
    this.#current ??= this.#runOnce();
    return this.#current;
  }

  async onWake(): Promise<void> {
    if ((await this.#dueAt()) <= this.#now()) await this.runNow();
    else await this.rearm();
  }

  async rearm(): Promise<void> {
    this.#clearTimer();
    if (this.#stopped || this.#current) return;
    const delay = Math.max(0, (await this.#dueAt()).getTime() - this.#now().getTime());
    this.#nextRunAt = new Date(this.#now().getTime() + delay);
    this.#timer = setTimeout(() => void this.runNow(), delay);
    this.#deps.onChange?.();
  }

  stop(): void {
    this.#stopped = true;
    this.#clearTimer();
  }

  async #runOnce(): Promise<void> {
    this.#clearTimer();
    this.#lastAttemptAt = this.#now();
    this.#deps.onChange?.();
    try {
      await this.#deps.run();
    } catch (error) {
      this.#deps.onError?.(error);
    } finally {
      this.#current = undefined;
      await this.rearm();
    }
  }

  async #dueAt(): Promise<Date> {
    const [interval, lastRun] = await Promise.all([this.#deps.intervalMs(), this.#deps.lastRunAt()]);
    const latest = Math.max(lastRun?.getTime() ?? 0, this.#lastAttemptAt?.getTime() ?? 0);
    return new Date(latest + interval);
  }

  #clearTimer(): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#nextRunAt = undefined;
  }

  #now(): Date {
    return this.#deps.now?.() ?? new Date();
  }
}
