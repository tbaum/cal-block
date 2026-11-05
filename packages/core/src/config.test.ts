import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { ConfigError, DEFAULT_CONFIG, activeSources, loadConfig, saveConfig, type Config } from "./config.ts";

let configFile: string;

beforeEach(async () => {
  configFile = join(await mkdtemp(join(tmpdir(), "cal-block-config-")), "nested", "config.json");
});

describe("loadConfig", () => {
  it("returns defaults when the file is missing", async () => {
    expect(await loadConfig(configFile)).toEqual(DEFAULT_CONFIG);
    expect(DEFAULT_CONFIG).toMatchObject({ horizonDays: 60, blockerTitle: "Busy", syncIntervalMinutes: 60, startAtLogin: true, sources: [] });
  });

  it("fills defaults into a partial file", async () => {
    await saveConfig(configFile, DEFAULT_CONFIG);
    await writeFile(configFile, JSON.stringify({ horizonDays: 90, sources: [{ id: "g", name: "Google", kind: "ics" }] }));
    expect(await loadConfig(configFile)).toMatchObject({
      horizonDays: 90,
      blockerTitle: "Busy",
      sources: [{ id: "g", enabled: true, ownerEmails: [] }],
    });
  });

  it("rejects an invalid horizon", async () => {
    await saveConfig(configFile, DEFAULT_CONFIG);
    await writeFile(configFile, JSON.stringify({ horizonDays: 0 }));
    await expect(loadConfig(configFile)).rejects.toBeInstanceOf(ConfigError);
  });

  it("rejects duplicate source ids", async () => {
    await saveConfig(configFile, DEFAULT_CONFIG);
    const source = { id: "g", name: "Google", kind: "ics" };
    await writeFile(configFile, JSON.stringify({ sources: [source, source] }));
    await expect(loadConfig(configFile)).rejects.toThrow(/unique/);
  });

  it("requires an Apple ID for iCloud sources", async () => {
    await saveConfig(configFile, DEFAULT_CONFIG);
    await writeFile(configFile, JSON.stringify({ sources: [{ id: "i", name: "iCloud", kind: "icloud" }] }));
    await expect(loadConfig(configFile)).rejects.toBeInstanceOf(ConfigError);
  });
});

describe("saveConfig", () => {
  it("round-trips and creates the directory", async () => {
    const config: Config = {
      ...DEFAULT_CONFIG,
      sources: [{ id: "i", name: "iCloud", kind: "icloud", enabled: false, ownerEmails: ["me@example.com"], appleId: "me@icloud.com", calendarUrls: [] }],
    };
    await saveConfig(configFile, config);
    expect(await loadConfig(configFile)).toEqual(config);
    expect(await readFile(configFile, "utf8")).toMatch(/\n$/);
  });
});

describe("activeSources", () => {
  it("returns enabled sources only", () => {
    const config: Config = {
      ...DEFAULT_CONFIG,
      sources: [
        { id: "a", name: "A", kind: "ics", enabled: true, ownerEmails: [] },
        { id: "b", name: "B", kind: "ics", enabled: false, ownerEmails: [] },
      ],
    };
    expect(activeSources(config).map((s) => s.id)).toEqual(["a"]);
  });
});
