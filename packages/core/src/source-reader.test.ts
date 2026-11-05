import { describe, expect, it } from "vitest";
import type { CalDavClient } from "./icloud.ts";
import { inMemorySecretStore } from "./secrets.ts";
import { sourceTextReader } from "./source-reader.ts";
import type { Source } from "./sources.ts";

const range = { start: new Date("2026-11-04T23:00:00.000Z"), end: new Date("2027-01-03T23:00:00.000Z") };
const ics: Source = { id: "g", name: "Google", kind: "ics", enabled: true, ownerEmails: [] };
const icloud: Source = { id: "i", name: "iCloud", kind: "icloud", enabled: true, ownerEmails: [], appleId: "me@icloud.com", calendarUrls: ["https://cal/work/"] };

const calDav: CalDavClient = {
  fetchCalendars: async () => [{ url: "https://cal/work/", components: ["VEVENT"] }],
  fetchCalendarObjects: async () => [{ url: "https://cal/work/a.ics", data: "ICLOUD-ICS" }],
};

describe("sourceTextReader", () => {
  it("downloads ICS sources with the URL from the Keychain", async () => {
    const urls: string[] = [];
    const read = sourceTextReader({ downloadIcs: async (url) => (urls.push(url), "ICS"), connectCalDav: async () => calDav });
    expect(await read(ics, inMemorySecretStore({ "source:g": "https://secret/basic.ics" }), range)).toEqual(["ICS"]);
    expect(urls).toEqual(["https://secret/basic.ics"]);
  });

  it("connects to iCloud with the app-specific password", async () => {
    const logins: string[][] = [];
    const read = sourceTextReader({ downloadIcs: async () => "", connectCalDav: async (...login) => (logins.push(login), calDav) });
    expect(await read(icloud, inMemorySecretStore({ "source:i": "app-pass" }), range)).toEqual(["ICLOUD-ICS"]);
    expect(logins).toEqual([["me@icloud.com", "app-pass"]]);
  });

  it("fails clearly when the secret is missing", async () => {
    const read = sourceTextReader({ downloadIcs: async () => "", connectCalDav: async () => calDav });
    await expect(read(ics, inMemorySecretStore(), range)).rejects.toThrow("ICS URL missing in Keychain");
    await expect(read(icloud, inMemorySecretStore(), range)).rejects.toThrow("app-specific password missing in Keychain");
  });
});
