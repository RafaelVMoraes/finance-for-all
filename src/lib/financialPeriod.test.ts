import { describe, expect, it } from "vitest";
import {
  getFinancialPeriod,
  getFinancialPeriodBounds,
  getFinancialPeriodLabel,
  getFinancialPeriodsInYear,
} from "@/lib/financialPeriod";

describe("financialPeriod", () => {
  it("uses calendar month boundaries", () => {
    const period = getFinancialPeriod(new Date("2025-01-10T00:00:00"), 1);
    expect(period).toEqual({ year: 2025, month: 1 });
  });

  it("respects fiscal year boundaries", () => {
    expect(getFinancialPeriod(new Date("2024-08-30T00:00:00"), 9)).toEqual({ year: 2023, month: 8 });
    expect(getFinancialPeriod(new Date("2025-08-25T00:00:00"), 9)).toEqual({ year: 2024, month: 8 });
    expect(getFinancialPeriod(new Date("2025-09-01T00:00:00"), 9)).toEqual({ year: 2025, month: 9 });
  });

  it("returns expected period bounds", () => {
    const calendarBounds = getFinancialPeriodBounds(2025, 1, 1);
    expect(calendarBounds.start.toISOString().slice(0, 10)).toBe("2025-01-01");
    expect(calendarBounds.end.toISOString().slice(0, 10)).toBe("2025-01-31");

    const { start, end } = getFinancialPeriodBounds(2025, 8, 9);
    expect(start.toISOString().slice(0, 10)).toBe("2026-08-01");
    expect(end.toISOString().slice(0, 10)).toBe("2026-08-31");
  });

  it("builds 12 ordered periods in a year", () => {
    const periods = getFinancialPeriodsInYear(2025, 9);
    expect(periods).toHaveLength(12);
    expect(periods[0]).toMatchObject({ year: 2025, month: 9 });
    expect(periods[11]).toMatchObject({ year: 2025, month: 8 });
  });

  it("renders compact labels", () => {
    expect(getFinancialPeriodLabel(2025, 1, 1, "en-US")).toBe("Jan");
  });
});
