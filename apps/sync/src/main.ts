import { homedir } from "node:os";
import { AlreadyRunningError, appPaths, keychainSecretStore, planLines, summaryLine, syncOnce, type SyncResult } from "@cal-block/core";
import { parseCliArgs } from "./cli.ts";

const EXIT_CODES = { ok: 0, failed: 1, partial: 2 } as const;

async function main(): Promise<number> {
  const options = parseCliArgs(process.argv.slice(2));
  try {
    const result = await syncOnce({ paths: appPaths(homedir()), secrets: keychainSecretStore(), dryRun: options.dryRun });
    printResult(result);
    return EXIT_CODES[result.outcome];
  } catch (error) {
    if (!(error instanceof AlreadyRunningError)) throw error;
    console.log(error.message);
    return 0;
  }
}

function printResult(result: SyncResult): void {
  for (const line of result.plan ? planLines(result.plan) : []) console.log(line);
  console.log(summaryLine(result));
  for (const error of result.errors) console.error(`error: ${error}`);
}

void main().then((code) => {
  process.exitCode = code;
});
