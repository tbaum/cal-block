import { describe, expect, it } from "vitest";
import { isRetryable, withRetry, type RetryPolicy } from "./retry.ts";

const httpError = (status: number, reason?: string) =>
  Object.assign(new Error(`HTTP ${status}`), { status, response: { status, data: { error: { errors: reason ? [{ reason }] : [] } } } });

function recordingPolicy(attempts = 5): RetryPolicy & { delays: number[] } {
  const delays: number[] = [];
  return { attempts, baseDelayMs: 100, delays, sleep: async (ms) => void delays.push(ms) };
}

describe("withRetry", () => {
  it("retries rate limits with exponential backoff", async () => {
    const policy = recordingPolicy();
    let calls = 0;
    const result = await withRetry(async () => {
      calls++;
      if (calls < 3) throw httpError(403, "rateLimitExceeded");
      return "ok";
    }, policy);
    expect(result).toBe("ok");
    expect(policy.delays).toEqual([100, 200]);
  });

  it("gives up after the configured attempts", async () => {
    const policy = recordingPolicy(3);
    await expect(withRetry(async () => Promise.reject(httpError(503)), policy)).rejects.toThrow("HTTP 503");
    expect(policy.delays).toHaveLength(2);
  });

  it("does not retry client errors", async () => {
    const policy = recordingPolicy();
    await expect(withRetry(async () => Promise.reject(httpError(400)), policy)).rejects.toThrow("HTTP 400");
    expect(policy.delays).toEqual([]);
  });
});

describe("isRetryable", () => {
  it("classifies errors", () => {
    expect(isRetryable(httpError(429))).toBe(true);
    expect(isRetryable(httpError(500))).toBe(true);
    expect(isRetryable(httpError(403, "userRateLimitExceeded"))).toBe(true);
    expect(isRetryable(httpError(403, "forbidden"))).toBe(false);
    expect(isRetryable(new Error("network"))).toBe(false);
  });
});
