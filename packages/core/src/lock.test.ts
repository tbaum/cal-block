import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { AlreadyRunningError, withLock } from "./lock.ts";

let lockFile: string;

beforeEach(async () => {
  lockFile = join(await mkdtemp(join(tmpdir(), "cal-block-lock-")), "app", "sync.lock");
});

describe("withLock", () => {
  it("runs the task holding the lock and releases it", async () => {
    const seen = await withLock(lockFile, () => readFile(lockFile, "utf8"));
    expect(seen).toBe(String(process.pid));
    await expect(readFile(lockFile)).rejects.toThrow();
  });

  it("refuses a second run while a live process holds the lock", async () => {
    await withLock(lockFile, async () => {
      await expect(withLock(lockFile, async () => "second")).rejects.toBeInstanceOf(AlreadyRunningError);
    });
  });

  it("takes over a lock left by a dead process", async () => {
    await withLock(lockFile, async () => {});
    await writeFile(lockFile, "999999");
    expect(await withLock(lockFile, async () => "ran")).toBe("ran");
  });

  it("releases the lock when the task fails", async () => {
    await expect(withLock(lockFile, async () => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    expect(await withLock(lockFile, async () => "again")).toBe("again");
  });
});
