const HOUSTON_TIME_ZONE = "America/Chicago";

export type FilingWindow = "today" | "3" | "7" | "30";

/** Returns the current calendar date in Houston, regardless of the server's timezone. */
export function getHoustonDateISO(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: HOUSTON_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function shiftISODate(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

/** Inclusive start and exclusive end for a filing-date window, using Houston calendar days. */
export function getFilingDateRange(window: FilingWindow, now = new Date()) {
  const today = getHoustonDateISO(now);
  const days = window === "today" ? 1 : Number(window);
  return {
    start: shiftISODate(today, -(days - 1)),
    endExclusive: shiftISODate(today, 1),
  };
}

/** Converts a date-only value to a browser-local date so it displays without a timezone shift. */
export function parseLocalDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return new Date(Number.NaN);
  return new Date(year, month - 1, day);
}
