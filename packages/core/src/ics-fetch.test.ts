import { describe, expect, it } from "vitest";
import { fetchIcs, normalizeIcsUrl } from "./ics-fetch.ts";

describe("fetchIcs", () => {
  it("fetches webcal URLs over https", async () => {
    const requested: string[] = [];
    const text = await fetchIcs("webcal://example.com/secret/basic.ics", async (url) => {
      requested.push(url);
      return new Response("BEGIN:VCALENDAR");
    });
    expect(requested).toEqual(["https://example.com/secret/basic.ics"]);
    expect(text).toBe("BEGIN:VCALENDAR");
  });

  it("reports HTTP errors without leaking the secret URL", async () => {
    const failing = fetchIcs("https://example.com/private-token/basic.ics", async () => new Response("", { status: 404 }));
    await expect(failing).rejects.toThrow("ICS download failed: HTTP 404");
    await expect(failing).rejects.not.toThrow(/private-token/);
  });

  it("leaves https URLs untouched", () => {
    expect(normalizeIcsUrl("https://example.com/a.ics")).toBe("https://example.com/a.ics");
  });
});
