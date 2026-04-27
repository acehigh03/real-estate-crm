/**
 * Timezone-aware send window utilities.
 * Uses only the built-in Intl API — no extra dependencies.
 */

/** Returns "HH:MM" current time in the given IANA timezone. */
function currentTimeInTz(timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date()); // e.g. "09:30"
}

/**
 * Returns true if the current moment in `timezone` falls within
 * [windowStart, windowEnd). Both values are "HH:MM" strings.
 * Strips trailing ":SS" so Postgres `time` strings also work.
 */
export function isInsideWindow(
  windowStart: string,
  windowEnd: string,
  timezone: string
): boolean {
  const now = currentTimeInTz(timezone);
  const start = windowStart.slice(0, 5);
  const end = windowEnd.slice(0, 5);
  return now >= start && now < end;
}

/**
 * Returns the next UTC Date at which `windowStart` occurs in `timezone`.
 * If today's window start has already passed, returns tomorrow's.
 *
 * Note: crossing a DST boundary on the scheduled night can cause the fired
 * time to differ by ±1 hour — acceptable for a CRM send queue.
 */
export function nextWindowOpenUTC(windowStart: string, timezone: string): Date {
  const now = new Date();

  // "sv-SE" locale gives "YYYY-MM-DD HH:MM:SS" — convenient for parsing
  const tzNowStr = new Intl.DateTimeFormat("sv-SE", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(now); // e.g. "2026-04-27 14:30:00"

  const tzDateStr = tzNowStr.slice(0, 10); // "2026-04-27"

  // Derive current UTC offset: interpret the TZ-local time string as UTC
  // and subtract actual UTC epoch to get the offset in ms.
  const tzNowAsUTC = new Date(tzNowStr.replace(" ", "T") + "Z");
  const offsetMs = tzNowAsUTC.getTime() - now.getTime();

  // Build today's window-start instant (treating local time as UTC for arithmetic)
  const startHHMM = windowStart.slice(0, 5); // "HH:MM"
  const targetLocalAsUTC = new Date(`${tzDateStr}T${startHHMM}:00Z`);

  // Convert to real UTC: subtract the offset
  let scheduledUtc = targetLocalAsUTC.getTime() - offsetMs;

  // If that moment is already in the past, move to tomorrow
  if (scheduledUtc <= now.getTime()) {
    scheduledUtc += 24 * 60 * 60 * 1000;
  }

  return new Date(scheduledUtc);
}
