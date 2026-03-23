import { useCallback, useMemo, useState } from "react";
import {
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  max as dateMax,
  min as dateMin,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";

import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { MonthlyDashboardSection } from "@/components/dashboard/monthly/MonthlyDashboardSection";
import {
  InvestmentProjectionItem,
  MonthlyInvestmentEvolution,
  MonthlyInvestmentGrowthItem,
  YearlyIncomeExpenseTooltipProps,
} from "@/components/dashboard/types";
import { YearlyDashboardSection } from "@/components/dashboard/yearly/YearlyDashboardSection";
import { useBudgets } from "@/hooks/useBudgets";
import { useDashboardViewState } from "@/hooks/useDashboardViewState";
import {
  useInvestmentSummary,
  useMonthlySummary,
  useYearlySummary,
} from "@/hooks/useDashboardData";
import { useExchangeRates } from "@/hooks/useExchangeRates";
import { useUserSettings } from "@/hooks/useUserSettings";
import { useI18n } from "@/i18n/I18nProvider";
import { APP_START_DATE_STRING } from "@/constants/app";
const formatPercent = (value: number) => `${Math.round(value)}%`;

const calculateRatio = (value: number, total: number) =>
  total > 0 ? (value / total) * 100 : 0;

const isLinearGrowthInvestment = (investmentType: string) => {
  const normalized = investmentType.toLowerCase();
  return normalized.includes("current") || normalized.includes("savings");
};

/** Build exactly 4 week buckets for a given month, returning both the
 *  collapsed spending values AND the number of days in each bucket
 *  (needed to distribute budgets proportionally). */
const buildFourWeekBuckets = (monthDate: Date) => {
  const mStart = startOfMonth(monthDate);
  const mEnd = endOfMonth(monthDate);

  // Enumerate ISO weeks that touch this month
  let cursor = startOfWeek(mStart, { weekStartsOn: 1 });
  const rawWeeks: { start: Date; end: Date; days: number }[] = [];
  while (cursor <= mEnd) {
    const wEnd = endOfWeek(cursor, { weekStartsOn: 1 });
    const clampedStart = dateMax([cursor, mStart]);
    const clampedEnd = dateMin([wEnd, mEnd]);
    const days = differenceInCalendarDays(clampedEnd, clampedStart) + 1;
    if (days > 0) rawWeeks.push({ start: clampedStart, end: clampedEnd, days });
    cursor = addWeeks(cursor, 1);
  }

  // Collapse into exactly 4 buckets
  if (rawWeeks.length <= 4) {
    const padded = [
      ...rawWeeks,
      ...Array(Math.max(0, 4 - rawWeeks.length)).fill({ days: 0 }),
    ];
    return padded.slice(0, 4).map((w) => ({ days: w.days as number }));
  }

  const extra = rawWeeks.length - 4;
  // Collapse extra weeks into whichever end has fewer days
  const firstDays = rawWeeks[0].days;
  const lastDays = rawWeeks[rawWeeks.length - 1].days;
  const collapseFirst = firstDays <= lastDays;

  if (collapseFirst) {
    const collapsedDays = rawWeeks
      .slice(0, extra + 1)
      .reduce((s, w) => s + w.days, 0);
    return [
      { days: collapsedDays },
      ...rawWeeks.slice(extra + 1).map((w) => ({ days: w.days })),
    ];
  }
  const collapsedDays = rawWeeks
    .slice(rawWeeks.length - (extra + 1))
    .reduce((s, w) => s + w.days, 0);
  return [
    ...rawWeeks
      .slice(0, rawWeeks.length - (extra + 1))
      .map((w) => ({ days: w.days })),
    { days: collapsedDays },
  ];
};

const collapseValues = (
  values: number[],
  bucketCount: number,
  monthDate: Date,
): number[] => {
  if (values.length <= bucketCount) {
    return [
      ...values,
      ...Array(Math.max(0, bucketCount - values.length)).fill(0),
    ].slice(0, bucketCount);
  }
  const mStart = startOfMonth(monthDate);
  const mEnd = endOfMonth(monthDate);
  const firstWeekEnd = endOfWeek(mStart, { weekStartsOn: 1 });
  const lastWeekStart = startOfWeek(mEnd, { weekStartsOn: 1 });
  const firstDays =
    differenceInCalendarDays(dateMin([firstWeekEnd, mEnd]), mStart) + 1;
  const lastDays =
    differenceInCalendarDays(mEnd, dateMax([lastWeekStart, mStart])) + 1;
  const extra = values.length - bucketCount;
  if (firstDays <= lastDays) {
    const collapsed = values.slice(0, extra + 1).reduce((a, b) => a + b, 0);
    return [collapsed, ...values.slice(extra + 1)];
  }
  const collapsed = values
    .slice(values.length - (extra + 1))
    .reduce((a, b) => a + b, 0);
  return [...values.slice(0, values.length - (extra + 1)), collapsed];
};

/** Get percentage background style – white (0%) to dark green (100%+) */
const getPctBgStyle = (pct: number) => {
  const clamped = Math.min(Math.max(pct, 0), 150);
  const intensity = clamped / 150; // 0..1
  // From white to dark green via opacity
  return { backgroundColor: `rgba(22, 163, 74, ${intensity * 0.55})` };
};

export default function DashboardContent() {
  const { t } = useI18n();
  const today = useMemo(() => new Date(), []);
  const [selectedMonth, setSelectedMonth] = useState(format(today, "yyyy-MM"));
  const monthDate = useMemo(
    () => parseISO(`${selectedMonth}-01`),
    [selectedMonth],
  );

  const { settings, currencySymbol } = useUserSettings();
  const { getRate } = useExchangeRates();
  const {
    monthlySettings,
    budgets,
    loading: budgetsLoading,
    updateMonthlyComment,
  } = useBudgets({ month: monthDate });
  const {
    view,
    setView,
    selectedYear,
    setSelectedYear,
    yearStartMonth,
    setYearStartMonth,
    aggregation,
    setAggregation,
    commentDraft,
    yearlyStartMonth,
    handleCommentChange,
  } = useDashboardViewState({
    today,
    selectedMonth,
    monthlyComment: monthlySettings?.comment,
    onUpdateMonthlyComment: updateMonthlyComment,
  });
  const {
    data: monthlySummary,
    loading: monthlyLoading,
    error: monthlyError,
  } = useMonthlySummary(monthDate);
  const {
    data: yearlySummary,
    loading: yearlyLoading,
    error: yearlyError,
  } = useYearlySummary(selectedYear);
  const {
    data: yearlySummaryNext,
    loading: yearlyLoadingNext,
    error: yearlyErrorNext,
  } = useYearlySummary(selectedYear + 1);
  const { data: investmentSummary } = useInvestmentSummary();


  const getBudgetAmount = useCallback(
    (categoryId: string) =>
      budgets.find((b) => b.category_id === categoryId)?.expected_amount || 0,
    [budgets],
  );

  const monthlyViewData = useMemo(() => {
    if (!monthlySummary) return null;

    const categorySpending = monthlySummary.category_spending || [];
    const fixedCategories = categorySpending.filter((c) => c.type === "fixed");
    const variableCategories = categorySpending.filter(
      (c) => c.type === "variable",
    );

    const fixedExpenses = fixedCategories.reduce(
      (sum, c) => sum + Number(c.spent),
      0,
    );
    const variableExpenses = variableCategories.reduce(
      (sum, c) => sum + Number(c.spent),
      0,
    );
    const expectedIncome = monthlySettings?.expected_income || 0;
    const actualIncome = monthlySummary.total_income;
    const totalExpenses = monthlySummary.total_expenses;
    const actualSavings = actualIncome - totalExpenses;

    const totalBudgetedFixed = fixedCategories.reduce(
      (sum, cat) => sum + getBudgetAmount(cat.id),
      0,
    );
    const totalBudgetedVariable = variableCategories.reduce(
      (sum, cat) => sum + getBudgetAmount(cat.id),
      0,
    );
    const expectedExpenses = totalBudgetedFixed + totalBudgetedVariable;
    const expectedSavings =
      expectedIncome - totalBudgetedFixed - totalBudgetedVariable;
    const remainingBudget = expectedIncome - totalExpenses;

    const categoryProgress = categorySpending
      .filter((c) => c.type !== "income")
      .map((cat) => {
        const budget = getBudgetAmount(cat.id);
        const spent = Number(cat.spent);
        return {
          ...cat,
          spent,
          budget,
          percent: budget > 0 ? (spent / budget) * 100 : 0,
        };
      })
      .filter((c) => c.budget > 0)
      .sort((a, b) => b.percent - a.percent);

    const weeklySpending = monthlySummary.weekly_spending || [];
    const fourWeekBuckets = buildFourWeekBuckets(monthDate);
    const totalDays = fourWeekBuckets.reduce((s, b) => s + b.days, 0) || 1;

    // Distribute each category's budget across 4 weeks based on days + distribution rule
    const weeklyBudget = [0, 0, 0, 0];
    budgets
      .filter(
        (budget) =>
          budget.categories?.type !== "income" &&
          Number(budget.expected_amount) > 0,
      )
      .forEach((budget) => {
        const amount = Number(budget.expected_amount);
        if (budget.distribution === "front") {
          // Front-loaded: weight decreases per week
          const weights = fourWeekBuckets.map((b, i) => b.days * (4 - i));
          const total = weights.reduce((s, w) => s + w, 0) || 1;
          weights.forEach((w, i) => {
            weeklyBudget[i] += (amount * w) / total;
          });
        } else if (budget.distribution === "back") {
          // Back-loaded: weight increases per week
          const weights = fourWeekBuckets.map((b, i) => b.days * (i + 1));
          const total = weights.reduce((s, w) => s + w, 0) || 1;
          weights.forEach((w, i) => {
            weeklyBudget[i] += (amount * w) / total;
          });
        } else {
          // Even: proportional to days
          fourWeekBuckets.forEach((b, i) => {
            weeklyBudget[i] += (amount * b.days) / totalDays;
          });
        }
      });

    const rawWeeklySpent = weeklySpending.map((w) => Number(w.spent));
    const condensedSpent = collapseValues(rawWeeklySpent, 4, monthDate);

    const weeklyData = condensedSpent.map((spent, idx) => {
      const budget = weeklyBudget[idx] || 0;
      const delta = budget - spent;
      return {
        week: t("dashboard.weekLabel", { number: idx + 1 }),
        spent,
        budget,
        delta,
        deltaLabel: `${delta >= 0 ? "+" : ""}${delta.toFixed(0)}`,
      };
    });

    return {
      actualIncome,
      expectedIncome,
      expectedExpenses,
      totalExpenses,
      fixedExpenses,
      variableExpenses,
      expectedSavings,
      actualSavings,
      remainingBudget,
      transactionCount: monthlySummary.transaction_count,
      incompleteCount: monthlySummary.incomplete_count,
      categoryProgress,
      weeklyData,
      alerts: categoryProgress.filter((c) => c.percent >= 85).slice(0, 3),
    };
  }, [monthlySummary, monthlySettings, budgets, monthDate, t, getBudgetAmount]);

  const monthlyInvestmentEvolution = useMemo<MonthlyInvestmentEvolution>(() => {
    if (!investmentSummary?.investments)
      return { current: 0, lastMonth: 0, pctChange: 0 };

    const targetCurrency = settings?.main_currency || "EUR";
    const currentMonthStart = startOfMonth(monthDate);
    const lastMonthStart = startOfMonth(addMonths(monthDate, -1));

    const getNetWorthAtMonth = (pointInTime: Date) => {
      const point = format(pointInTime, "yyyy-MM-dd");

      return investmentSummary.investments.reduce((sum, inv) => {
        const snapshot = inv.snapshots
          ?.filter((snap) => snap.month <= point)
          .sort((a, b) => b.month.localeCompare(a.month))[0];
        const rawValue = Number(snapshot?.total_value || 0);
        const rate = getRate(
          inv.currency as "EUR" | "USD" | "BRL",
          targetCurrency,
          pointInTime,
        ).rate;
        return sum + rawValue * rate;
      }, 0);
    };

    const current = getNetWorthAtMonth(currentMonthStart);
    const lastMonth = getNetWorthAtMonth(lastMonthStart);
    const pctChange =
      lastMonth > 0 ? ((current - lastMonth) / lastMonth) * 100 : 0;

    return { current, lastMonth, pctChange };
  }, [getRate, investmentSummary, monthDate, settings?.main_currency]);

  const yearPeriodData = useMemo(() => {
    const currentYearMonths = yearlySummary?.monthly_data || [];
    const nextYearMonths = yearlySummaryNext?.monthly_data || [];
    const merged = [...currentYearMonths, ...nextYearMonths];
    const mergedMap = new Map(
      merged.map((m) => [format(parseISO(m.month_date), "yyyy-MM"), m]),
    );

    const startDate = new Date(selectedYear, yearStartMonth, 1);
    return Array.from({ length: 12 }).map((_, idx) => {
      const monthDatePoint = addMonths(startDate, idx);
      const key = format(monthDatePoint, "yyyy-MM");
      const found = mergedMap.get(key);

      return {
        key,
        monthDate: monthDatePoint,
        monthLabel: format(monthDatePoint, "MMM"),
        quarterLabel: `Q${Math.floor(idx / 3) + 1}`,
        income: Number(found?.income || 0),
        fixed: Number(found?.fixed_expenses || 0),
        variable: Number(found?.variable_expenses || 0),
        savings: Number(found?.savings || 0),
      };
    });
  }, [selectedYear, yearStartMonth, yearlySummary, yearlySummaryNext]);

  const yearlyViewData = useMemo(() => {
    const expectedIncome = Number(monthlySettings?.expected_income || 0);
    const expectedExpenses = budgets
      .filter((budget) => budget.categories?.type !== "income")
      .reduce((sum, budget) => sum + Number(budget.expected_amount || 0), 0);
    const expectedSavings = expectedIncome - expectedExpenses;

    const monthlyStats = yearPeriodData.map((m) => ({
      ...m,
      expenses: m.fixed + m.variable,
      savedOrOverspent: m.income - (m.fixed + m.variable),
      incomeDelta: m.income - expectedIncome,
      expenseDelta: m.fixed + m.variable - expectedExpenses,
      savingsDelta: m.savings - expectedSavings,
    }));

    const chartData =
      aggregation === "quarter"
        ? [0, 1, 2, 3].map((qIdx) => {
            const chunk = monthlyStats.slice(qIdx * 3, qIdx * 3 + 3);
            const sum = (key: keyof (typeof chunk)[number]) =>
              chunk.reduce((acc, item) => acc + Number(item[key] || 0), 0);
            return {
              monthLabel: `Q${qIdx + 1}`,
              income: sum("income"),
              fixed: sum("fixed"),
              variable: sum("variable"),
              savings: sum("savings"),
              expenses: sum("expenses"),
              savedOrOverspent: sum("savedOrOverspent"),
            };
          })
        : monthlyStats;

    const categoryMonthly = [
      ...(yearlySummary?.category_monthly_spending || []),
      ...(yearlySummaryNext?.category_monthly_spending || []),
    ];

    const byCategory: Record<
      string,
      {
        id: string;
        name: string;
        color: string;
        type: string;
        values: number[];
      }
    > = {};
    categoryMonthly.forEach((cm) => {
      const bucket = byCategory[cm.id] || {
        id: cm.id,
        name: cm.name,
        color: cm.color,
        type: cm.type,
        values: Array(12).fill(0),
      };
      // Use substring to avoid timezone issues with parseISO on date-only strings
      const idx = cm.month_date
        ? yearPeriodData.findIndex(
            (period) => period.key === cm.month_date.substring(0, 7),
          )
        : -1;
      if (idx >= 0) bucket.values[idx] += Number(cm.spent || 0);
      byCategory[cm.id] = bucket;
    });

    const categoryStability = Object.values(byCategory)
      .map((cat) => {
        const values = cat.values.filter((v) => v > 0);
        const avg = values.length
          ? values.reduce((a, b) => a + b, 0) / values.length
          : 0;
        const variance =
          values.length > 1
            ? values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length
            : 0;
        const stdDev = Math.sqrt(variance);
        const cv = avg > 0 ? (stdDev / avg) * 100 : 0;
        return { ...cat, avg, stdDev, cv, isVolatile: cv > 30 };
      })
      .filter((cat) => cat.avg > 0)
      .sort((a, b) => b.cv - a.cv);

    const variableAlerts = categoryStability
      .filter((cat) => cat.type === "variable")
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 3);

    const stdDevAlerts = [...categoryStability]
      .sort((a, b) => b.stdDev - a.stdDev)
      .slice(0, 3);

    const heatmapCategories = [...categoryStability]
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 12)
      .map((cat) => ({
        ...cat,
        cells: cat.values,
        maxCell: Math.max(1, ...cat.values),
      }));

    const maxHeat = Math.max(
      1,
      ...heatmapCategories.flatMap((cat) => cat.cells),
    );

    const periodStart = startOfMonth(yearPeriodData[0].monthDate);
    const periodEnd = endOfMonth(yearPeriodData[yearPeriodData.length - 1].monthDate);
    const totalPeriodDays = Math.max(
      1,
      differenceInCalendarDays(periodEnd, periodStart) + 1,
    );
    const elapsedPeriodDays =
      today < periodStart
        ? 0
        : today > periodEnd
          ? totalPeriodDays
          : differenceInCalendarDays(today, periodStart) + 1;
    const elapsedRatio = Math.min(
      1,
      Math.max(0, elapsedPeriodDays / totalPeriodDays),
    );

    const expenseCategoryRows = Object.values(byCategory)
      .filter((cat) => cat.type !== "income")
      .sort((a, b) => a.name.localeCompare(b.name));

    const yearlyCategoryBudgetProgress = budgets
      .filter((budget) => budget.categories?.type !== "income")
      .map((budget) => {
        const monthlyBudget = Number(budget.expected_amount || 0);
        const annualBudget = monthlyBudget * 12;
        const categorySpent =
          byCategory[budget.category_id]?.values.reduce((sum, v) => sum + v, 0) || 0;
        const allowedByNow = annualBudget * elapsedRatio;
        const spentWithinAllowed = Math.min(categorySpent, allowedByNow);
        const overspent = Math.max(0, categorySpent - allowedByNow);
        const consumedPct = annualBudget > 0 ? (categorySpent / annualBudget) * 100 : 0;

        return {
          id: budget.category_id,
          name: budget.categories?.name || "Uncategorized",
          spent: categorySpent,
          annualBudget,
          consumedPct,
          allowedByNow,
          spentWithinAllowed,
          overspent,
          elapsedRatio,
        };
      })
      .filter((row) => row.annualBudget > 0 || row.spent > 0)
      .sort((a, b) => b.consumedPct - a.consumedPct);

    const totalIncome = monthlyStats.reduce((sum, m) => sum + m.income, 0);
    const totalExpenses = monthlyStats.reduce((sum, m) => sum + m.expenses, 0);
    const totalSavings = monthlyStats.reduce((sum, m) => sum + m.savings, 0);

    // Count months that have any data for proper average calculation
    const monthsWithData =
      monthlyStats.filter((m) => m.income > 0 || m.expenses > 0).length || 1;

    return {
      expectedIncome,
      expectedExpenses,
      expectedSavings,
      monthlyStats,
      chartData,
      categoryStability,
      variableAlerts,
      stdDevAlerts,
      unstableAlerts: categoryStability
        .filter((cat) => cat.isVolatile)
        .slice(0, 3),
      budgetVsReality: monthlyStats.map((m) => ({
        month: m.monthLabel,
        actualIncome: m.income,
        actualExpenses: m.expenses,
        actualSavings: m.savedOrOverspent,
        incomePct: calculateRatio(m.income, expectedIncome),
        expensesPct: calculateRatio(m.expenses, expectedExpenses),
        savingsPct:
          expectedSavings !== 0
            ? (m.savedOrOverspent / expectedSavings) * 100
            : 0,
      })),
      yearlyCategoryBudgetProgress,
      expenseCategoryRows,
      heatmapCategories,
      maxHeat,
      totalIncome,
      totalExpenses,
      totalSavings,
      monthsWithData,
    };
  }, [
    aggregation,
    budgets,
    monthlySettings,
    today,
    yearPeriodData,
    yearlySummary,
    yearlySummaryNext,
  ]);

  const investmentEvolution = useMemo(() => {
    if (!investmentSummary?.investments) return [];
    const targetCurrency = settings?.main_currency || "EUR";

    return yearPeriodData.map((period) => {
      const monthDatePoint = startOfMonth(period.monthDate);
      const row = {
        month: period.monthLabel,
        Investments: 0,
        Emergency: 0,
        Current: 0,
      };

      investmentSummary.investments.forEach((inv) => {
        const snapshot = inv.snapshots
          ?.filter((snap) => snap.month <= format(monthDatePoint, "yyyy-MM-dd"))
          .sort((a, b) => b.month.localeCompare(a.month))[0];
        const rawValue = Number(snapshot?.total_value || 0);
        const rate = getRate(
          inv.currency as "EUR" | "USD" | "BRL",
          targetCurrency,
          monthDatePoint,
        ).rate;
        const converted = rawValue * rate;

        if (inv.investment_type === "Investments") row.Investments += converted;
        else if (inv.investment_type === "Emergency savings")
          row.Emergency += converted;
        else row.Current += converted;
      });

      return row;
    });
  }, [getRate, investmentSummary, settings?.main_currency, yearPeriodData]);

  const yearlyInvestmentGrowth = useMemo<MonthlyInvestmentGrowthItem[]>(() => {
    if (investmentEvolution.length < 2) return [];

    return investmentEvolution.slice(1).map((month, index) => {
      const previous = investmentEvolution[index];
      const monthTotal = month.Investments + month.Emergency + month.Current;
      const previousTotal =
        previous.Investments + previous.Emergency + previous.Current;

      return {
        month: month.month,
        growthPct:
          previousTotal > 0 ? ((monthTotal - previousTotal) / previousTotal) * 100 : 0,
      };
    });
  }, [investmentEvolution]);

  const investmentProjections = useMemo<InvestmentProjectionItem[]>(() => {
    if (!investmentSummary?.investments?.length || yearPeriodData.length < 2) return [];

    const targetCurrency = settings?.main_currency || "EUR";
    const historicalMonths = yearPeriodData.slice(-12);

    const monthlyBreakdown = historicalMonths.map((period) => {
      const pointInTime = startOfMonth(period.monthDate);
      let compoundTotal = 0;
      let linearTotal = 0;

      investmentSummary.investments.forEach((investment) => {
        const snapshot = investment.snapshots
          ?.filter((snap) => snap.month <= format(pointInTime, "yyyy-MM-dd"))
          .sort((a, b) => b.month.localeCompare(a.month))[0];
        const value = Number(snapshot?.total_value || 0);
        const rate = getRate(
          investment.currency as "EUR" | "USD" | "BRL",
          targetCurrency,
          pointInTime,
        ).rate;
        const convertedValue = value * rate;

        if (isLinearGrowthInvestment(investment.investment_type)) linearTotal += convertedValue;
        else compoundTotal += convertedValue;
      });

      return {
        compoundTotal,
        linearTotal,
      };
    });

    const monthlyChanges = monthlyBreakdown
      .slice(1)
      .map((month, index) => ({
        compoundChange: month.compoundTotal - monthlyBreakdown[index].compoundTotal,
        linearChange: month.linearTotal - monthlyBreakdown[index].linearTotal,
        compoundGrowthRate:
          monthlyBreakdown[index].compoundTotal > 0
            ? (month.compoundTotal - monthlyBreakdown[index].compoundTotal) /
              monthlyBreakdown[index].compoundTotal
            : 0,
      }));

    const averageCompoundGrowthRate =
      monthlyChanges.length > 0
        ? monthlyChanges.reduce((sum, row) => sum + row.compoundGrowthRate, 0) /
          monthlyChanges.length
        : 0;
    const averageCompoundContribution =
      monthlyChanges.length > 0
        ? monthlyChanges.reduce((sum, row) => sum + row.compoundChange, 0) /
          monthlyChanges.length
        : 0;
    const averageLinearContribution =
      monthlyChanges.length > 0
        ? monthlyChanges.reduce((sum, row) => sum + row.linearChange, 0) /
          monthlyChanges.length
        : 0;

    const latest = monthlyBreakdown[monthlyBreakdown.length - 1];
    const currentCompoundValue = latest?.compoundTotal || 0;
    const currentLinearValue = latest?.linearTotal || 0;
    const rate = averageCompoundGrowthRate;

    return [
      { label: "5 years", months: 60, value: 0 },
      { label: "10 years", months: 120, value: 0 },
      { label: "20 years", months: 240, value: 0 },
    ].map((projection) => {
      const compoundFutureValue =
        Math.abs(rate) < 1e-6
          ? currentCompoundValue + averageCompoundContribution * projection.months
          : currentCompoundValue * (1 + rate) ** projection.months +
            averageCompoundContribution *
              (((1 + rate) ** projection.months - 1) / rate);
      const linearFutureValue =
        currentLinearValue + averageLinearContribution * projection.months;

      return {
        ...projection,
        value: Math.max(0, compoundFutureValue + linearFutureValue),
      };
    });
  }, [getRate, investmentSummary, settings?.main_currency, yearPeriodData]);

  const investmentTotals = useMemo(() => {
    if (!investmentSummary?.investments?.length) {
      return { netWorth: 0, yearlyGain: 0 };
    }

    const targetCurrency = settings?.main_currency || "EUR";
    const now = today;
    const yearStart = new Date(today.getFullYear(), 0, 1);

    const getValueAtDate = (pointInTime: Date) =>
      investmentSummary.investments.reduce((sum, investment) => {
        const snapshot = investment.snapshots
          ?.filter((snap) => snap.month <= format(pointInTime, "yyyy-MM-dd"))
          .sort((a, b) => b.month.localeCompare(a.month))[0];
        const rawValue = Number(snapshot?.total_value || 0);
        const rate = getRate(
          investment.currency as "EUR" | "USD" | "BRL",
          targetCurrency,
          pointInTime,
        ).rate;
        return sum + rawValue * rate;
      }, 0);

    const netWorth = getValueAtDate(now);
    const startOfYearValue = getValueAtDate(yearStart);

    return {
      netWorth,
      yearlyGain: netWorth - startOfYearValue,
    };
  }, [getRate, investmentSummary, settings?.main_currency, today]);

  const loading =
    (view === "monthly"
      ? monthlyLoading
      : yearlyLoading || yearlyLoadingNext) || budgetsLoading;

  const chartConfig = {
    spent: { label: "Spent", color: "hsl(var(--chart-1))" },
    budget: { label: "Budget", color: "hsl(var(--chart-2))" },
    income: { label: "Income", color: "hsl(var(--chart-1))" },
    fixed: { label: "Fixed", color: "hsl(var(--chart-2))" },
    variable: { label: "Variable", color: "hsl(var(--chart-3))" },
    savings: { label: "Savings", color: "hsl(var(--chart-4))" },
    savedOrOverspent: {
      label: "Saved / Overspent",
      color: "hsl(var(--chart-5))",
    },
    incomeDelta: { label: "Income Δ", color: "hsl(var(--chart-1))" },
    expenseDelta: { label: "Expense Δ", color: "hsl(var(--chart-2))" },
    savingsDelta: { label: "Savings Δ", color: "hsl(var(--chart-4))" },
    Investments: { label: "Investments", color: "hsl(var(--chart-1))" },
    Emergency: { label: "Emergency", color: "hsl(var(--chart-2))" },
    Current: { label: "Current", color: "hsl(var(--chart-3))" },
  };

  if (loading)
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Loading dashboard...
      </div>
    );
  if (monthlyError || yearlyError || yearlyErrorNext) {
    return (
      <div className="flex h-64 items-center justify-center text-destructive">
        Failed to load dashboard data.
      </div>
    );
  }

  const yearlyIncomeExpenseTooltip = ({
    active,
    payload,
    label,
  }: YearlyIncomeExpenseTooltipProps) => {
    if (!active || !payload || payload.length === 0) return null;

    const data = payload[0]?.payload || {};
    const income = Number(data.income || 0);
    const fixed = Number(data.fixed || 0);
    const variable = Number(data.variable || 0);
    const savedOrOverspent = Number(data.savedOrOverspent || 0);

    return (
      <div className="rounded-lg border bg-background p-3 text-xs shadow-md">
        <p className="mb-2 font-medium">{label}</p>
        <div className="space-y-1 text-muted-foreground">
          <p>
            {t("dashboard.income")}: {currencySymbol}
            {income.toFixed(0)}
          </p>
          <p>
            {t("dashboard.fixed")}: {currencySymbol}
            {fixed.toFixed(0)} ({formatPercent(calculateRatio(fixed, income))})
          </p>
          <p>
            {t("dashboard.variable")}: {currencySymbol}
            {variable.toFixed(0)} ({formatPercent(calculateRatio(variable, income))})
          </p>
          <p className={savedOrOverspent >= 0 ? "text-emerald-600" : "text-destructive"}>
            {savedOrOverspent >= 0 ? t("dashboard.saved") : t("dashboard.overspent")}: {currencySymbol}
            {Math.abs(savedOrOverspent).toFixed(0)} ({formatPercent(calculateRatio(Math.abs(savedOrOverspent), income))})
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <DashboardHeader view={view} onViewChange={setView} />

      {view === "monthly" && monthlyViewData && (
        <MonthlyDashboardSection
          selectedMonth={selectedMonth}
          minMonth={APP_START_DATE_STRING.slice(0, 7)}
          onMonthChange={setSelectedMonth}
          monthlyViewData={monthlyViewData}
          monthlyInvestmentEvolution={monthlyInvestmentEvolution}
          currencySymbol={currencySymbol}
          commentDraft={commentDraft}
          onCommentChange={handleCommentChange}
          chartConfig={chartConfig}
          formatPercent={formatPercent}
          calculateRatio={calculateRatio}
        />
      )}

      {view === "yearly" && yearlyViewData && (
        <YearlyDashboardSection
          yearlyViewData={yearlyViewData}
          yearPeriodData={yearPeriodData}
          yearlyStartMonth={yearlyStartMonth}
          minMonth={APP_START_DATE_STRING.slice(0, 7)}
          onYearWindowChange={(value) => {
            const [year, month] = value.split("-");
            if (!year || !month) return;
            setSelectedYear(Number(year));
            setYearStartMonth(Number(month) - 1);
          }}
          aggregation={aggregation}
          onAggregationChange={setAggregation}
          currencySymbol={currencySymbol}
          chartConfig={chartConfig}
          yearlyIncomeExpenseTooltip={yearlyIncomeExpenseTooltip}
          
          investmentEvolution={investmentEvolution}
          investmentGrowthData={yearlyInvestmentGrowth}
          investmentProjections={investmentProjections}
          netWorth={investmentTotals.netWorth}
          yearlyInvestmentGain={investmentTotals.yearlyGain}
        />
      )}
    </div>
  );
}
