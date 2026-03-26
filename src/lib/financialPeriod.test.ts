import { describe, expect, it } from "vitest";
import {
  getFinancialPeriod,
  getFinancialPeriodBounds,
  getFinancialPeriodLabel,
  getFinancialPeriodsInYear,
  normalizeCycleStartDay,
} from "@/lib/financialPeriod";

describe("financialPeriod", () => {
  it("keeps calendar behavior when cycleStartDay is 1", () => {
    const period = getFinancialPeriod(new Date("2025-01-10T00:00:00"), 1, 1);
    expect(period).toEqual({ year: 2025, month: 1 });
  });

  it("maps dates to next labeled month when day is on/after cut-off", () => {
    expect(getFinancialPeriod(new Date("2024-12-28T00:00:00"), 26, 1)).toEqual({ year: 2025, month: 1 });
    expect(getFinancialPeriod(new Date("2025-01-10T00:00:00"), 26, 1)).toEqual({ year: 2025, month: 1 });
    expect(getFinancialPeriod(new Date("2025-01-26T00:00:00"), 26, 1)).toEqual({ year: 2025, month: 2 });
  });

  it("respects fiscal year boundaries", () => {
    expect(getFinancialPeriod(new Date("2024-08-30T00:00:00"), 26, 9)).toEqual({ year: 2025, month: 9 });
    expect(getFinancialPeriod(new Date("2025-08-25T00:00:00"), 26, 9)).toEqual({ year: 2025, month: 9 });
  });

  it("returns expected period bounds", () => {
    const calendarBounds = getFinancialPeriodBounds(2025, 1, 1, 1);
    expect(calendarBounds.start.toISOString().slice(0, 10)).toBe("2025-01-01");
    expect(calendarBounds.end.toISOString().slice(0, 10)).toBe("2025-01-31");

    const { start, end } = getFinancialPeriodBounds(2025, 1, 26, 1);
    expect(start.toISOString().slice(0, 10)).toBe("2024-12-26");
    expect(end.toISOString().slice(0, 10)).toBe("2025-01-25");
  });

  it("builds 12 ordered periods in a year", () => {
    const periods = getFinancialPeriodsInYear(2025, 26, 9);
    expect(periods).toHaveLength(12);
    expect(periods[0]).toMatchObject({ year: 2025, month: 9 });
    expect(periods[11]).toMatchObject({ year: 2025, month: 8 });
  });

  it("renders compact and detailed labels", () => {
    expect(getFinancialPeriodLabel(2025, 1, 1, 1, "en-US")).toBe("Jan");
    expect(getFinancialPeriodLabel(2025, 1, 26, 1, "en-US")).toContain("(26 Dec – 25 Jan)");
  });

  it("caps cut-off at 28", () => {
    expect(normalizeCycleStartDay(31)).toBe(28);
  });
});
