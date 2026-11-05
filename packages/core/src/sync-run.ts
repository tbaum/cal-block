import { blockerFor, type Blocker } from "./blockers.ts";
import { isBusy } from "./busy.ts";
import { activeSources, type Config } from "./config.ts";
import { formatLocalDate, type LocalDate, type TimeRange } from "./dates.ts";
import type { BlockerCalendar } from "./google.ts";
import { planHorizonBlock, syncWindow, windowRange, type SyncWindow } from "./horizon.ts";
import { expandCalendar } from "./occurrences.ts";
import { mergePlans, planChanges, type ChangePlan } from "./plan.ts";
import { errorMessage } from "./redact.ts";
import type { SecretStore } from "./secrets.ts";
import type { SourceTextReader } from "./source-reader.ts";
import type { Source } from "./sources.ts";

export const RUN_TIMEOUT_MS = 10 * 60_000;

export type SyncOutcome = "ok" | "partial" | "failed";

export interface SourceResult {
  readonly id: string;
  readonly name: string;
  readonly ok: boolean;
  readonly busyOccurrences: number;
  readonly error?: string;
}

export interface ChangeCounts {
  readonly created: number;
  readonly updated: number;
  readonly deleted: number;
}

export interface SyncResult {
  readonly outcome: SyncOutcome;
  readonly dryRun: boolean;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly window?: { readonly start: string; readonly endExclusive: string };
  readonly sources: readonly SourceResult[];
  readonly counts: ChangeCounts;
  readonly errors: readonly string[];
  readonly plan?: ChangePlan;
}

export interface SyncRunInput {
  readonly config: Config;
  readonly secrets: SecretStore;
  readonly calendar: BlockerCalendar;
  readonly readSourceTexts: SourceTextReader;
  readonly today: LocalDate;
  readonly dryRun: boolean;
  readonly now?: () => Date;
}

interface SourceRead {
  readonly result: SourceResult;
  readonly blockers: readonly Blocker[];
}

export const NO_CHANGES: ChangeCounts = { created: 0, updated: 0, deleted: 0 };

export async function runSync(input: SyncRunInput): Promise<SyncResult> {
  const now = input.now ?? (() => new Date());
  const startedAt = now();
  const window = syncWindow(input.today, input.config.horizonDays);
  const reads = await Promise.all(activeSources(input.config).map((source) => readSource(source, input, windowRange(window))));
  const plan = await planRun(input, window, reads);
  const applied = input.dryRun ? { counts: plannedCounts(plan), errors: [] } : await applyPlan(input.calendar, plan, deadline(startedAt), now);
  const sourceErrors = reads.flatMap(({ result }) => (result.error ? [`${result.name}: ${result.error}`] : []));
  const errors = [...sourceErrors, ...applied.errors];
  return {
    outcome: errors.length === 0 ? "ok" : "partial",
    dryRun: input.dryRun,
    startedAt: startedAt.toISOString(),
    finishedAt: now().toISOString(),
    window: { start: formatLocalDate(window.start), endExclusive: formatLocalDate(window.endExclusive) },
    sources: reads.map(({ result }) => result),
    counts: applied.counts,
    errors,
    ...(input.dryRun && { plan }),
  };
}

export function failedResult(error: unknown, startedAt: Date, finishedAt: Date, dryRun: boolean): SyncResult {
  return {
    outcome: "failed",
    dryRun,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    sources: [],
    counts: NO_CHANGES,
    errors: [errorMessage(error)],
  };
}

async function readSource(source: Source, input: SyncRunInput, range: TimeRange): Promise<SourceRead> {
  try {
    const texts = await input.readSourceTexts(source, input.secrets, range);
    const busy = texts
      .flatMap((text) => expandCalendar(text, source.id, range))
      .filter((occurrence) => isBusy(occurrence, source.ownerEmails));
    return {
      result: { id: source.id, name: source.name, ok: true, busyOccurrences: busy.length },
      blockers: busy.map((occurrence) => blockerFor(occurrence, input.config.blockerTitle)),
    };
  } catch (error) {
    return { result: { id: source.id, name: source.name, ok: false, busyOccurrences: 0, error: errorMessage(error) }, blockers: [] };
  }
}

async function planRun(input: SyncRunInput, window: SyncWindow, reads: readonly SourceRead[]): Promise<ChangePlan> {
  const [existing, existingHorizon] = await Promise.all([input.calendar.listBlockers(window), input.calendar.listHorizonBlockers()]);
  return mergePlans(
    planChanges({
      desired: reads.flatMap((read) => read.blockers),
      existing,
      readSourceIds: new Set(reads.filter((read) => read.result.ok).map((read) => read.result.id)),
      activeSourceIds: new Set(activeSources(input.config).map((source) => source.id)),
    }),
    planHorizonBlock(existingHorizon, window, input.config.blockerTitle),
  );
}

async function applyPlan(
  calendar: BlockerCalendar,
  plan: ChangePlan,
  deadlineAt: Date,
  now: () => Date,
): Promise<{ counts: ChangeCounts; errors: string[] }> {
  const writes = [
    ...plan.delete.map((blocker) => ({ kind: "deleted" as const, run: () => calendar.remove(blocker.eventId) })),
    ...plan.update.map(({ eventId, blocker }) => ({ kind: "updated" as const, run: () => calendar.update(eventId, blocker) })),
    ...plan.create.map((blocker) => ({ kind: "created" as const, run: () => calendar.insert(blocker) })),
  ];
  const counts = { ...NO_CHANGES };
  const errors: string[] = [];
  for (const [index, write] of writes.entries()) {
    if (now() > deadlineAt) {
      errors.push(`run timed out, ${writes.length - index} changes left for the next run`);
      break;
    }
    try {
      await write.run();
      counts[write.kind]++;
    } catch (error) {
      errors.push(`${write.kind.replace(/d$/, "")} failed: ${errorMessage(error)}`);
    }
  }
  return { counts, errors };
}

function plannedCounts(plan: ChangePlan): ChangeCounts {
  return { created: plan.create.length, updated: plan.update.length, deleted: plan.delete.length };
}

function deadline(startedAt: Date): Date {
  return new Date(startedAt.getTime() + RUN_TIMEOUT_MS);
}
