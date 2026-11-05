import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export class AlreadyRunningError extends Error {
  constructor(readonly pid: number) {
    super(`sync already running (pid ${pid})`);
    this.name = "AlreadyRunningError";
  }
}

export async function withLock<T>(lockFile: string, task: () => Promise<T>): Promise<T> {
  await acquireLock(lockFile);
  try {
    return await task();
  } finally {
    await unlink(lockFile).catch(() => {});
  }
}

async function acquireLock(lockFile: string): Promise<void> {
  await mkdir(dirname(lockFile), { recursive: true });
  try {
    await writeFile(lockFile, String(process.pid), { flag: "wx" });
  } catch (error) {
    if (!isAlreadyExists(error)) throw error;
    const holder = await lockHolder(lockFile);
    if (holder !== undefined && isAlive(holder)) throw new AlreadyRunningError(holder);
    await unlink(lockFile).catch(() => {});
    await writeFile(lockFile, String(process.pid), { flag: "wx" });
  }
}

async function lockHolder(lockFile: string): Promise<number | undefined> {
  const pid = Number.parseInt(await readFile(lockFile, "utf8").catch(() => ""), 10);
  return Number.isInteger(pid) && pid > 0 ? pid : undefined;
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error instanceof Error && "code" in error && error.code === "EPERM";
  }
}

function isAlreadyExists(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "EEXIST";
}
