import { parseArgs } from "node:util";

export interface CliOptions {
  readonly dryRun: boolean;
}

export function parseCliArgs(args: readonly string[]): CliOptions {
  const { values } = parseArgs({
    args: [...args],
    options: { "dry-run": { type: "boolean", default: false } },
    strict: true,
  });
  return { dryRun: values["dry-run"] };
}
