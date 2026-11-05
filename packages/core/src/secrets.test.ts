import { describe, expect, it } from "vitest";
import { inMemorySecretStore, secretAccounts } from "./secrets.ts";

describe("inMemorySecretStore", () => {
  it("stores, reads and removes secrets", async () => {
    const store = inMemorySecretStore();
    await store.set(secretAccounts.source("g"), "https://example.com/secret.ics");
    expect(await store.get("source:g")).toBe("https://example.com/secret.ics");
    await store.remove("source:g");
    expect(await store.get("source:g")).toBeUndefined();
  });
});
