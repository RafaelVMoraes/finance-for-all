import { addMonths, format } from "date-fns";

export interface FinancialPeriod {
  year: number;
  month: number;
}

const clampCycleStartDay = (day: number) => {
  if (!Number.isFinite(day)) return 1;
  return Math.min(28, Math.max(1, Math.trunc(day)));
};

const clampFiscalStartMonth = (month: number) => {
  if (!Number.isFinite(month)) return 1;
  return Math.min(12, Math.max(1, Math.trunc(month)));
};

const toFinancialMonthLabel = (baseYear: number, baseMonth: number, cycleStartDay: number) => {
  const startYear = baseMonth === 1 ? baseYear - 1 : baseYear;
  const startMonth = baseMonth === 1 ? 12 : baseMonth - 1;
  const startDate = new Date(startYear, startMonth - 1, cycleStartDay);
  return addMonths(startDate, 1);
};

export function getFinancialPeriod(
  date: Date,
  cycleStartDay: number,
  fiscalYearStartMonth: number,
): FinancialPeriod {
  const safeDay = clampCycleStartDay(cycleStartDay);
  const safeFiscalStart = clampFiscalStartMonth(fiscalYearStartMonth);

  const baseYear = date.getFullYear();
  const baseMonth = date.getMonth() + 1;
  const monthAnchor = date.getDate() >= safeDay ? { y: baseYear, m: baseMonth } : baseMonth === 1 ? { y: baseYear - 1, m: 12 } : { y: baseYear, m: baseMonth - 1 };

  const labeledMonthDate = toFinancialMonthLabel(monthAnchor.y, monthAnchor.m, safeDay);
  const month = labeledMonthDate.getMonth() + 1;
  const calendarYear = labeledMonthDate.getFullYear();

  const year = month >= safeFiscalStart ? calendarYear : calendarYear - 1;

  return { year, month };
}

export function getFinancialPeriodBounds(
  year: number,
  month: number,
  cycleStartDay: number,
  fiscalYearStartMonth: number,
): { start: Date; end: Date } {
  const safeDay = clampCycleStartDay(cycleStartDay);
  const safeFiscalStart = clampFiscalStartMonth(fiscalYearStartMonth);
  const safeMonth = Math.min(12, Math.max(1, Math.trunc(month)));

  const calendarYear = safeMonth >= safeFiscalStart ? year : year + 1;
  const periodStart = new Date(calendarYear, safeMonth - 1, safeDay);
  const start = addMonths(periodStart, -1);
  const end = new Date(periodStart);
  end.setDate(end.getDate() - 1);

  return { start, end };
}

export function getFinancialPeriodsInYear(
  year: number,
  cycleStartDay: number,
  fiscalYearStartMonth: number,
): Array<{ year: number; month: number; start: Date; end: Date }> {
  const safeFiscalStart = clampFiscalStartMonth(fiscalYearStartMonth);
  return Array.from({ length: 12 }, (_, idx) => {
    const month = ((safeFiscalStart - 1 + idx) % 12) + 1;
    const bounds = getFinancialPeriodBounds(year, month, cycleStartDay, safeFiscalStart);
    return { year, month, start: bounds.start, end: bounds.end };
  });
}

export function getFinancialPeriodLabel(
  year: number,
  month: number,
  cycleStartDay: number,
  fiscalYearStartMonth: number,
  locale: string,
): string {
  const safeDay = clampCycleStartDay(cycleStartDay);
  const formatter = new Intl.DateTimeFormat(locale, { month: "short" });
  const monthDate = new Date(month >= fiscalYearStartMonth ? year : year + 1, month - 1, 1);
  const monthName = formatter.format(monthDate);

  if (safeDay === 1) {
    return monthName;
  }

  const { start, end } = getFinancialPeriodBounds(year, month, safeDay, fiscalYearStartMonth);
  return `${monthName} (${format(start, "d MMM")} – ${format(end, "d MMM")})`;
}

export function normalizeCycleStartDay(day?: number | null): number {
  return clampCycleStartDay(day ?? 1);
}

export function normalizeFiscalYearStartMonth(month?: number | null): number {
  return clampFiscalStartMonth(month ?? 1);
}
