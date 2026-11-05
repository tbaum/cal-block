import { DEFAULT_CONFIG } from "@cal-block/core";
import { describe, expect, it } from "vitest";
import type { AppState } from "../shared/api.ts";
import { trayIcon, trayMenu } from "./tray-menu.ts";

const now = new Date("2026-11-05T17:30:00.000Z");
const connected: AppState = {
  config: DEFAULT_CONFIG,
  google: { connected: true, clientId: "id", calendarId: "cal" },
  schedule: { running: false },
};
const status = (outcome: "ok" | "partial" | "failed", errors: string[] = [], finishedAt = "2026-11-05T17:05:00.000Z") => ({
  outcome,
  dryRun: false,
  startedAt: finishedAt,
  finishedAt,
  sources: [],
  counts: { created: 2, updated: 1, deleted: 3 },
  errors,
});
const labels = (state: AppState) => trayMenu(state, now).map((entry) => (entry.kind === "separator" ? "---" : entry.label));

describe("trayMenu", () => {
  it("shows the last successful run with counts", () => {
    expect(labels({ ...connected, status: status("ok") })).toEqual([
      "Letzter Sync 18:05: ok (+2 ~1 −3)",
      "---",
      "Jetzt synchronisieren",
      "Einstellungen…",
      "---",
      "Beenden",
    ]);
  });

  it("shows the date for runs on another day", () => {
    expect(labels({ ...connected, status: status("ok", [], "2026-11-04T08:00:00.000Z") })[0]).toBe("Letzter Sync 04.11. 09:00: ok (+2 ~1 −3)");
  });

  it("lists up to three errors, truncated", () => {
    const long = "x".repeat(80);
    const menu = labels({ ...connected, status: status("partial", ["a", "b", long, "d"]) });
    expect(menu.slice(0, 4)).toEqual(["Letzter Sync 18:05: teilweise fehlgeschlagen", "a", "b", `${"x".repeat(59)}…`]);
  });

  it("disables sync while running or when Google is not connected", () => {
    const syncEntry = (state: AppState) => trayMenu(state, now).find((entry) => entry.kind === "action" && entry.action === "syncNow");
    expect(syncEntry({ ...connected, schedule: { running: true } })).toMatchObject({ enabled: false });
    expect(labels({ ...connected, schedule: { running: true } })[0]).toBe("Synchronisiere …");
    expect(syncEntry({ ...connected, google: { connected: false } })).toMatchObject({ enabled: false });
    expect(labels({ ...connected, google: { connected: false } })[0]).toBe("Google nicht verbunden");
  });

  it("says when nothing ran yet", () => {
    expect(labels(connected)[0]).toBe("Noch nicht synchronisiert");
  });
});

describe("trayIcon", () => {
  it("switches to the error icon after a failed or partial run", () => {
    expect(trayIcon(connected)).toBe("normal");
    expect(trayIcon({ ...connected, status: status("ok") })).toBe("normal");
    expect(trayIcon({ ...connected, status: status("partial") })).toBe("error");
    expect(trayIcon({ ...connected, status: status("failed") })).toBe("error");
  });
});
