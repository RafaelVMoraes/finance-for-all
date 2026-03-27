export interface FinancialPeriod {
  year: number;
  month: number;
}

const clampFiscalStartMonth = (month: number) => {
  if (!Number.isFinite(month)) return 1;
  return Math.min(12, Math.max(1, Math.trunc(month)));
};

const resolveFiscalStartMonth = (
  fiscalYearStartMonth: number,
  legacyFiscalYearStartMonth?: unknown,
) => {
  if (typeof legacyFiscalYearStartMonth === "number") {
    return clampFiscalStartMonth(legacyFiscalYearStartMonth);
  }
  return clampFiscalStartMonth(fiscalYearStartMonth);
};

export function getFinancialPeriod(
  date: Date,
  fiscalYearStartMonth: number,
  ..._legacyArgs: unknown[]
): FinancialPeriod {
  const safeFiscalStart = resolveFiscalStartMonth(fiscalYearStartMonth, _legacyArgs[0]);

  const month = date.getMonth() + 1;
  const calendarYear = date.getFullYear();

  const year = month >= safeFiscalStart ? calendarYear : calendarYear - 1;

  return { year, month };
}

export function getFinancialPeriodBounds(
  year: number,
  month: number,
  fiscalYearStartMonth: number,
  ..._legacyArgs: unknown[]
): { start: Date; end: Date } {
  const safeFiscalStart = resolveFiscalStartMonth(fiscalYearStartMonth, _legacyArgs[0]);
  const safeMonth = Math.min(12, Math.max(1, Math.trunc(month)));

  const calendarYear = safeMonth >= safeFiscalStart ? year : year + 1;
  const start = new Date(calendarYear, safeMonth - 1, 1);
  const end = new Date(calendarYear, safeMonth, 0);

  return { start, end };
}

export function getFinancialPeriodsInYear(
  year: number,
  fiscalYearStartMonth: number,
  ..._legacyArgs: unknown[]
): Array<{ year: number; month: number; start: Date; end: Date }> {
  const safeFiscalStart = resolveFiscalStartMonth(fiscalYearStartMonth, _legacyArgs[0]);
  return Array.from({ length: 12 }, (_, idx) => {
    const month = ((safeFiscalStart - 1 + idx) % 12) + 1;
    const bounds = getFinancialPeriodBounds(year, month, safeFiscalStart);
    return { year, month, start: bounds.start, end: bounds.end };
  });
}

export function getFinancialPeriodLabel(
  year: number,
  month: number,
  fiscalYearStartMonth: number,
  locale: string | number,
  ..._legacyArgs: unknown[]
): string {
  const safeFiscalStart = typeof locale === "number"
    ? resolveFiscalStartMonth(locale, undefined)
    : resolveFiscalStartMonth(fiscalYearStartMonth, _legacyArgs[0]);
  const safeLocale =
    (typeof locale === "string" ? locale : _legacyArgs[0]) as string | undefined;
  const formatter = new Intl.DateTimeFormat(safeLocale, { month: "short" });
  const monthDate = new Date(month >= safeFiscalStart ? year : year + 1, month - 1, 1);
  return formatter.format(monthDate);
}

export function normalizeFiscalYearStartMonth(month?: number | null): number {
  return clampFiscalStartMonth(month ?? 1);
}
