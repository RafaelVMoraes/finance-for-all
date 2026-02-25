import { useMemo, useState } from 'react';
import { addMonths, differenceInCalendarDays, endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  PiggyBank,
  Target,
  TrendingUp,
} from 'lucide-react';
import { Link } from 'react-router-dom';
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
} from 'recharts';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBudgets } from '@/hooks/useBudgets';
import { useInvestmentSummary, useMonthlySummary, useYearlySummary } from '@/hooks/useDashboardData';
import { useExchangeRates } from '@/hooks/useExchangeRates';
import { useUserSettings } from '@/hooks/useUserSettings';

const MONTH_OPTIONS = [
  { value: 0, label: 'January' },
  { value: 1, label: 'February' },
  { value: 2, label: 'March' },
  { value: 3, label: 'April' },
  { value: 4, label: 'May' },
  { value: 5, label: 'June' },
  { value: 6, label: 'July' },
  { value: 7, label: 'August' },
  { value: 8, label: 'September' },
  { value: 9, label: 'October' },
  { value: 10, label: 'November' },
  { value: 11, label: 'December' },
];

type YearAggregation = 'month' | 'quarter';

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

const calculateRatio = (value: number, total: number) => (total > 0 ? (value / total) * 100 : 0);

const getDistributionWeights = (distribution: string, weeksCount: number): number[] => {
  if (weeksCount <= 0) return [];

  if (distribution === 'front') {
    return Array.from({ length: weeksCount }, (_, idx) => weeksCount - idx);
  }

  if (distribution === 'back') {
    return Array.from({ length: weeksCount }, (_, idx) => idx + 1);
  }

  return Array.from({ length: weeksCount }, () => 1);
};

const createFourWeekBuckets = (weekValues: number[], monthDate: Date) => {
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const firstWeekStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const firstWeekEnd = endOfWeek(monthStart, { weekStartsOn: 1 });
  const lastWeekStart = startOfWeek(monthEnd, { weekStartsOn: 1 });

  const firstWeekDays = Math.max(1, differenceInCalendarDays(firstWeekEnd, monthStart) + 1);
  const lastWeekDays = Math.max(1, differenceInCalendarDays(monthEnd, lastWeekStart) + 1);

  if (weekValues.length <= 4) {
    return [...weekValues, ...Array(Math.max(0, 4 - weekValues.length)).fill(0)].slice(0, 4);
  }

  const extraWeeks = weekValues.length - 4;
  const collapseIntoFirst = firstWeekDays <= lastWeekDays;

  if (collapseIntoFirst) {
    const collapsedStart = weekValues.slice(0, extraWeeks + 1).reduce((sum, value) => sum + value, 0);
    return [collapsedStart, ...weekValues.slice(extraWeeks + 1)];
  }

  const collapsedEnd = weekValues.slice(weekValues.length - (extraWeeks + 1)).reduce((sum, value) => sum + value, 0);
  return [...weekValues.slice(0, weekValues.length - (extraWeeks + 1)), collapsedEnd];
};

export default function Dashboard() {
  const today = new Date();
  const [view, setView] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(format(today, 'yyyy-MM'));
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [yearStartMonth, setYearStartMonth] = useState(0);
  const [aggregation, setAggregation] = useState<YearAggregation>('month');

  const monthDate = useMemo(() => parseISO(`${selectedMonth}-01`), [selectedMonth]);

  const { settings } = useUserSettings();
  const { getRate } = useExchangeRates();
  const { monthlySettings, budgets, loading: budgetsLoading } = useBudgets({ month: monthDate });
  const { data: monthlySummary, loading: monthlyLoading, error: monthlyError } = useMonthlySummary(monthDate);
  const { data: yearlySummary, loading: yearlyLoading, error: yearlyError } = useYearlySummary(selectedYear);
  const { data: yearlySummaryNext, loading: yearlyLoadingNext, error: yearlyErrorNext } = useYearlySummary(selectedYear + 1);
  const { data: investmentSummary } = useInvestmentSummary();

  const getBudgetAmount = (categoryId: string) => budgets.find((b) => b.category_id === categoryId)?.expected_amount || 0;

  const monthlyViewData = useMemo(() => {
    if (!monthlySummary) return null;

    const categorySpending = monthlySummary.category_spending || [];
    const fixedCategories = categorySpending.filter((c) => c.type === 'fixed');
    const variableCategories = categorySpending.filter((c) => c.type === 'variable');

    const fixedExpenses = fixedCategories.reduce((sum, c) => sum + Number(c.spent), 0);
    const variableExpenses = variableCategories.reduce((sum, c) => sum + Number(c.spent), 0);
    const expectedIncome = monthlySettings?.expected_income || 0;
    const actualIncome = monthlySummary.total_income;
    const totalExpenses = monthlySummary.total_expenses;
    const actualSavings = actualIncome - totalExpenses;

    const totalBudgetedFixed = fixedCategories.reduce((sum, cat) => sum + getBudgetAmount(cat.id), 0);
    const totalBudgetedVariable = variableCategories.reduce((sum, cat) => sum + getBudgetAmount(cat.id), 0);
    const expectedExpenses = totalBudgetedFixed + totalBudgetedVariable;
    const expectedSavings = expectedIncome - totalBudgetedFixed - totalBudgetedVariable;
    const remainingBudget = expectedIncome - totalExpenses;

    const categoryProgress = categorySpending
      .filter((c) => c.type !== 'income')
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
    const weeksCount = Math.max(weeklySpending.length, 1);
    const weeklyBudget = Array.from({ length: weeksCount }, () => 0);

    budgets
      .filter((budget) => budget.categories?.type !== 'income' && Number(budget.expected_amount) > 0)
      .forEach((budget) => {
        const weights = getDistributionWeights(budget.distribution, weeksCount);
        const totalWeights = weights.reduce((sum, weight) => sum + weight, 0);

        if (totalWeights === 0) return;

        weights.forEach((weight, idx) => {
          weeklyBudget[idx] += (Number(budget.expected_amount) * weight) / totalWeights;
        });
      });

    const rawWeeklySpent = weeklySpending.map((w) => Number(w.spent));
    const condensedSpent = createFourWeekBuckets(rawWeeklySpent, monthDate);
    const condensedBudget = createFourWeekBuckets(weeklyBudget, monthDate);

    const weeklyData = condensedSpent.map((spent, idx) => {
      const budget = condensedBudget[idx] || 0;
      const delta = budget - spent;
      return {
        week: `Week ${idx + 1}`,
        spent,
        budget,
        delta,
        deltaLabel: `${delta >= 0 ? '+' : ''}${delta.toFixed(0)}`,
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
  }, [monthlySummary, monthlySettings, budgets, monthDate]);

  const monthlyInvestmentEvolution = useMemo(() => {
    if (!investmentSummary?.investments) return { current: 0, lastMonth: 0, pctChange: 0 };

    const targetCurrency = settings?.main_currency || 'EUR';
    const currentMonthStart = startOfMonth(monthDate);
    const lastMonthStart = startOfMonth(addMonths(monthDate, -1));

    const getNetWorthAtMonth = (pointInTime: Date) => {
      const point = format(pointInTime, 'yyyy-MM-dd');

      return investmentSummary.investments.reduce((sum, inv) => {
        const snapshot = inv.snapshots
          ?.filter((snap) => snap.month <= point)
          .sort((a, b) => b.month.localeCompare(a.month))[0];
        const rawValue = Number(snapshot?.total_value || 0);
        const rate = getRate(inv.currency as 'EUR' | 'USD' | 'BRL', targetCurrency, pointInTime).rate;
        return sum + rawValue * rate;
      }, 0);
    };

    const current = getNetWorthAtMonth(currentMonthStart);
    const lastMonth = getNetWorthAtMonth(lastMonthStart);
    const pctChange = lastMonth > 0 ? ((current - lastMonth) / lastMonth) * 100 : 0;

    return { current, lastMonth, pctChange };
  }, [getRate, investmentSummary, monthDate, settings?.main_currency]);

  const yearPeriodData = useMemo(() => {
    const currentYearMonths = yearlySummary?.monthly_data || [];
    const nextYearMonths = yearlySummaryNext?.monthly_data || [];
    const merged = [...currentYearMonths, ...nextYearMonths];
    const mergedMap = new Map(merged.map((m) => [format(parseISO(m.month_date), 'yyyy-MM'), m]));

    const startDate = new Date(selectedYear, yearStartMonth, 1);
    return Array.from({ length: 12 }).map((_, idx) => {
      const monthDatePoint = addMonths(startDate, idx);
      const key = format(monthDatePoint, 'yyyy-MM');
      const found = mergedMap.get(key);

      return {
        key,
        monthDate: monthDatePoint,
        monthLabel: format(monthDatePoint, 'MMM'),
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
      .filter((budget) => budget.categories?.type !== 'income')
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
      aggregation === 'quarter'
        ? [0, 1, 2, 3].map((qIdx) => {
            const chunk = monthlyStats.slice(qIdx * 3, qIdx * 3 + 3);
            const sum = (key: keyof (typeof chunk)[number]) => chunk.reduce((acc, item) => acc + Number(item[key] || 0), 0);
            return {
              monthLabel: `Q${qIdx + 1}`,
              income: sum('income'),
              fixed: sum('fixed'),
              variable: sum('variable'),
              savings: sum('savings'),
              expenses: sum('expenses'),
              savedOrOverspent: sum('savedOrOverspent'),
            };
          })
        : monthlyStats;

    const categoryMonthly = [
      ...(yearlySummary?.category_monthly_spending || []),
      ...(yearlySummaryNext?.category_monthly_spending || []),
    ];

    const byCategory: Record<string, { id: string; name: string; color: string; type: string; values: number[] }> = {};
    categoryMonthly.forEach((cm) => {
      const bucket = byCategory[cm.id] || {
        id: cm.id,
        name: cm.name,
        color: cm.color,
        type: cm.type,
        values: Array(12).fill(0),
      };
      const idx = cm.month_date ? yearPeriodData.findIndex((period) => period.key === format(parseISO(cm.month_date), 'yyyy-MM')) : -1;
      if (idx >= 0) bucket.values[idx] += Number(cm.spent || 0);
      byCategory[cm.id] = bucket;
    });

    const categoryStability = Object.values(byCategory)
      .map((cat) => {
        const values = cat.values.filter((v) => v > 0);
        const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        const variance = values.length > 1 ? values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length : 0;
        const stdDev = Math.sqrt(variance);
        const cv = avg > 0 ? (stdDev / avg) * 100 : 0;
        return { ...cat, avg, stdDev, cv, isVolatile: cv > 30 };
      })
      .filter((cat) => cat.avg > 0)
      .sort((a, b) => b.cv - a.cv);

    const variableAlerts = categoryStability
      .filter((cat) => cat.type === 'variable')
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 3);

    const stdDevAlerts = [...categoryStability].sort((a, b) => b.stdDev - a.stdDev).slice(0, 3);

    const heatmapCategories = [...categoryStability]
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 12)
      .map((cat) => ({
        ...cat,
        cells: cat.values,
        maxCell: Math.max(1, ...cat.values),
      }));

    const maxHeat = Math.max(1, ...heatmapCategories.flatMap((cat) => cat.cells));

    return {
      expectedIncome,
      expectedExpenses,
      expectedSavings,
      monthlyStats,
      chartData,
      categoryStability,
      variableAlerts,
      stdDevAlerts,
      unstableAlerts: categoryStability.filter((cat) => cat.isVolatile).slice(0, 3),
      budgetVsReality: monthlyStats.map((m) => ({
        month: m.monthLabel,
        actualIncome: m.income,
        actualExpenses: m.expenses,
        actualSavings: m.savedOrOverspent,
        incomePct: calculateRatio(m.income, expectedIncome),
        expensesPct: calculateRatio(m.expenses, expectedExpenses),
        savingsPct: expectedSavings !== 0 ? (m.savedOrOverspent / expectedSavings) * 100 : 0,
      })),
      heatmapCategories,
      maxHeat,
      totalIncome: monthlyStats.reduce((sum, m) => sum + m.income, 0),
      totalExpenses: monthlyStats.reduce((sum, m) => sum + m.expenses, 0),
      totalSavings: monthlyStats.reduce((sum, m) => sum + m.savings, 0),
    };
  }, [aggregation, budgets, monthlySettings, selectedYear, yearPeriodData, yearlySummary, yearlySummaryNext]);

  const investmentEvolution = useMemo(() => {
    if (!investmentSummary?.investments) return [];
    const targetCurrency = settings?.main_currency || 'EUR';

    return yearPeriodData.map((period) => {
      const monthDatePoint = startOfMonth(period.monthDate);
      const row = { month: period.monthLabel, Investments: 0, Emergency: 0, Current: 0 };

      investmentSummary.investments.forEach((inv) => {
        const snapshot = inv.snapshots
          ?.filter((snap) => snap.month <= format(monthDatePoint, 'yyyy-MM-dd'))
          .sort((a, b) => b.month.localeCompare(a.month))[0];
        const rawValue = Number(snapshot?.total_value || 0);
        const rate = getRate(inv.currency as 'EUR' | 'USD' | 'BRL', targetCurrency, monthDatePoint).rate;
        const converted = rawValue * rate;

        if (inv.investment_type === 'Investments') row.Investments += converted;
        else if (inv.investment_type === 'Emergency savings') row.Emergency += converted;
        else row.Current += converted;
      });

      return row;
    });
  }, [getRate, investmentSummary, settings?.main_currency, yearPeriodData]);

  const loading = (view === 'monthly' ? monthlyLoading : yearlyLoading || yearlyLoadingNext) || budgetsLoading;

  const chartConfig = {
    spent: { label: 'Spent', color: 'hsl(var(--chart-1))' },
    budget: { label: 'Budget', color: 'hsl(var(--chart-2))' },
    income: { label: 'Income', color: 'hsl(var(--chart-1))' },
    fixed: { label: 'Fixed', color: 'hsl(var(--chart-2))' },
    variable: { label: 'Variable', color: 'hsl(var(--chart-3))' },
    savings: { label: 'Savings', color: 'hsl(var(--chart-4))' },
    savedOrOverspent: { label: 'Saved / Overspent', color: 'hsl(var(--chart-5))' },
    incomeDelta: { label: 'Income Δ', color: 'hsl(var(--chart-1))' },
    expenseDelta: { label: 'Expense Δ', color: 'hsl(var(--chart-2))' },
    savingsDelta: { label: 'Savings Δ', color: 'hsl(var(--chart-4))' },
    Investments: { label: 'Investments', color: 'hsl(var(--chart-1))' },
    Emergency: { label: 'Emergency', color: 'hsl(var(--chart-2))' },
    Current: { label: 'Current', color: 'hsl(var(--chart-3))' },
  };

  if (loading) return <div className="flex h-64 items-center justify-center text-muted-foreground">Loading dashboard...</div>;
  if (monthlyError || yearlyError || yearlyErrorNext) {
    return <div className="flex h-64 items-center justify-center text-destructive">Failed to load dashboard data.</div>;
  }

  const yearlyIncomeExpenseTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey?: string; value?: number; payload?: Record<string, number> }>; label?: string }) => {
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
          <p>Income: €{income.toFixed(0)}</p>
          <p>Fixed: €{fixed.toFixed(0)} ({formatPercent(calculateRatio(fixed, income))})</p>
          <p>Variable: €{variable.toFixed(0)} ({formatPercent(calculateRatio(variable, income))})</p>
          <p className={savedOrOverspent >= 0 ? 'text-emerald-600' : 'text-destructive'}>
            {savedOrOverspent >= 0 ? 'Saved' : 'Overspent'}: €{Math.abs(savedOrOverspent).toFixed(0)} ({formatPercent(calculateRatio(Math.abs(savedOrOverspent), income))})
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <Tabs value={view} onValueChange={(v) => setView(v as 'monthly' | 'yearly')}>
          <TabsList>
            <TabsTrigger value="monthly" className="gap-2"><Calendar className="h-4 w-4" />Monthly</TabsTrigger>
            <TabsTrigger value="yearly" className="gap-2"><Target className="h-4 w-4" />Yearly</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {view === 'monthly' && monthlyViewData && (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="rounded-md border bg-background px-3 py-2 text-sm"
            />
            <Badge variant="outline">Analyze monthly performance</Badge>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm text-muted-foreground">Income (Actual / Expected)</CardTitle><ArrowUpRight className="h-4 w-4 text-emerald-500" /></CardHeader><CardContent><div className="text-2xl font-bold">€{monthlyViewData.actualIncome.toLocaleString()}</div><p className="text-xs text-muted-foreground">Expected €{monthlyViewData.expectedIncome.toLocaleString()} · {formatPercent(calculateRatio(monthlyViewData.actualIncome, monthlyViewData.expectedIncome || 1))}</p></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm text-muted-foreground">Expenses (Actual / Expected)</CardTitle><ArrowDownRight className="h-4 w-4 text-destructive" /></CardHeader><CardContent><div className="text-2xl font-bold">€{monthlyViewData.totalExpenses.toLocaleString()}</div><p className="text-xs text-muted-foreground">Expected €{monthlyViewData.expectedExpenses.toFixed(0)} · {formatPercent(calculateRatio(monthlyViewData.totalExpenses, monthlyViewData.expectedExpenses || 1))}</p></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm text-muted-foreground">Savings (Actual / Expected)</CardTitle><PiggyBank className="h-4 w-4 text-primary" /></CardHeader><CardContent><div className={`text-2xl font-bold ${monthlyViewData.actualSavings >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>€{monthlyViewData.actualSavings.toFixed(0)}</div><p className="text-xs text-muted-foreground">Expected €{monthlyViewData.expectedSavings.toFixed(0)} · {formatPercent(monthlyViewData.expectedSavings !== 0 ? (monthlyViewData.actualSavings / monthlyViewData.expectedSavings) * 100 : 0)}</p></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm text-muted-foreground">Budget Balance (Actual / Expected)</CardTitle><TrendingUp className="h-4 w-4 text-chart-4" /></CardHeader><CardContent><div className={`text-2xl font-bold ${monthlyViewData.remainingBudget >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>€{monthlyViewData.remainingBudget.toLocaleString()}</div><p className="text-xs text-muted-foreground">Expected €{monthlyViewData.expectedSavings.toFixed(0)}</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Investments vs Last Month</CardTitle></CardHeader><CardContent><div className={`text-2xl font-bold ${monthlyInvestmentEvolution.pctChange >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>{formatPercent(monthlyInvestmentEvolution.pctChange)}</div><p className="text-xs text-muted-foreground">{(settings?.main_currency || 'EUR')} {monthlyInvestmentEvolution.current.toFixed(0)} vs {(settings?.main_currency || 'EUR')} {monthlyInvestmentEvolution.lastMonth.toFixed(0)}</p></CardContent></Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-lg">Weekly Spending vs Budget</CardTitle></CardHeader>
              <CardContent>
                {monthlyViewData.weeklyData.length > 0 ? (
                  <ChartContainer config={chartConfig} className="h-[260px] w-full">
                    <ComposedChart data={monthlyViewData.weeklyData}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="week" tickLine={false} axisLine={false} />
                      <YAxis tickFormatter={(v) => `€${v}`} tickLine={false} axisLine={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Legend />
                      <Bar dataKey="spent" fill="hsl(var(--chart-1))" radius={6}>
                        <LabelList dataKey="deltaLabel" position="top" className="fill-muted-foreground text-xs" />
                      </Bar>
                      <Line type="monotone" dataKey="budget" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ChartContainer>
                ) : <p className="py-8 text-center text-muted-foreground">No spending data yet</p>}
              </CardContent>
            </Card>

            {monthlyViewData.alerts.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><AlertTriangle className="h-5 w-5 text-amber-500" />Budget Alerts</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {monthlyViewData.alerts.map((alert) => (
                    <div key={alert.id} className="space-y-1 rounded-md border p-3">
                      <div className="flex items-center justify-between"><span className="font-medium">{alert.name}</span><Badge variant={alert.percent >= 100 ? 'destructive' : 'secondary'}>{alert.percent.toFixed(0)}%</Badge></div>
                      <p className="text-xs text-muted-foreground">€{alert.spent.toFixed(0)} / €{alert.budget.toFixed(0)}</p>
                      <Progress value={Math.min(alert.percent, 100)} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          <Card>
            <CardHeader><CardTitle>Category Budget Progress</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {monthlyViewData.categoryProgress.length === 0 ? <p className="text-muted-foreground">No budgets set yet.</p> : monthlyViewData.categoryProgress.slice(0, 12).map((cat) => (
                <div key={cat.id} className="space-y-1">
                  <div className="flex justify-between text-sm"><span>{cat.name}</span><span>€{cat.spent.toFixed(0)} / €{cat.budget.toFixed(0)}</span></div>
                  <Progress value={Math.min(cat.percent, 100)} />
                </div>
              ))}
              <div className="pt-2"><Button asChild variant="outline"><Link to="/budget">Adjust Budget</Link></Button></div>
            </CardContent>
          </Card>
        </div>
      )}

      {view === 'yearly' && yearlyViewData && (
        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-start">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Year window start</p>
                <input type="number" value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value) || today.getFullYear())} className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Start month</p>
                <Select value={String(yearStartMonth)} onValueChange={(v) => setYearStartMonth(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTH_OPTIONS.map((month) => <SelectItem key={month.value} value={String(month.value)}>{month.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Aggregation</p>
                <Select value={aggregation} onValueChange={(v) => setAggregation(v as YearAggregation)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">Monthly</SelectItem>
                    <SelectItem value="quarter">Quarterly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

          </div>

          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Income</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">€{yearlyViewData.totalIncome.toLocaleString()}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Expenses</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">€{yearlyViewData.totalExpenses.toLocaleString()}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Savings</CardTitle></CardHeader><CardContent><div className={`text-2xl font-bold ${yearlyViewData.totalSavings >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>€{yearlyViewData.totalSavings.toLocaleString()}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Net Worth</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">€{(investmentSummary?.total_value || 0).toLocaleString()}</div></CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Income vs Expenses ({aggregation === 'month' ? 'Monthly' : 'Quarterly'})</CardTitle></CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[260px] w-full">
                <BarChart data={yearlyViewData.chartData}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="monthLabel" tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={(v) => `€${v}`} tickLine={false} axisLine={false} />
                  <ChartTooltip content={yearlyIncomeExpenseTooltip} />
                  <Legend />
                  <Bar dataKey="income" fill="hsl(var(--chart-1))" />
                  <Bar dataKey="fixed" stackId="exp" fill="hsl(var(--chart-2))" />
                  <Bar dataKey="variable" stackId="exp" fill="hsl(var(--chart-3))" />
                  <ReferenceLine y={0} stroke="hsl(var(--border))" />
                  <Line type="monotone" dataKey="savedOrOverspent" stroke="hsl(var(--chart-5))" strokeWidth={2} dot={{ r: 3 }} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Budget vs Reality (Real / Expected)</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="min-w-[520px] w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="py-2 text-left font-medium">Month</th>
                      <th className="py-2 text-right font-medium">Income</th>
                      <th className="py-2 text-right font-medium">Expenses</th>
                      <th className="py-2 text-right font-medium">Savings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yearlyViewData.budgetVsReality.map((month) => (
                      <tr key={month.month} className="border-b last:border-b-0">
                        <td className="py-2">{month.month}</td>
                        <td className="py-2 text-right">{formatPercent(month.incomePct)}</td>
                        <td className="py-2 text-right">{formatPercent(month.expensesPct)}</td>
                        <td className="py-2 text-right">{formatPercent(month.savingsPct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
          </Card>

          <Card>
              <CardHeader><CardTitle>Condensed Heatmap (Category × Month)</CardTitle><p className="text-xs text-muted-foreground">Colors are relative to each category's own monthly peak to make patterns easier to compare.</p></CardHeader>
              <CardContent className="overflow-x-auto">
                <div className="mb-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>Lower spend</span>
                  <div className="h-2 w-36 rounded bg-gradient-to-r from-muted via-chart-1/50 to-chart-1" />
                  <span>Higher spend</span>
                </div>
                <div className="min-w-[560px] space-y-2">
                  <div className="grid grid-cols-[96px_repeat(12,minmax(34px,1fr))] gap-1 text-xs text-muted-foreground">
                    <div />
                    {yearPeriodData.map((m) => <div key={m.key} className="text-center">{m.monthLabel}</div>)}
                  </div>
                  {yearlyViewData.heatmapCategories.map((cat) => (
                    <div key={cat.id} className="grid grid-cols-[140px_repeat(12,minmax(24px,1fr))] items-center gap-1">
                      <div className="truncate text-xs font-medium">{cat.name}</div>
                      {cat.cells.map((value, idx) => {
                        const intensity = Math.max(0.08, value / yearlyViewData.maxHeat);
                        return <div key={`${cat.id}-${idx}`} className="h-5 rounded" style={{ backgroundColor: `hsl(var(--chart-1) / ${intensity})` }} title={`€${value.toFixed(0)} (${Math.round(intensity * 100)}% intensity)`} />;
                      })}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Investments (Stacked Net Worth in {settings?.main_currency || 'EUR'})</CardTitle></CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[280px] w-full">
                  <AreaChart data={investmentEvolution}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={(v) => `${settings?.main_currency || 'EUR'} ${Number(v).toFixed(0)}`} tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend />
                    <Area type="monotone" dataKey="Current" stackId="nw" stroke="hsl(var(--chart-3))" fill="hsl(var(--chart-3))" fillOpacity={0.5} />
                    <Area type="monotone" dataKey="Emergency" stackId="nw" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.5} />
                    <Area type="monotone" dataKey="Investments" stackId="nw" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.5} />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Budget Alerts</CardTitle></CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <p className="mb-2 font-medium">Highest variable expenses</p>
                  {yearlyViewData.variableAlerts.map((cat) => <p key={cat.id} className="text-muted-foreground">{cat.name}: €{cat.avg.toFixed(0)} avg</p>)}
                </div>
                <div>
                  <p className="mb-2 font-medium">Highest standard deviation</p>
                  {yearlyViewData.stdDevAlerts.map((cat) => <p key={cat.id} className="text-muted-foreground">{cat.name}: σ {cat.stdDev.toFixed(0)}</p>)}
                </div>
                <div>
                  <p className="mb-2 font-medium">Unstable patterns</p>
                  {yearlyViewData.unstableAlerts.length > 0 ? yearlyViewData.unstableAlerts.map((cat) => (
                    <div key={cat.id} className="mb-1 flex items-center justify-between rounded border p-2">
                      <span>{cat.name}</span><Badge variant="destructive">CV {cat.cv.toFixed(0)}%</Badge>
                    </div>
                  )) : <p className="text-muted-foreground">No unstable categories detected.</p>}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
