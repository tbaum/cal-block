import ICAL from "ical.js";
import { localMidnight, overlaps, parseLocalDate, type TimeRange } from "./dates.ts";

export type OccurrenceTime =
  | { readonly allDay: true; readonly startDate: string; readonly endDate: string }
  | { readonly allDay: false; readonly start: string; readonly end: string };

export interface Attendee {
  readonly email: string;
  readonly partstat?: string;
}

export interface Occurrence {
  readonly sourceId: string;
  readonly uid: string;
  readonly recurrenceId?: string;
  readonly time: OccurrenceTime;
  readonly status?: string;
  readonly transparency?: string;
  readonly attendees: readonly Attendee[];
}

interface OccurrenceDetails {
  readonly item: ICAL.Event;
  readonly startDate: ICAL.Time;
  readonly endDate: ICAL.Time;
  readonly recurrenceId?: ICAL.Time;
}

const MAX_ITERATIONS_PER_SERIES = 100_000;

export function expandCalendar(icsText: string, sourceId: string, range: TimeRange): Occurrence[] {
  const calendar = new ICAL.Component(ICAL.parse(icsText));
  registerTimezones(calendar);
  return eventSeries(calendar)
    .flatMap((event) => occurrencesInRange(event, range))
    .map((details) => toOccurrence(sourceId, details));
}

export function occurrenceRange(time: OccurrenceTime): TimeRange {
  return time.allDay
    ? { start: localMidnight(parseLocalDate(time.startDate)), end: localMidnight(parseLocalDate(time.endDate)) }
    : { start: new Date(time.start), end: new Date(time.end) };
}

function registerTimezones(calendar: ICAL.Component): void {
  for (const vtimezone of calendar.getAllSubcomponents("vtimezone")) {
    ICAL.TimezoneService.register(vtimezone);
  }
}

function eventSeries(calendar: ICAL.Component): ICAL.Event[] {
  const componentsByUid = Map.groupBy(calendar.getAllSubcomponents("vevent"), (vevent) =>
    String(vevent.getFirstPropertyValue("uid") ?? ""),
  );
  return [...componentsByUid.entries()]
    .filter(([uid]) => uid !== "")
    .flatMap(([, components]) => seriesFromComponents(components));
}

function seriesFromComponents(components: ICAL.Component[]): ICAL.Event[] {
  const master = components.find((component) => !component.hasProperty("recurrence-id"));
  const exceptions = components.filter((component) => component !== master);
  if (!master) return exceptions.map((exception) => new ICAL.Event(exception));
  const event = new ICAL.Event(master);
  for (const exception of exceptions) event.relateException(exception);
  return [event];
}

function occurrencesInRange(event: ICAL.Event, range: TimeRange): OccurrenceDetails[] {
  if (!event.isRecurring()) {
    const single = singleOccurrence(event);
    return overlaps(detailsRange(single), range) ? [single] : [];
  }
  const found: OccurrenceDetails[] = [];
  const iterator = event.iterator();
  for (let i = 0, next = iterator.next(); next && i < MAX_ITERATIONS_PER_SERIES; i++, next = iterator.next()) {
    if (toInstant(next) >= range.end) break;
    const details = event.getOccurrenceDetails(next);
    if (overlaps(detailsRange(details), range)) found.push(details);
  }
  return found;
}

function singleOccurrence(event: ICAL.Event): OccurrenceDetails {
  const base = { item: event, startDate: event.startDate, endDate: event.endDate };
  return event.isRecurrenceException() ? { ...base, recurrenceId: event.recurrenceId } : base;
}

function detailsRange(details: OccurrenceDetails): TimeRange {
  return occurrenceRange(occurrenceTime(details.startDate, details.endDate));
}

function toOccurrence(sourceId: string, details: OccurrenceDetails): Occurrence {
  const { item } = details;
  return {
    sourceId,
    uid: item.uid,
    ...(details.recurrenceId && { recurrenceId: timeKey(details.recurrenceId) }),
    time: occurrenceTime(details.startDate, details.endDate),
    ...optionalUpper("status", item.component.getFirstPropertyValue("status")),
    ...optionalUpper("transparency", item.component.getFirstPropertyValue("transp")),
    attendees: item.attendees.map(toAttendee),
  };
}

function occurrenceTime(start: ICAL.Time, end: ICAL.Time): OccurrenceTime {
  if (start.isDate) {
    const endDate = end.compare(start) > 0 ? end : nextDay(start);
    return { allDay: true, startDate: dateKey(start), endDate: dateKey(endDate) };
  }
  const endInstant = toInstant(end) > toInstant(start) ? toInstant(end) : toInstant(start);
  return { allDay: false, start: toInstant(start).toISOString(), end: endInstant.toISOString() };
}

function timeKey(time: ICAL.Time): string {
  return time.isDate ? dateKey(time) : toInstant(time).toISOString();
}

function dateKey(time: ICAL.Time): string {
  return time.toString().slice(0, 10);
}

function nextDay(time: ICAL.Time): ICAL.Time {
  const shifted = time.clone();
  shifted.addDuration(ICAL.Duration.fromData({ days: 1 }));
  return shifted;
}

function toInstant(time: ICAL.Time): Date {
  return isFloating(time)
    ? new Date(time.year, time.month - 1, time.day, time.hour, time.minute, time.second)
    : time.toJSDate();
}

function isFloating(time: ICAL.Time): boolean {
  return !time.zone || time.zone === ICAL.Timezone.localTimezone || time.zone.tzid === "floating";
}

function toAttendee(property: ICAL.Property): Attendee {
  const email = String(property.getFirstValue() ?? "")
    .replace(/^mailto:/i, "")
    .toLowerCase();
  const partstat = property.getParameter("partstat");
  return typeof partstat === "string" ? { email, partstat: partstat.toUpperCase() } : { email };
}

function optionalUpper<K extends string>(key: K, value: unknown): Partial<Record<K, string>> {
  return typeof value === "string" ? ({ [key]: value.toUpperCase() } as Record<K, string>) : {};
}
