export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export const ICS_FETCH_TIMEOUT_MS = 30_000;

export async function fetchIcs(url: string, fetchImpl: FetchLike = fetch): Promise<string> {
  const response = await fetchImpl(normalizeIcsUrl(url), {
    headers: { accept: "text/calendar" },
    signal: AbortSignal.timeout(ICS_FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`ICS download failed: HTTP ${response.status}`);
  return response.text();
}

export function normalizeIcsUrl(url: string): string {
  return url.replace(/^webcal:\/\//i, "https://");
}
