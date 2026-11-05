import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appPaths, googleBlockerCalendar, inMemorySecretStore, loadConfig, type AppPaths, type GoogleCalendarsApi, type SecretStore } from "@cal-block/core";
import { calendar, fakeEvents, vevent } from "@cal-block/core/testing";
import { beforeEach, describe, expect, it } from "vitest";
import { createAppService, type AppServiceDeps } from "./app-service.ts";

const feed = calendar(vevent({ UID: "m", DTSTART: "20261110T130000Z", DTEND: "20261110T140000Z" }));

let paths: AppPaths;
let secrets: SecretStore;
let loginItem: boolean[];
let google: ReturnType<typeof fakeEvents>;

beforeEach(async () => {
  paths = appPaths(await mkdtemp(join(tmpdir(), "cal-block-app-")));
  secrets = inMemorySecretStore();
  loginItem = [];
  google = fakeEvents(100);
});

const calendarsApi = (created: string[]): GoogleCalendarsApi => ({
  get: async () => Promise.reject(Object.assign(new Error("Not Found"), { status: 404 })),
  insert: async ({ requestBody }) => (created.push(requestBody.summary ?? ""), { data: { id: "blocker-cal" } }),
});

function service(overrides: Partial<AppServiceDeps> = {}) {
  return createAppService({
    paths,
    secrets,
    openBrowser: async () => {},
    loginItem: { setEnabled: (enabled) => void loginItem.push(enabled) },
    now: () => new Date("2026-11-05T17:00:00.000Z"),
    readSourceTexts: async () => [feed],
    connectCalDav: async () => ({
      fetchCalendars: async () => [{ url: "https://cal/work/", displayName: "Work", components: ["VEVENT"] }],
      fetchCalendarObjects: async () => [],
    }),
    openCalendar: async () => googleBlockerCalendar(google.api, "blocker-cal", { attempts: 1, baseDelayMs: 0, sleep: async () => {} }),
    ...overrides,
  });
}

describe("AppService sources", () => {
  it("stores the source in the config and its URL in the Keychain", async () => {
    const app = service();
    await app.saveSource({ kind: "ics", name: " Work ", enabled: true, ownerEmails: ["me@example.com"], secret: "https://secret/work.ics" });
    const [source] = (await loadConfig(paths.configFile)).sources;
    expect(source).toMatchObject({ kind: "ics", name: "Work", ownerEmails: ["me@example.com"] });
    expect(await secrets.get(`source:${source?.id}`)).toBe("https://secret/work.ics");
  });

  it("requires the secret for a new source but keeps the stored one on edit", async () => {
    const app = service();
    await expect(app.saveSource({ kind: "ics", name: "Work", enabled: true, ownerEmails: [] })).rejects.toThrow("ICS-URL fehlt");
    await app.saveSource({ kind: "ics", name: "Work", enabled: true, ownerEmails: [], secret: "https://secret/work.ics" });
    const id = (await loadConfig(paths.configFile)).sources[0]?.id ?? "";
    await app.saveSource({ id, kind: "ics", name: "Work renamed", enabled: false, ownerEmails: [] });
    expect((await loadConfig(paths.configFile)).sources).toMatchObject([{ id, name: "Work renamed", enabled: false }]);
    expect(await secrets.get(`source:${id}`)).toBe("https://secret/work.ics");
  });

  it("removes the source and its secret", async () => {
    const app = service();
    await app.saveSource({ kind: "ics", name: "Work", enabled: true, ownerEmails: [], secret: "https://secret/work.ics" });
    const id = (await loadConfig(paths.configFile)).sources[0]?.id ?? "";
    await app.removeSource(id);
    expect((await loadConfig(paths.configFile)).sources).toEqual([]);
    expect(await secrets.get(`source:${id}`)).toBeUndefined();
  });

  it("tests a draft source and redacts its secret from errors", async () => {
    expect(await service().testSource({ kind: "ics", name: "Work", enabled: true, ownerEmails: [], secret: "https://secret/work.ics" })).toEqual({
      ok: true,
      busyOccurrences: 1,
    });
    const failing = service({ readSourceTexts: async () => Promise.reject(new Error("GET https://secret/work.ics: 404")) });
    expect(await failing.testSource({ kind: "ics", name: "Work", enabled: true, ownerEmails: [], secret: "https://secret/work.ics" })).toEqual({
      ok: false,
      error: "GET [redacted]: 404",
    });
  });

  it("discovers iCloud calendars", async () => {
    expect(await service().discoverIcloudCalendars({ appleId: "me@icloud.com", password: "app-pass" })).toEqual([{ url: "https://cal/work/", name: "Work" }]);
    await expect(service().discoverIcloudCalendars({ appleId: "me@icloud.com" })).rejects.toThrow("App-Passwort fehlt");
  });
});

describe("AppService Google", () => {
  it("connects, creates the blocker calendar and stores the tokens", async () => {
    const created: string[] = [];
    const app = service({ authorize: async () => "refresh-token", googleCalendars: () => calendarsApi(created) });
    await app.connectGoogle({ clientId: "client-id", clientSecret: "client-secret" });
    expect(created).toEqual(["Blocker"]);
    expect((await app.state()).google).toEqual({ connected: true, clientId: "client-id", calendarId: "blocker-cal" });
    expect(await secrets.get("google-refresh-token")).toBe("refresh-token");
    expect(await secrets.get("google-client-secret")).toBe("client-secret");
  });

  it("disconnects by dropping the refresh token", async () => {
    const app = service({ authorize: async () => "refresh-token", googleCalendars: () => calendarsApi([]) });
    await app.connectGoogle({ clientId: "client-id", clientSecret: "client-secret" });
    await app.disconnectGoogle();
    expect((await app.state()).google.connected).toBe(false);
  });

  it("refuses to connect without a client secret", async () => {
    await expect(service().connectGoogle({ clientId: "client-id" })).rejects.toThrow("Client-Secret");
  });
});

describe("AppService settings and sync", () => {
  it("saves settings and applies start at login", async () => {
    const app = service();
    await app.saveSettings({ horizonDays: 90, blockerTitle: "Blocked", syncIntervalMinutes: 30, startAtLogin: false });
    expect(await loadConfig(paths.configFile)).toMatchObject({ horizonDays: 90, blockerTitle: "Blocked", syncIntervalMinutes: 30, startAtLogin: false });
    expect(loginItem).toEqual([false]);
    expect(await app.intervalMs()).toBe(30 * 60_000);
  });

  it("rejects invalid settings without changing the config", async () => {
    const app = service();
    await expect(app.saveSettings({ horizonDays: 0, blockerTitle: "Busy", syncIntervalMinutes: 60, startAtLogin: true })).rejects.toThrow(/horizonDays/);
    expect((await loadConfig(paths.configFile)).horizonDays).toBe(60);
  });

  it("syncs, records the status and notifies listeners", async () => {
    const app = service();
    await app.saveSource({ kind: "ics", name: "Work", enabled: true, ownerEmails: [], secret: "https://secret/work.ics" });
    const notifications: string[] = [];
    app.onChange((kind) => notifications.push(kind));
    await app.sync();
    expect((await app.state()).status).toMatchObject({ outcome: "ok", counts: { created: 2 } });
    expect(await app.lastRunAt()).toEqual(new Date("2026-11-05T17:00:00.000Z"));
    expect(notifications).toEqual(["state"]);
  });

  it("reports config changes separately from state changes", async () => {
    const app = service({ authorize: async () => "refresh-token", googleCalendars: () => calendarsApi([]) });
    const notifications: string[] = [];
    app.onChange((kind) => notifications.push(kind));
    await app.connectGoogle({ clientId: "client-id", clientSecret: "client-secret" });
    await app.saveSource({ kind: "ics", name: "Work", enabled: true, ownerEmails: [], secret: "https://secret/work.ics" });
    await app.saveSettings({ horizonDays: 30, blockerTitle: "Busy", syncIntervalMinutes: 60, startAtLogin: true });
    const id = (await loadConfig(paths.configFile)).sources[0]?.id ?? "";
    await app.removeSource(id);
    await app.disconnectGoogle();
    expect(notifications).toEqual(["config", "config", "config", "config", "state"]);
  });
});
