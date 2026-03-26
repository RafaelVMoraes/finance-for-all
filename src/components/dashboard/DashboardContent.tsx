import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  max as dateMax,
  min as dateMin,
  startOfMonth,
  startOfWeek,
} from "date-fns";

import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { MonthlyDashboardSection } from "@/components/dashboard/monthly/MonthlyDashboardSection";
import {
  MonthlyInvestmentEvolution,
  MonthlyInvestmentGrowthByCategoryItem,
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
import { useAuthContext } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  getFinancialPeriodLabel,
  getFinancialPeriodsInYear,
} from "@/lib/financialPeriod";
const DEFAULT_CYCLE_START_DAY = 1;
const formatPercent = (value: number) => `${Math.round(value)}%`;

const calculateRatio = (value: number, total: number) =>
  total > 0 ? (value / total) * 100 : 0;

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

export default function DashboardContent() {
  const { t, locale } = useI18n();
  const { user } = useAuthContext();
  const today = useMemo(() => new Date(), []);

  const { settings, currencySymbol } = useUserSettings();
  const { getRate } = useExchangeRates();
  const {
    view,
    setView,
    selectedYear,
    yearStartMonth,
    aggregation,
    setAggregation,
  } = useDashboardViewState({ today });
  const fiscalYearStartMonth = yearStartMonth + 1;
  const [selectedMonthDate, setSelectedMonthDate] = useState<Date>(() => startOfMonth(today));
  const monthDate = useMemo(() => startOfMonth(selectedMonthDate), [selectedMonthDate]);
  const [monthlyTransactions, setMonthlyTransactions] = useState<any[]>([]);
  const {
    monthlySettings,
    budgets,
    loading: budgetsLoading,
  } = useBudgets({ month: monthDate, fiscalYearStartMonth: 1 });
  const {
    data: monthlySummary,
    loading: monthlyLoading,
    error: monthlyError,
  } = useMonthlySummary(monthDate, DEFAULT_CYCLE_START_DAY, 1);
  const {
    data: yearlySummary,
    loading: yearlyLoading,
    error: yearlyError,
  } = useYearlySummary(selectedYear, DEFAULT_CYCLE_START_DAY, fiscalYearStartMonth);
  const {
    data: yearlySummaryNext,
    loading: yearlyLoadingNext,
    error: yearlyErrorNext,
  } = useYearlySummary(selectedYear + 1, DEFAULT_CYCLE_START_DAY, fiscalYearStartMonth);
  const { data: investmentSummary } = useInvestmentSummary();

  const monthlyPeriodLabel = useMemo(
    () => format(monthDate, locale === "pt" ? "MMMM yyyy" : "MMMM yyyy"),
    [monthDate, locale],
  );

  const fiscalYearLabel = useMemo(() => `FY${monthDate.getFullYear()}`, [monthDate]);
  const stepFinancialPeriod = useCallback((delta: number) => {
    setSelectedMonthDate((current) => startOfMonth(addMonths(current, delta)));
  }, []);

  useEffect(() => {
    const run = async () => {
      if (!user) return;
      const start = startOfMonth(monthDate);
      const end = endOfMonth(monthDate);
      const { data } = await supabase
        .from("transactions")
        .select("id,amount,payment_date,original_label,edited_label,categories(id,name,color,type)")
        .eq("user_id", user.id)
        .gte("payment_date", format(start, "yyyy-MM-dd"))
        .lte("payment_date", format(end, "yyyy-MM-dd"));
      setMonthlyTransactions(
        (data || []).map((tx) => ({
          ...tx,
          amount:
            tx.categories?.type === "income"
              ? Number(tx.amount || 0)
              : Math.abs(Number(tx.amount || 0)),
        })),
      );
    };
    run();
  }, [user, monthDate]);

  const monthlyInvestmentGrowthByCategory = useMemo<MonthlyInvestmentGrowthByCategoryItem[]>(() => {
    if (!investmentSummary?.investments?.length) return [];
    const targetCurrency = settings?.main_currency || "EUR";
    const months = Array.from({ length: 6 }, (_, idx) => startOfMonth(addMonths(today, -(5 - idx))));
    const categories = Array.from(new Set(investmentSummary.investments.map((inv) => inv.investment_type)));

    return months.map((monthPoint, idx) => {
      const prev = idx > 0 ? months[idx - 1] : null;
      const row: MonthlyInvestmentGrowthByCategoryItem = {
        month: format(monthPoint, "MMM"),
        hasData: false,
      };
      let totalGrowth = 0;
      const growthByCategory = new Map<string, number>();

      categories.forEach((category) => {
        const nowValue = investmentSummary.investments
          .filter((inv) => inv.investment_type === category)
          .reduce((sum, inv) => {
            const snapshot = inv.snapshots?.find((snap) => snap.month.startsWith(format(monthPoint, "yyyy-MM")));
            if (snapshot) row.hasData = true;
            const rate = getRate(inv.currency as "EUR" | "USD" | "BRL", targetCurrency, monthPoint).rate;
            return sum + Number(snapshot?.total_value || 0) * rate;
          }, 0);

        const prevValue = prev
          ? investmentSummary.investments
              .filter((inv) => inv.investment_type === category)
              .reduce((sum, inv) => {
                const snapshot = inv.snapshots?.find((snap) => snap.month.startsWith(format(prev, "yyyy-MM")));
                const rate = getRate(inv.currency as "EUR" | "USD" | "BRL", targetCurrency, prev).rate;
                return sum + Number(snapshot?.total_value || 0) * rate;
              }, 0)
          : 0;

        const growth = idx === 0 ? 0 : nowValue - prevValue;
        growthByCategory.set(category, growth);
        totalGrowth += growth;
      });

      categories.forEach((category) => {
        if (!row.hasData || idx === 0 || totalGrowth === 0) row[category] = null;
        else row[category] = (100 * (growthByCategory.get(category) || 0)) / totalGrowth;
      });
      return row;
    });
  }, [getRate, investmentSummary, settings?.main_currency, today]);


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

    const monthlyCategoryBudgetProgress = categoryProgress.map((cat) => ({
      id: cat.id,
      name: cat.name,
      spent: cat.spent,
      annualBudget: cat.budget,
      consumedPct: cat.percent,
      allowedByNow: cat.budget,
      spentWithinAllowed: Math.min(cat.spent, cat.budget),
      overspent: Math.max(0, cat.spent - cat.budget),
      elapsedRatio: 1,
    }));

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

    const byDay = new Map<string, { total: number; variableTotal: number; fixedOnly: boolean; categories: Map<string, { amount: number; color: string; type: string }> }>();
    monthlyTransactions.forEach((tx) => {
      const day = tx.payment_date;
      const amount = Number(tx.amount || 0);
      const categoryType = tx.categories?.type || "variable";
      const existing = byDay.get(day) || {
        total: 0,
        variableTotal: 0,
        fixedOnly: true,
        categories: new Map<string, { amount: number; color: string; type: string }>(),
      };
      existing.total += amount;
      if (categoryType !== "fixed" && categoryType !== "income") {
        existing.variableTotal += amount;
        existing.fixedOnly = false;
      }
      const categoryName = tx.categories?.name || t("dashboard.uncategorized");
      const bucket = existing.categories.get(categoryName) || {
        amount: 0,
        color: tx.categories?.color || "#94a3b8",
        type: categoryType,
      };
      bucket.amount += amount;
      existing.categories.set(categoryName, bucket);
      byDay.set(day, existing);
    });

    const start = startOfMonth(monthDate);
    const end = endOfMonth(monthDate);
    const expenseHeatmap = [];
    let dayCursor = new Date(start);
    while (dayCursor <= end) {
      const key = format(dayCursor, "yyyy-MM-dd");
      const found = byDay.get(key);
      expenseHeatmap.push({
        date: key,
        label: format(dayCursor, "dd MMM yyyy"),
        total: found?.total || 0,
        variableTotal: found?.variableTotal || 0,
        hasTransactions: Boolean(found),
        hasFixedOnly: Boolean(found && found.fixedOnly),
        categories: found
          ? Array.from(found.categories.entries()).map(([name, value]) => ({
              name,
              amount: value.amount,
              color: value.color,
              type: value.type,
            }))
          : [],
      });
      dayCursor.setDate(dayCursor.getDate() + 1);
    }

    const topExpenses = monthlyTransactions
      .filter((tx) => tx.categories?.type !== "income")
      .map((tx) => ({
        id: tx.id,
        name: tx.edited_label || tx.original_label,
        amount: Number(tx.amount || 0),
        categoryName: tx.categories?.name || t("dashboard.uncategorized"),
        categoryColor: tx.categories?.color || "#94a3b8",
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

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
      monthlyCategoryBudgetProgress,
      expenseHeatmap,
      topExpenses,
      monthlyInvestmentGrowthByCategory,
    };
  }, [monthlySummary, monthlySettings, budgets, monthDate, t, getBudgetAmount, monthlyTransactions, monthlyInvestmentGrowthByCategory]);

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
    const mergedMap = new Map(merged.map((m) => [m.month_date, m]));
    const periods = getFinancialPeriodsInYear(selectedYear, DEFAULT_CYCLE_START_DAY, fiscalYearStartMonth);

    return periods.map((period, idx) => {
      const found = mergedMap.get(format(period.start, 'yyyy-MM-dd'));
      const key = `${period.year}-${String(period.month).padStart(2, '0')}`;
      return {
        key,
        monthDate: period.start,
        monthLabel: getFinancialPeriodLabel(period.year, period.month, DEFAULT_CYCLE_START_DAY, fiscalYearStartMonth, locale),
        quarterLabel: `Q${Math.floor(idx / 3) + 1}`,
        income: Number(found?.income || 0),
        fixed: Number(found?.fixed_expenses || 0),
        variable: Number(found?.variable_expenses || 0),
        savings: Number(found?.savings || 0),
      };
    });
  }, [selectedYear, yearlySummary, yearlySummaryNext, fiscalYearStartMonth, locale]);

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
      // Match against the exact financial-period start date so cut-off months align correctly.
      const idx = cm.month_date
        ? yearPeriodData.findIndex(
            (period) =>
              format(period.monthDate, "yyyy-MM-dd") === cm.month_date,
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
        Investments: null as number | null,
        Emergency: null as number | null,
        Current: null as number | null,
      };
      let hasData = false;
      let investments = 0;
      let emergency = 0;
      let current = 0;

      investmentSummary.investments.forEach((inv) => {
        const snapshot = inv.snapshots?.find((snap) =>
          snap.month.startsWith(format(monthDatePoint, "yyyy-MM")),
        );
        const rawValue = Number(snapshot?.total_value || 0);
        if (snapshot) hasData = true;
        const rate = getRate(
          inv.currency as "EUR" | "USD" | "BRL",
          targetCurrency,
          monthDatePoint,
        ).rate;
        const converted = rawValue * rate;

        if (inv.investment_type === "Investments") investments += converted;
        else if (inv.investment_type === "Emergency savings")
          emergency += converted;
        else current += converted;
      });
      if (hasData) {
        row.Investments = investments;
        row.Emergency = emergency;
        row.Current = current;
      }

      return row;
    });
  }, [getRate, investmentSummary, settings?.main_currency, yearPeriodData]);

  const yearlyInvestmentGrowth = useMemo<MonthlyInvestmentGrowthItem[]>(() => {
    if (investmentEvolution.length < 2) return [];

    return investmentEvolution.slice(1).map((month, index) => {
      const previous = investmentEvolution[index];
      if (
        month.Investments === null ||
        month.Emergency === null ||
        month.Current === null ||
        previous.Investments === null ||
        previous.Emergency === null ||
        previous.Current === null
      ) {
        return { month: month.month, growthPct: null, cumulativePct: null, monthPct: null };
      }
      const monthTotal = month.Investments + month.Emergency + month.Current;
      const previousTotal = previous.Investments + previous.Emergency + previous.Current;
      const monthPct = previousTotal > 0 ? ((monthTotal - previousTotal) / previousTotal) * 100 : 0;
      const cumulativePct = index === 0 ? monthPct : (monthPct + (investmentEvolution.slice(1, index + 1).reduce((sum, _, idx2) => {
        const prevItem = investmentEvolution[idx2];
        const currItem = investmentEvolution[idx2 + 1];
        if (
          prevItem.Investments === null ||
          prevItem.Emergency === null ||
          prevItem.Current === null ||
          currItem.Investments === null ||
          currItem.Emergency === null ||
          currItem.Current === null
        ) return sum;
        const prevTotal = prevItem.Investments + prevItem.Emergency + prevItem.Current;
        const currTotal = currItem.Investments + currItem.Emergency + currItem.Current;
        return sum + (prevTotal > 0 ? ((currTotal - prevTotal) / prevTotal) * 100 : 0);
      }, 0)));

      return {
        month: month.month,
        growthPct: cumulativePct,
        cumulativePct,
        monthPct,
      };
    });
  }, [investmentEvolution]);

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
          periodLabel={monthlyPeriodLabel}
          fiscalYearLabel={fiscalYearLabel}
          onPreviousPeriod={() => stepFinancialPeriod(-1)}
          onNextPeriod={() => stepFinancialPeriod(1)}
          monthlyViewData={monthlyViewData}
          monthlyInvestmentEvolution={monthlyInvestmentEvolution}
          currencySymbol={currencySymbol}
          chartConfig={chartConfig}
          formatPercent={formatPercent}
          calculateRatio={calculateRatio}
        />
      )}

      {view === "yearly" && yearlyViewData && (
        <YearlyDashboardSection
          yearlyViewData={yearlyViewData}
          yearPeriodData={yearPeriodData}
          fiscalYearBoundsLabel={`${format(startOfMonth(yearPeriodData[0].monthDate), "MMM yyyy")} – ${format(endOfMonth(yearPeriodData[yearPeriodData.length - 1].monthDate), "MMM yyyy")}`}
          aggregation={aggregation}
          onAggregationChange={setAggregation}
          currencySymbol={currencySymbol}
          chartConfig={chartConfig}
          yearlyIncomeExpenseTooltip={yearlyIncomeExpenseTooltip}
          
          investmentEvolution={investmentEvolution}
          investmentGrowthData={yearlyInvestmentGrowth}
          netWorth={investmentTotals.netWorth}
          yearlyInvestmentGain={investmentTotals.yearlyGain}
        />
      )}
    </div>
  );
}
