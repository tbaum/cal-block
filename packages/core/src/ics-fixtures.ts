const BERLIN_VTIMEZONE = `BEGIN:VTIMEZONE
TZID:Europe/Berlin
BEGIN:DAYLIGHT
TZOFFSETFROM:+0100
TZOFFSETTO:+0200
TZNAME:CEST
DTSTART:19700329T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:+0200
TZOFFSETTO:+0100
TZNAME:CET
DTSTART:19701025T030000
RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU
END:STANDARD
END:VTIMEZONE`;

export function calendar(...events: string[]): string {
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//cal-block//test//EN", BERLIN_VTIMEZONE, ...events, "END:VCALENDAR"]
    .join("\r\n")
    .replaceAll(/\r?\n/g, "\r\n");
}

export function vevent(lines: Record<string, string>): string {
  return ["BEGIN:VEVENT", ...Object.entries(lines).map(([key, value]) => `${key}${value.startsWith(";") ? "" : ":"}${value}`), "END:VEVENT"].join("\r\n");
}
