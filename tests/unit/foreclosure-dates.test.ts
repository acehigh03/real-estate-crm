import { describe, expect, it } from "vitest";

import { getFilingDateRange, getHoustonDateISO, parseLocalDate } from "../../lib/foreclosure-dates";

describe("foreclosure filing dates", () => {
  it("uses Houston's calendar day even when UTC has rolled over", () => {
    const now = new Date("2026-09-25T04:30:00.000Z"); // 11:30 p.m. in Houston on Sep 24
    expect(getHoustonDateISO(now)).toBe("2026-09-24");
    expect(getFilingDateRange("today", now)).toEqual({ start: "2026-09-24", end: "2026-09-24" });
  });

  it("includes today and the previous two dates for the last-three-days filter", () => {
    const now = new Date("2026-09-24T17:00:00.000Z");
    expect(getFilingDateRange("3", now)).toEqual({ start: "2026-09-22", end: "2026-09-24" });
  });

  it("parses date-only values without shifting them to the prior day", () => {
    expect(parseLocalDate("2026-09-24").getDate()).toBe(24);
  });
});
