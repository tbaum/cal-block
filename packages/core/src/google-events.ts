import type { calendar_v3 } from "@googleapis/calendar";
import type { Blocker, ExistingBlocker } from "./blockers.ts";
import type { OccurrenceTime } from "./occurrences.ts";

export const MARKER_PROPERTY = "calblock=1";

export function eventBody(blocker: Blocker): calendar_v3.Schema$Event {
  return {
    summary: blocker.title,
    ...eventTimes(blocker.time),
    ...(blocker.recurrence && { recurrence: [...blocker.recurrence] }),
    transparency: "opaque",
    visibility: "private",
    reminders: { useDefault: false, overrides: [] },
    extendedProperties: {
      private: { calblock: "1", calblockKey: blocker.key, calblockSource: blocker.sourceId, calblockHash: blocker.hash },
    },
  };
}

export function existingBlocker(event: calendar_v3.Schema$Event): ExistingBlocker | undefined {
  const marker = event.extendedProperties?.private;
  const time = occurrenceTimeOf(event);
  if (!event.id || marker?.["calblock"] !== "1" || !marker["calblockKey"] || !marker["calblockHash"] || !time) return undefined;
  return {
    eventId: event.id,
    key: marker["calblockKey"],
    sourceId: marker["calblockSource"] ?? "",
    hash: marker["calblockHash"],
    title: event.summary ?? "",
    time,
    ...(event.recurrence && { recurrence: event.recurrence }),
  };
}

function eventTimes(time: OccurrenceTime): Pick<calendar_v3.Schema$Event, "start" | "end"> {
  return time.allDay
    ? { start: { date: time.startDate }, end: { date: time.endDate } }
    : { start: { dateTime: time.start }, end: { dateTime: time.end } };
}

function occurrenceTimeOf(event: calendar_v3.Schema$Event): OccurrenceTime | undefined {
  if (event.start?.date && event.end?.date) return { allDay: true, startDate: event.start.date, endDate: event.end.date };
  if (event.start?.dateTime && event.end?.dateTime) {
    return { allDay: false, start: new Date(event.start.dateTime).toISOString(), end: new Date(event.end.dateTime).toISOString() };
  }
  return undefined;
}
