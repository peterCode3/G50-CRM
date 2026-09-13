/** Formats a Date as the UTC "YYYYMMDDTHHMMSSZ" timestamp an .ics file expects. */
function icsTimestamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function escapeIcsText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}

/** Builds a downloadable `data:` URL for a single-event .ics calendar file. */
export function buildIcsDataUrl(params: {
  title: string;
  description?: string;
  location?: string;
  start: Date;
  end: Date;
}): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//G50.Golf//Booking//EN",
    "BEGIN:VEVENT",
    `UID:${Date.now()}@g50.golf`,
    `DTSTAMP:${icsTimestamp(new Date())}`,
    `DTSTART:${icsTimestamp(params.start)}`,
    `DTEND:${icsTimestamp(params.end)}`,
    `SUMMARY:${escapeIcsText(params.title)}`,
    params.description ? `DESCRIPTION:${escapeIcsText(params.description)}` : undefined,
    params.location ? `LOCATION:${escapeIcsText(params.location)}` : undefined,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join("\r\n"))}`;
}

/** A Google Maps search URL for a plain-text address — no API key needed. */
export function directionsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}
