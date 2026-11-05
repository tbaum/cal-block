import type { Occurrence } from "./occurrences.ts";

export function isBusy(occurrence: Occurrence, ownerEmails: readonly string[]): boolean {
  return (
    occurrence.status !== "CANCELLED" &&
    occurrence.transparency !== "TRANSPARENT" &&
    !declinedByOwner(occurrence, ownerEmails)
  );
}

function declinedByOwner(occurrence: Occurrence, ownerEmails: readonly string[]): boolean {
  const owners = new Set(ownerEmails.map((email) => email.toLowerCase()));
  return occurrence.attendees.some((attendee) => owners.has(attendee.email) && attendee.partstat === "DECLINED");
}
