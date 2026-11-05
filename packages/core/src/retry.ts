export interface RetryPolicy {
  readonly attempts: number;
  readonly baseDelayMs: number;
  readonly sleep: (ms: number) => Promise<void>;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  attempts: 5,
  baseDelayMs: 1000,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

const RATE_LIMIT_REASONS = new Set(["rateLimitExceeded", "userRateLimitExceeded"]);

export async function withRetry<T>(operation: () => Promise<T>, policy: RetryPolicy = DEFAULT_RETRY_POLICY): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= policy.attempts || !isRetryable(error)) throw error;
      await policy.sleep(policy.baseDelayMs * 2 ** (attempt - 1));
    }
  }
}

export function isRetryable(error: unknown): boolean {
  const status = httpStatus(error);
  if (status === undefined) return false;
  return status === 429 || status >= 500 || (status === 403 && RATE_LIMIT_REASONS.has(errorReason(error) ?? ""));
}

export function httpStatus(error: unknown): number | undefined {
  const candidate = error as { status?: unknown; response?: { status?: unknown } } | null;
  const status = candidate?.status ?? candidate?.response?.status;
  return typeof status === "number" ? status : undefined;
}

function errorReason(error: unknown): string | undefined {
  const candidate = error as { response?: { data?: { error?: { errors?: { reason?: unknown }[] } } } } | null;
  const reason = candidate?.response?.data?.error?.errors?.[0]?.reason;
  return typeof reason === "string" ? reason : undefined;
}
