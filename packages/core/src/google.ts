import { calendar, type calendar_v3 } from "@googleapis/calendar";
import type { OAuth2Client } from "google-auth-library";
import { HORIZON_KEY, type Blocker, type ExistingBlocker } from "./blockers.ts";
import { eventBody, existingBlocker, MARKER_PROPERTY } from "./google-events.ts";
import { windowRange, type SyncWindow } from "./horizon.ts";
import { DEFAULT_RETRY_POLICY, httpStatus, withRetry, type RetryPolicy } from "./retry.ts";

export const BLOCKER_CALENDAR_NAME = "Blocker";

export interface BlockerCalendar {
  listBlockers(window: SyncWindow): Promise<ExistingBlocker[]>;
  listHorizonBlockers(): Promise<ExistingBlocker[]>;
  insert(blocker: Blocker): Promise<void>;
  update(eventId: string, blocker: Blocker): Promise<void>;
  remove(eventId: string): Promise<void>;
}

export interface GoogleEventsApi {
  list(params: calendar_v3.Params$Resource$Events$List): Promise<{ data: calendar_v3.Schema$Events }>;
  insert(params: calendar_v3.Params$Resource$Events$Insert): Promise<unknown>;
  update(params: calendar_v3.Params$Resource$Events$Update): Promise<unknown>;
  delete(params: calendar_v3.Params$Resource$Events$Delete): Promise<unknown>;
}

export interface GoogleCalendarsApi {
  get(params: { calendarId: string }): Promise<{ data: calendar_v3.Schema$Calendar }>;
  insert(params: { requestBody: calendar_v3.Schema$Calendar }): Promise<{ data: calendar_v3.Schema$Calendar }>;
}

export interface GoogleApis {
  readonly events: GoogleEventsApi;
  readonly calendars: GoogleCalendarsApi;
}

export function googleApis(auth: OAuth2Client): GoogleApis {
  const api = calendar({ version: "v3", auth });
  return {
    events: {
      list: (params) => api.events.list(params),
      insert: (params) => api.events.insert(params),
      update: (params) => api.events.update(params),
      delete: (params) => api.events.delete(params),
    },
    calendars: {
      get: (params) => api.calendars.get(params),
      insert: (params) => api.calendars.insert(params),
    },
  };
}

export function googleBlockerCalendar(
  events: GoogleEventsApi,
  calendarId: string,
  retry: RetryPolicy = DEFAULT_RETRY_POLICY,
): BlockerCalendar {
  const call = <T>(operation: () => Promise<T>) => withRetry(operation, retry);
  const listMarked = (properties: string[], timeMin?: Date) => listAllBlockers(events, calendarId, properties, timeMin, retry);
  return {
    listBlockers: async (window) =>
      (await listMarked([MARKER_PROPERTY], windowRange(window).start)).filter((blocker) => blocker.key !== HORIZON_KEY),
    listHorizonBlockers: () => listMarked([MARKER_PROPERTY, `calblockKey=${HORIZON_KEY}`]),
    insert: async (blocker) => {
      await call(() => events.insert({ calendarId, requestBody: eventBody(blocker) }));
    },
    update: async (eventId, blocker) => {
      await call(() => events.update({ calendarId, eventId, requestBody: eventBody(blocker) }));
    },
    remove: async (eventId) => {
      await call(() => events.delete({ calendarId, eventId })).catch(ignoreAlreadyGone);
    },
  };
}

export async function ensureBlockerCalendar(calendars: GoogleCalendarsApi, storedCalendarId?: string): Promise<string> {
  if (storedCalendarId && (await calendarExists(calendars, storedCalendarId))) return storedCalendarId;
  const { data } = await calendars.insert({ requestBody: { summary: BLOCKER_CALENDAR_NAME } });
  if (!data.id) throw new Error("Google returned no calendar id");
  return data.id;
}

async function listAllBlockers(
  events: GoogleEventsApi,
  calendarId: string,
  privateExtendedProperty: string[],
  timeMin: Date | undefined,
  retry: RetryPolicy,
): Promise<ExistingBlocker[]> {
  const blockers: ExistingBlocker[] = [];
  let pageToken: string | undefined;
  do {
    const { data } = await withRetry(
      () =>
        events.list({
          calendarId,
          privateExtendedProperty,
          singleEvents: false,
          showDeleted: false,
          maxResults: 2500,
          ...(timeMin && { timeMin: timeMin.toISOString() }),
          ...(pageToken && { pageToken }),
        }),
      retry,
    );
    blockers.push(...(data.items ?? []).flatMap((event) => existingBlocker(event) ?? []));
    pageToken = data.nextPageToken ?? undefined;
  } while (pageToken);
  return blockers;
}

async function calendarExists(calendars: GoogleCalendarsApi, calendarId: string): Promise<boolean> {
  try {
    await calendars.get({ calendarId });
    return true;
  } catch (error) {
    if (isGone(error)) return false;
    throw error;
  }
}

function ignoreAlreadyGone(error: unknown): void {
  if (!isGone(error)) throw error;
}

function isGone(error: unknown): boolean {
  const status = httpStatus(error);
  return status === 404 || status === 410;
}
