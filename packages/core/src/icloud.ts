import { createDAVClient, type DAVCalendar, type DAVCalendarObject } from "tsdav";
import type { TimeRange } from "./dates.ts";

export const ICLOUD_CALDAV_URL = "https://caldav.icloud.com";

export interface CalDavClient {
  fetchCalendars(): Promise<DAVCalendar[]>;
  fetchCalendarObjects(params: { calendar: DAVCalendar; timeRange: { start: string; end: string } }): Promise<DAVCalendarObject[]>;
}

export interface CalendarSummary {
  readonly url: string;
  readonly name: string;
}

export function connectIcloud(appleId: string, appPassword: string): Promise<CalDavClient> {
  return createDAVClient({
    serverUrl: ICLOUD_CALDAV_URL,
    credentials: { username: appleId, password: appPassword },
    authMethod: "Basic",
    defaultAccountType: "caldav",
  });
}

export async function discoverEventCalendars(client: CalDavClient): Promise<CalendarSummary[]> {
  const calendars = await client.fetchCalendars();
  return calendars.filter(supportsEvents).map((calendar) => ({ url: calendar.url, name: displayName(calendar) }));
}

export async function fetchIcloudCalendarTexts(
  client: CalDavClient,
  calendarUrls: readonly string[],
  range: TimeRange,
): Promise<string[]> {
  const calendars = await client.fetchCalendars();
  const timeRange = { start: range.start.toISOString(), end: range.end.toISOString() };
  const objects = await Promise.all(
    calendarUrls.map((url) => client.fetchCalendarObjects({ calendar: findCalendar(calendars, url), timeRange })),
  );
  return objects.flat().flatMap((object) => (typeof object.data === "string" ? [object.data] : []));
}

function findCalendar(calendars: readonly DAVCalendar[], url: string): DAVCalendar {
  const calendar = calendars.find((candidate) => sameUrl(candidate.url, url));
  if (!calendar) throw new Error(`iCloud calendar not found: ${url}`);
  return calendar;
}

function sameUrl(a: string, b: string): boolean {
  return a.replace(/\/+$/, "") === b.replace(/\/+$/, "");
}

function supportsEvents(calendar: DAVCalendar): boolean {
  return calendar.components?.includes("VEVENT") ?? false;
}

function displayName(calendar: DAVCalendar): string {
  return typeof calendar.displayName === "string" && calendar.displayName !== "" ? calendar.displayName : calendar.url;
}
