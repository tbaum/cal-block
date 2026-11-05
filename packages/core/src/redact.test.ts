import { describe, expect, it } from "vitest";
import { recordingSecretStore, redact } from "./redact.ts";
import { inMemorySecretStore } from "./secrets.ts";

describe("redact", () => {
  it("replaces every revealed secret", () => {
    expect(redact("GET https://x/abcd1234/basic.ics failed for abcd1234", ["abcd1234"])).toBe(
      "GET https://x/[redacted]/basic.ics failed for [redacted]",
    );
  });

  it("replaces longer secrets first", () => {
    expect(redact("https://x/secret-long", ["secret", "https://x/secret-long"])).toBe("[redacted]");
  });
});

describe("recordingSecretStore", () => {
  it("remembers the values it handed out", async () => {
    const store = recordingSecretStore(inMemorySecretStore({ a: "value-a", b: "value-b" }));
    await store.get("a");
    await store.get("missing");
    expect([...store.revealed]).toEqual(["value-a"]);
  });
});
