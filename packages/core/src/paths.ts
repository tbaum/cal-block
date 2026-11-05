import { join } from "node:path";

export const APP_ID = "cal-block";

export function appPaths(home: string) {
  const appSupportDir = join(home, "Library", "Application Support", APP_ID);
  const logDir = join(home, "Library", "Logs", APP_ID);
  return {
    appSupportDir,
    configFile: join(appSupportDir, "config.json"),
    statusFile: join(appSupportDir, "status.json"),
    lockFile: join(appSupportDir, "sync.lock"),
    logDir,
    logFile: join(logDir, "sync.log"),
  };
}

export type AppPaths = ReturnType<typeof appPaths>;
