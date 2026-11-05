import { DEFAULT_CONFIG, formatLocalDate, horizonBlockStart, syncWindow, todayLocal } from "@cal-block/core";
import { parseCliArgs } from "./cli.ts";

const options = parseCliArgs(process.argv.slice(2));
const window = syncWindow(todayLocal(), DEFAULT_CONFIG.horizonDays);

console.log(
  `cal-block sync${options.dryRun ? " (dry-run)" : ""}: window ${formatLocalDate(window.start)} – ${formatLocalDate(window.endExclusive)}, horizon block from ${formatLocalDate(horizonBlockStart(window))}`,
);
