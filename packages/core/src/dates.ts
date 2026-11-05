export interface LocalDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

export interface TimeRange {
  readonly start: Date;
  readonly end: Date;
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
}

export function formatLocalDate(date: LocalDate): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.year}-${pad(date.month)}-${pad(date.day)}`;
}

export function parseLocalDate(text: string): LocalDate {
  const [year, month, day] = text.split("-").map(Number);
  return { year: year ?? NaN, month: month ?? NaN, day: day ?? NaN };
}

export function todayLocal(now: Date = new Date()): LocalDate {
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

export function localMidnight(date: LocalDate): Date {
  return new Date(date.year, date.month - 1, date.day);
}

export function overlaps(a: TimeRange, b: TimeRange): boolean {
  return a.start < b.end && a.end > b.start;
}
