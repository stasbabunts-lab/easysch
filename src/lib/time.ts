// ── App timezone frame ──────────────────────────────────────────────────────
//
// Every schedule time in this app is Kyiv wall-clock: slots store "YYYY-MM-DD"
// dates and "HH:MM" times as the teacher typed them (Kyiv local), and
// Lesson.scheduledAt is built from those strings, so it holds the wall-clock
// time expressed as UTC. The server runs in UTC, so plain `new Date()` /
// `Date.now()` are 2–3h off from Kyiv and must NOT be compared against slot
// strings or scheduledAt.
//
// These helpers return a "Kyiv wall-clock" frame: a Date whose UTC fields equal
// the current Kyiv local time. Differences between such a Date and scheduledAt
// (also wall-clock-in-UTC) equal the real elapsed time, and slicing date/time
// off it yields the Kyiv calendar day / clock. DST is handled by Intl.
//
// IMPORTANT: real instants — bank transaction times, OAuth token expiry,
// notification `sentAt`, payment `confirmedAt` — are NOT wall-clock; keep using
// real `new Date()` / `Date.now()` for those.

const TZ = "Europe/Kyiv";

/** Current Kyiv wall-clock as a Date whose getTime()/toISOString fields are the Kyiv values. */
export function kyivNow(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date());
  const p: Record<string, string> = {};
  for (const part of parts) p[part.type] = part.value;
  return new Date(
    Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second)
  );
}

/** Kyiv "today" as "YYYY-MM-DD". */
export function kyivToday(): string {
  return kyivNow().toISOString().slice(0, 10);
}

/** Kyiv current time as "HH:MM". */
export function kyivCurrentTime(): string {
  return kyivNow().toISOString().slice(11, 16);
}

/** Kyiv date `days` away from today as "YYYY-MM-DD" (negative = past). */
export function kyivDateOffset(days: number): string {
  const d = kyivNow();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
