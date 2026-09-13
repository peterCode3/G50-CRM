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

export type TimeOfDay = "Morning" | "Afternoon" | "Evening";
const TIME_OF_DAY_ORDER: TimeOfDay[] = ["Morning", "Afternoon", "Evening"];

/** Before noon / noon-5pm / after 5pm — the same three buckets most booking sites group times into. */
export function timeOfDay(date: Date): TimeOfDay {
  const hour = date.getHours();
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Evening";
}

/**
 * Groups already-sorted items into Morning/Afternoon/Evening buckets, keeping
 * only the buckets that actually have something in them, in day order.
 */
export function groupByTimeOfDay<T>(items: T[], getDate: (item: T) => Date): [TimeOfDay, T[]][] {
  const map = new Map<TimeOfDay, T[]>();
  for (const item of items) {
    const key = timeOfDay(getDate(item));
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return TIME_OF_DAY_ORDER.filter((key) => map.has(key)).map((key) => [key, map.get(key)!]);
}
