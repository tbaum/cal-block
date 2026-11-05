export type OccurrenceTime =
  | { readonly allDay: true; readonly startDate: string; readonly endDate: string }
  | { readonly allDay: false; readonly start: string; readonly end: string; readonly timeZone: string };

export interface Occurrence {
  readonly sourceId: string;
  readonly uid: string;
  readonly recurrenceId?: string;
  readonly time: OccurrenceTime;
}
