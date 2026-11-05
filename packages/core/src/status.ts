import { appendFile, mkdir, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { readJsonIfExists, writeFileAtomic } from "./files.ts";
import type { ChangePlan } from "./plan.ts";
import type { SyncResult } from "./sync-run.ts";

export const LOG_LIMIT_BYTES = 1024 * 1024;

export type StoredStatus = Omit<SyncResult, "plan">;

export async function writeStatus(file: string, result: SyncResult): Promise<void> {
  const { plan: _plan, ...status } = result;
  await writeFileAtomic(file, `${JSON.stringify(status, null, 2)}\n`);
}

export async function readStatus(file: string): Promise<StoredStatus | undefined> {
  return (await readJsonIfExists(file)) as StoredStatus | undefined;
}

export async function appendLog(file: string, lines: readonly string[]): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  const content = lines.map((line) => `${line}\n`).join("");
  if ((await fileSize(file)) + content.length > LOG_LIMIT_BYTES) await writeFile(file, content);
  else await appendFile(file, content);
}

export function summaryLine(result: SyncResult): string {
  const { created, updated, deleted } = result.counts;
  const verb = result.dryRun ? "planned" : "applied";
  return `${result.finishedAt} ${result.outcome}${result.dryRun ? " (dry-run)" : ""}: ${verb} +${created} ~${updated} -${deleted}`;
}

export function logLines(result: SyncResult): string[] {
  return [summaryLine(result), ...result.errors.map((error) => `  error: ${error}`)];
}

export function planLines(plan: ChangePlan): string[] {
  return [
    ...plan.create.map((blocker) => `+ ${describeTime(blocker.time)} [${blocker.sourceId || "horizon"}]`),
    ...plan.update.map(({ blocker }) => `~ ${describeTime(blocker.time)} [${blocker.sourceId || "horizon"}]`),
    ...plan.delete.map((blocker) => `- ${describeTime(blocker.time)} [${blocker.sourceId || "horizon"}]`),
  ];
}

function describeTime(time: ChangePlan["create"][number]["time"]): string {
  return time.allDay ? `${time.startDate} – ${time.endDate} (all day)` : `${time.start} – ${time.end}`;
}

async function fileSize(file: string): Promise<number> {
  return stat(file).then(
    (stats) => stats.size,
    () => 0,
  );
}
