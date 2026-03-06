import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  PiggyBank,
  Target,
  TrendingUp,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBudgets } from "@/hooks/useBudgets";
import {
  useInvestmentSummary,
  useMonthlySummary,
  useYearlySummary,
} from "@/hooks/useDashboardData";
import { useExchangeRates } from "@/hooks/useExchangeRates";
import { useUserSettings } from "@/hooks/useUserSettings";
import { useI18n } from "@/i18n/I18nProvider";
import { APP_START_DATE_STRING } from "@/constants/app";

type YearAggregation = "month" | "quarter";

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

const YEAR_START_MONTH_KEY = "fintrack_year_start_month";
const SELECTED_YEAR_KEY = "fintrack_selected_year";

/** Get percentage background style – white (0%) to dark green (100%+) */
const getPctBgStyle = (pct: number) => {
  const clamped = Math.min(Math.max(pct, 0), 150);
  const intensity = clamped / 150; // 0..1
  // From white to dark green via opacity
  return { backgroundColor: `rgba(22, 163, 74, ${intensity * 0.55})` };
};

export default function Dashboard() {
  const { t } = useI18n();
  const today = useMemo(() => new Date(), []);
  const [view, setView] = useState<"monthly" | "yearly">("monthly");
  const [selectedMonth, setSelectedMonth] = useState(format(today, "yyyy-MM"));
  const [selectedYear, setSelectedYear] = useState(() => {
    const saved = localStorage.getItem(SELECTED_YEAR_KEY);
    return saved !== null ? Number(saved) : today.getFullYear();
  });
  const [yearStartMonth, setYearStartMonth] = useState(() => {
    const saved = localStorage.getItem(YEAR_START_MONTH_KEY);
    return saved !== null ? Number(saved) : 0;
  });
  const [aggregation, setAggregation] = useState<YearAggregation>("month");
  const [commentDraft, setCommentDraft] = useState("");
  const commentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persist yearStartMonth
  useEffect(() => {
    localStorage.setItem(YEAR_START_MONTH_KEY, String(yearStartMonth));
  }, [yearStartMonth]);

  useEffect(() => {
    localStorage.setItem(SELECTED_YEAR_KEY, String(selectedYear));
  }, [selectedYear]);

  const monthDate = useMemo(
    () => parseISO(`${selectedMonth}-01`),
    [selectedMonth],
  );
  const yearlyStartMonth = useMemo(
    () => `${selectedYear}-${String(yearStartMonth + 1).padStart(2, "0")}`,
    [selectedYear, yearStartMonth],
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

  // Sync comment draft with loaded data
  useEffect(() => {
    setCommentDraft(monthlySettings?.comment || "");
  }, [monthlySettings?.comment, selectedMonth]);

  const handleCommentChange = useCallback(
    (value: string) => {
      setCommentDraft(value);
      if (commentTimerRef.current) clearTimeout(commentTimerRef.current);
      commentTimerRef.current = setTimeout(() => {
        updateMonthlyComment(value);
      }, 1000);
    },
    [updateMonthlyComment],
  );

  const getBudgetAmount = (categoryId: string) =>
    budgets.find((b) => b.category_id === categoryId)?.expected_amount || 0;

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
  }, [monthlySummary, monthlySettings, budgets, monthDate, t]);

  const monthlyInvestmentEvolution = useMemo(() => {
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
  }: {
    active?: boolean;
    payload?: Array<{
      dataKey?: string;
      value?: number;
      payload?: Record<string, number>;
    }>;
    label?: string;
  }) => {
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
            {variable.toFixed(0)} (
            {formatPercent(calculateRatio(variable, income))})
          </p>
          <p
            className={
              savedOrOverspent >= 0 ? "text-emerald-600" : "text-destructive"
            }
          >
            {savedOrOverspent >= 0
              ? t("dashboard.saved")
              : t("dashboard.overspent")}
            : {currencySymbol}
            {Math.abs(savedOrOverspent).toFixed(0)} (
            {formatPercent(calculateRatio(Math.abs(savedOrOverspent), income))})
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
          {t("nav.dashboard")}
        </h1>
        <Tabs
          data-tutorial="dashboard-view-tabs"
          value={view}
          onValueChange={(v) => setView(v as "monthly" | "yearly")}
        >
          <TabsList>
            <TabsTrigger value="monthly" className="gap-2">
              <Calendar className="h-4 w-4" />
              {t("dashboard.monthly")}
            </TabsTrigger>
            <TabsTrigger value="yearly" className="gap-2">
              <Target className="h-4 w-4" />
              {t("dashboard.yearly")}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {view === "monthly" && monthlyViewData && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="month"
              min={APP_START_DATE_STRING.slice(0, 7)}
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full max-w-full min-w-0 rounded-md border bg-background px-3 py-2 text-sm sm:w-auto"
            />
            <Badge variant="outline">
              {t("dashboard.analyzeMonthlyPerformance")}
            </Badge>
          </div>

          <div
            data-tutorial="dashboard-key-metrics"
            className="grid grid-cols-2 gap-3 xl:grid-cols-5"
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  {t("dashboard.income")}
                </CardTitle>
                <ArrowUpRight className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {currencySymbol}
                  {monthlyViewData.actualIncome.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("dashboard.expected")} {currencySymbol}
                  {monthlyViewData.expectedIncome.toLocaleString()} ·{" "}
                  {formatPercent(
                    calculateRatio(
                      monthlyViewData.actualIncome,
                      monthlyViewData.expectedIncome || 1,
                    ),
                  )}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  {t("dashboard.expenses")}
                </CardTitle>
                <ArrowDownRight className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {currencySymbol}
                  {monthlyViewData.totalExpenses.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("dashboard.expected")} {currencySymbol}
                  {monthlyViewData.expectedExpenses.toFixed(0)} ·{" "}
                  {formatPercent(
                    calculateRatio(
                      monthlyViewData.totalExpenses,
                      monthlyViewData.expectedExpenses || 1,
                    ),
                  )}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  {t("dashboard.savings")}
                </CardTitle>
                <PiggyBank className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${monthlyViewData.actualSavings >= 0 ? "text-emerald-600" : "text-destructive"}`}
                >
                  {currencySymbol}
                  {monthlyViewData.actualSavings.toFixed(0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("dashboard.expected")} {currencySymbol}
                  {monthlyViewData.expectedSavings.toFixed(0)} ·{" "}
                  {formatPercent(
                    monthlyViewData.expectedSavings !== 0
                      ? (monthlyViewData.actualSavings /
                          monthlyViewData.expectedSavings) *
                          100
                      : 0,
                  )}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  {t("dashboard.budgetBalance")}
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-chart-4" />
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${monthlyViewData.remainingBudget >= 0 ? "text-emerald-600" : "text-destructive"}`}
                >
                  {currencySymbol}
                  {monthlyViewData.remainingBudget.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("dashboard.expected")} {currencySymbol}
                  {monthlyViewData.expectedSavings.toFixed(0)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  {t("dashboard.investmentsVsLastMonth")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${monthlyInvestmentEvolution.pctChange >= 0 ? "text-emerald-600" : "text-destructive"}`}
                >
                  {formatPercent(monthlyInvestmentEvolution.pctChange)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {currencySymbol}
                  {monthlyInvestmentEvolution.current.toFixed(0)}{" "}
                  {t("dashboard.vs")} {currencySymbol}
                  {monthlyInvestmentEvolution.lastMonth.toFixed(0)}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {t("dashboard.weeklySpendingVsBudget")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {monthlyViewData.weeklyData.length > 0 ? (
                  <ChartContainer
                    config={chartConfig}
                    className="h-[260px] w-full"
                  >
                    <ComposedChart data={monthlyViewData.weeklyData}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="week" tickLine={false} axisLine={false} />
                      <YAxis
                        tickFormatter={(v) => `${currencySymbol}${v}`}
                        tickLine={false}
                        axisLine={false}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Legend />
                      <Bar
                        dataKey="spent"
                        fill="hsl(var(--chart-1))"
                        radius={6}
                      >
                        <LabelList
                          dataKey="deltaLabel"
                          position="top"
                          className="fill-muted-foreground text-xs"
                        />
                      </Bar>
                      <Line
                        type="monotone"
                        dataKey="budget"
                        stroke="hsl(var(--chart-2))"
                        strokeWidth={2}
                        dot={false}
                      />
                    </ComposedChart>
                  </ChartContainer>
                ) : (
                  <p className="py-8 text-center text-muted-foreground">
                    {t("dashboard.noSpendingDataYet")}
                  </p>
                )}
              </CardContent>
            </Card>

            {monthlyViewData.alerts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    {t("dashboard.budgetAlerts")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {monthlyViewData.alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="space-y-1 rounded-md border p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 flex-1 break-words font-medium">
                          {alert.name}
                        </span>
                        <Badge
                          className="shrink-0"
                          variant={
                            alert.percent >= 100 ? "destructive" : "secondary"
                          }
                        >
                          {alert.percent.toFixed(0)}%
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {currencySymbol}
                        {alert.spent.toFixed(0)} / {currencySymbol}
                        {alert.budget.toFixed(0)}
                      </p>
                      <Progress value={Math.min(alert.percent, 100)} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t("dashboard.categoryBudgetProgress")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {monthlyViewData.categoryProgress.length === 0 ? (
                <p className="text-muted-foreground">
                  {t("dashboard.noBudgetsSetYet")}
                </p>
              ) : (
                monthlyViewData.categoryProgress.slice(0, 12).map((cat) => (
                  <div key={cat.id} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>{cat.name}</span>
                      <span>
                        {currencySymbol}
                        {cat.spent.toFixed(0)} / {currencySymbol}
                        {cat.budget.toFixed(0)}
                      </span>
                    </div>
                    <Progress value={Math.min(cat.percent, 100)} />
                  </div>
                ))
              )}
              <div className="pt-2">
                <Button asChild variant="outline">
                  <Link to="/budget">{t("dashboard.adjustBudget")}</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Monthly Comment */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                {t("dashboard.monthlyNotes")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <textarea
                className="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[80px] resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder={t("dashboard.monthlyNotesPlaceholder")}
                value={commentDraft}
                onChange={(e) => handleCommentChange(e.target.value)}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {view === "yearly" && yearlyViewData && (
        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-start">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  {t("dashboard.yearWindowStart")}
                </p>
                <input
                  type="month"
                  value={yearlyStartMonth}
                  min={APP_START_DATE_STRING.slice(0, 7)}
                  onChange={(e) => {
                    const [year, month] = e.target.value.split("-");
                    if (!year || !month) return;
                    setSelectedYear(Number(year));
                    setYearStartMonth(Number(month) - 1);
                  }}
                  className="w-full max-w-full min-w-0 rounded-md border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  {t("dashboard.aggregation")}
                </p>
                <Select
                  value={aggregation}
                  onValueChange={(v) => setAggregation(v as YearAggregation)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">
                      {t("dashboard.monthly")}
                    </SelectItem>
                    <SelectItem value="quarter">
                      {t("dashboard.quarterly")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  {t("dashboard.avgIncome")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {currencySymbol}
                  {Math.round(
                    yearlyViewData.totalIncome / yearlyViewData.monthsWithData,
                  ).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("dashboard.total")} {currencySymbol}
                  {Math.round(
                    yearlyViewData.totalIncome,
                  ).toLocaleString()} · {yearlyViewData.monthsWithData}
                  {t("dashboard.monthAbbrev")}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  {t("dashboard.avgExpenses")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {currencySymbol}
                  {Math.round(
                    yearlyViewData.totalExpenses /
                      yearlyViewData.monthsWithData,
                  ).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("dashboard.total")} {currencySymbol}
                  {Math.round(
                    yearlyViewData.totalExpenses,
                  ).toLocaleString()} · {yearlyViewData.monthsWithData}
                  {t("dashboard.monthAbbrev")}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  {t("dashboard.avgSavings")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${yearlyViewData.totalSavings >= 0 ? "text-emerald-600" : "text-destructive"}`}
                >
                  {currencySymbol}
                  {Math.round(
                    yearlyViewData.totalSavings / yearlyViewData.monthsWithData,
                  ).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("dashboard.total")} {currencySymbol}
                  {Math.round(
                    yearlyViewData.totalSavings,
                  ).toLocaleString()} · {yearlyViewData.monthsWithData}
                  {t("dashboard.monthAbbrev")}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  {t("dashboard.netWorth")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {currencySymbol}
                  {Math.round(
                    investmentSummary?.total_value || 0,
                  ).toLocaleString()}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>
                {t("dashboard.incomeVsExpenses")} (
                {aggregation === "month"
                  ? t("dashboard.monthly")
                  : t("dashboard.quarterly")}
                )
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[260px] w-full">
                <BarChart data={yearlyViewData.chartData}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="monthLabel"
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => `${currencySymbol}${v}`}
                    tickLine={false}
                    axisLine={false}
                  />
                  <ChartTooltip content={yearlyIncomeExpenseTooltip} />
                  <Legend />
                  <Bar dataKey="income" fill="hsl(var(--chart-1))" />
                  <Bar
                    dataKey="fixed"
                    stackId="exp"
                    fill="hsl(var(--chart-2))"
                  />
                  <Bar
                    dataKey="variable"
                    stackId="exp"
                    fill="hsl(var(--chart-3))"
                  />
                  <ReferenceLine y={0} stroke="hsl(var(--border))" />
                  <Line
                    type="monotone"
                    dataKey="savedOrOverspent"
                    stroke="hsl(var(--chart-5))"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {t("dashboard.budgetVsReality")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="w-full">
                  <table className="w-full table-fixed text-xs">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="w-[22%] py-1 pr-1 text-left font-medium">
                          {t("dashboard.budgetRealityMo")}
                        </th>
                        <th className="w-[26%] py-1 pl-1 text-right font-medium">
                          {t("dashboard.budgetRealityInc")}
                        </th>
                        <th className="w-[26%] py-1 pl-1 text-right font-medium">
                          {t("dashboard.budgetRealityExp")}
                        </th>
                        <th className="w-[26%] py-1 pl-1 text-right font-medium">
                          {t("dashboard.budgetRealitySav")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {yearlyViewData.budgetVsReality.map((month) => (
                        <tr
                          key={month.month}
                          className="border-b last:border-b-0"
                        >
                          <td className="py-1 pr-1 font-medium truncate">{month.month}</td>
                          <td className="py-1 text-right">
                            <span
                              className="inline-block rounded px-1"
                              style={getPctBgStyle(month.incomePct)}
                            >
                              {formatPercent(month.incomePct)}
                            </span>
                          </td>
                          <td className="py-1 text-right">
                            <span
                              className="inline-block rounded px-1"
                              style={getPctBgStyle(month.expensesPct)}
                            >
                              {formatPercent(month.expensesPct)}
                            </span>
                          </td>
                          <td className="py-1 text-right">
                            <span
                              className="inline-block rounded px-1"
                              style={getPctBgStyle(Math.abs(month.savingsPct))}
                            >
                              {formatPercent(month.savingsPct)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {t("dashboard.heatmapTitle")}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {t("dashboard.heatmapSubtitle")}
                </p>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>{t("dashboard.low")}</span>
                  <div className="h-2 w-24 rounded bg-gradient-to-r from-muted via-chart-1/50 to-chart-1" />
                  <span>{t("dashboard.high")}</span>
                </div>
                <div className="w-full min-w-[26rem] space-y-1">
                  <div className="grid grid-cols-[100px_repeat(12,minmax(28px,1fr))] gap-0.5 text-[10px] text-muted-foreground">
                    <div />
                    {yearPeriodData.map((m) => (
                      <div key={m.key} className="text-center">
                        {m.monthLabel}
                      </div>
                    ))}
                  </div>
                  {yearlyViewData.heatmapCategories.map((cat) => (
                    <div
                      key={cat.id}
                      className="grid grid-cols-[100px_repeat(12,minmax(28px,1fr))] items-center gap-0.5"
                    >
                      <div className="truncate text-[10px] font-medium">
                        {cat.name}
                      </div>
                      {cat.cells.map((value, idx) => {
                        const intensity =
                          value > 0 ? Math.max(0.1, value / cat.maxCell) : 0;
                        return (
                          <div
                            key={`${cat.id}-${idx}`}
                            className="h-5 rounded-sm"
                            style={{
                              backgroundColor:
                                intensity > 0
                                  ? `hsl(var(--chart-1) / ${intensity})`
                                  : undefined,
                            }}
                            title={`${currencySymbol}${value.toFixed(0)}`}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
            <Card>
              <CardHeader>
                <CardTitle>
                  {t("dashboard.investmentsStacked", {
                    currency: settings?.main_currency || "EUR",
                  })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={chartConfig}
                  className="h-[280px] w-full"
                >
                  <AreaChart data={investmentEvolution}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} />
                    <YAxis
                      tickFormatter={(v) =>
                        `${currencySymbol}${Number(v).toFixed(0)}`
                      }
                      tickLine={false}
                      axisLine={false}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="Current"
                      stackId="nw"
                      stroke="hsl(var(--chart-3))"
                      fill="hsl(var(--chart-3))"
                      fillOpacity={0.5}
                    />
                    <Area
                      type="monotone"
                      dataKey="Emergency"
                      stackId="nw"
                      stroke="hsl(var(--chart-2))"
                      fill="hsl(var(--chart-2))"
                      fillOpacity={0.5}
                    />
                    <Area
                      type="monotone"
                      dataKey="Investments"
                      stackId="nw"
                      stroke="hsl(var(--chart-1))"
                      fill="hsl(var(--chart-1))"
                      fillOpacity={0.5}
                    />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("dashboard.budgetAlerts")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <p className="mb-2 font-medium">
                    {t("dashboard.highestVariableExpenses")}
                  </p>
                  {yearlyViewData.variableAlerts.map((cat) => (
                    <p key={cat.id} className="text-muted-foreground">
                      {cat.name}: {currencySymbol}
                      {cat.avg.toFixed(0)} {t("dashboard.averageAbbrev")}
                    </p>
                  ))}
                </div>
                <div>
                  <p className="mb-2 font-medium">
                    {t("dashboard.highestStandardDeviation")}
                  </p>
                  {yearlyViewData.stdDevAlerts.map((cat) => (
                    <p key={cat.id} className="text-muted-foreground">
                      {cat.name}: σ {cat.stdDev.toFixed(0)}
                    </p>
                  ))}
                </div>
                <div>
                  <p className="mb-2 font-medium">
                    {t("dashboard.unstablePatterns")}
                  </p>
                  {yearlyViewData.unstableAlerts.length > 0 ? (
                    yearlyViewData.unstableAlerts.map((cat) => (
                      <div
                        key={cat.id}
                        className="mb-1 flex items-center justify-between gap-2 rounded border p-2"
                      >
                        <span className="min-w-0 flex-1 break-words">
                          {cat.name}
                        </span>
                        <Badge className="shrink-0" variant="destructive">
                          CV {cat.cv.toFixed(0)}%
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground">
                      {t("dashboard.noUnstableCategories")}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {t("dashboard.categoryBudgetProgress")}
              </CardTitle>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-4 rounded-sm bg-black" /> Spent
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-4 rounded-sm border border-emerald-700"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(135deg, rgba(5, 150, 105, 0.4) 0 2px, rgba(5, 150, 105, 0.15) 2px 5px)",
                    }}
                  />
                  Under budget
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-4 rounded-sm border border-black bg-red-800" />
                  Over budget
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {yearlyViewData.yearlyCategoryBudgetProgress.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("dashboard.noBudgetsSetYet")}
                </p>
              ) : (
                yearlyViewData.yearlyCategoryBudgetProgress.map((cat) => {
                  const spentPct =
                    cat.annualBudget > 0
                      ? Math.min((cat.spentWithinAllowed / cat.annualBudget) * 100, 100)
                      : 0;
                  const allowedPct =
                    cat.annualBudget > 0
                      ? Math.min((cat.allowedByNow / cat.annualBudget) * 100, 100)
                      : 0;
                  const overspendPct =
                    cat.annualBudget > 0
                      ? Math.min((cat.overspent / cat.annualBudget) * 100, 100)
                      : 0;

                  return (
                    <div key={cat.id} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate font-medium">{cat.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground sm:text-sm">
                          {currencySymbol}
                          {cat.spent.toFixed(0)} / {currencySymbol}
                          {cat.annualBudget.toFixed(0)}
                        </span>
                      </div>
                      <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="absolute left-0 top-0 h-full bg-black"
                          style={{ width: `${spentPct}%` }}
                        />
                        {cat.spent <= cat.allowedByNow && allowedPct > spentPct ? (
                          <div
                            className="absolute top-0 h-full border border-emerald-700"
                            style={{
                              left: `${spentPct}%`,
                              width: `${allowedPct - spentPct}%`,
                              backgroundImage:
                                "repeating-linear-gradient(135deg, rgba(5, 150, 105, 0.45) 0 3px, rgba(5, 150, 105, 0.15) 3px 7px)",
                            }}
                          />
                        ) : null}
                        {cat.spent > cat.allowedByNow && overspendPct > 0 ? (
                          <div
                            className="absolute top-0 h-full border border-black bg-red-800"
                            style={{
                              left: `${Math.min(allowedPct, 100)}%`,
                              width: `${Math.min(overspendPct, 100 - Math.min(allowedPct, 100))}%`,
                            }}
                          />
                        ) : null}
                      </div>
                      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground sm:text-xs">
                        <span>
                          Consumed: {cat.consumedPct.toFixed(0)}%
                        </span>
                        <span>
                          Expected: {currencySymbol}
                          {cat.allowedByNow.toFixed(0)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("dashboard.yearlyExpenseMatrix")}</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[42rem] text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="sticky left-0 z-20 bg-muted py-2 pr-2 text-left font-medium">
                      {t("budget.categories")}
                    </th>
                    {yearPeriodData.map((m) => (
                      <th
                        key={`header-${m.key}`}
                        className="py-2 px-2 text-right font-medium"
                      >
                        {m.monthLabel}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {yearlyViewData.expenseCategoryRows.map((cat) => (
                    <tr key={cat.id} className="border-b last:border-b-0">
                      <td className="sticky left-0 z-10 bg-muted py-2 pr-2 font-medium">
                        {cat.name}
                      </td>
                      {cat.values.map((value, idx) => (
                        <td
                          key={`${cat.id}-${idx}`}
                          className="py-2 px-2 text-right"
                        >
                          {currencySymbol}
                          {value.toFixed(0)}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr className="border-b bg-muted/30 font-semibold">
                    <td className="sticky left-0 z-10 bg-muted py-2 pr-2">
                      {t("dashboard.totalExpenses")}
                    </td>
                    {yearlyViewData.monthlyStats.map((month) => (
                      <td
                        key={`expenses-${month.key}`}
                        className="py-2 px-2 text-right"
                      >
                        {currencySymbol}
                        {month.expenses.toFixed(0)}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b bg-muted/30 font-semibold">
                    <td className="sticky left-0 z-10 bg-muted py-2 pr-2">
                      {t("dashboard.totalIncome")}
                    </td>
                    {yearlyViewData.monthlyStats.map((month) => (
                      <td
                        key={`income-${month.key}`}
                        className="py-2 px-2 text-right"
                      >
                        {currencySymbol}
                        {month.income.toFixed(0)}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b bg-muted/30 font-semibold">
                    <td className="sticky left-0 z-10 bg-muted py-2 pr-2">
                      {t("dashboard.expenseIncomeRatio")}
                    </td>
                    {yearlyViewData.monthlyStats.map((month) => {
                      const ratio =
                        month.income > 0 ? month.expenses / month.income : 0;
                      return (
                        <td
                          key={`ratio-${month.key}`}
                          className="py-2 px-2 text-right"
                        >
                          {(ratio * 100).toFixed(1)}%
                        </td>
                      );
                    })}
                  </tr>
                  <tr className="bg-muted/30 font-semibold">
                    <td className="sticky left-0 z-10 bg-muted py-2 pr-2">
                      {t("dashboard.totalInvestmentValue")}
                    </td>
                    {investmentEvolution.map((investmentMonth, idx) => {
                      const total =
                        investmentMonth.Current +
                        investmentMonth.Emergency +
                        investmentMonth.Investments;
                      return (
                        <td
                          key={`investments-${idx}`}
                          className="py-2 px-2 text-right"
                        >
                          {currencySymbol}
                          {total.toFixed(0)}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
