import { describe, expect, it } from "vitest";
import { parseCliArgs } from "./cli.ts";

describe("parseCliArgs", () => {
  it("defaults to a writing run", () => {
    expect(parseCliArgs([])).toEqual({ dryRun: false });
  });

  it("recognises --dry-run", () => {
    expect(parseCliArgs(["--dry-run"])).toEqual({ dryRun: true });
  });

  it("rejects unknown flags", () => {
    expect(() => parseCliArgs(["--force"])).toThrow();
  });
});
