import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, ReferenceLine, TooltipProps, XAxis, YAxis } from "recharts";

import { CategoryBudgetProgressCard } from "@/components/dashboard/CategoryBudgetProgressCard";
import { YearlySummaryCards } from "@/components/dashboard/yearly/YearlySummaryCards";
import {
  InvestmentEvolutionItem,
  MonthlyInvestmentGrowthItem,
  YearPeriodItem,
  YearlyTooltipRenderer,
  YearlyViewData,
} from "@/components/dashboard/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/i18n/I18nProvider";

interface YearlyDashboardSectionProps {
  yearlyViewData: YearlyViewData;
  yearPeriodData: YearPeriodItem[];
  fiscalYearBoundsLabel: string;
  aggregation: "month" | "quarter";
  onAggregationChange: (value: "month" | "quarter") => void;
  currencySymbol: string;
  chartConfig: Record<string, { label: string; color: string }>;
  yearlyIncomeExpenseTooltip: YearlyTooltipRenderer;

  investmentEvolution: InvestmentEvolutionItem[];
  investmentGrowthData: MonthlyInvestmentGrowthItem[];
  netWorth: number;
  yearlyInvestmentGain: number;
}

const LS_KEYS = {
  incomeExpenses: "dashboard_yearly_income_expenses_open",
  budget: "dashboard_yearly_budget_open",
  investments: "dashboard_yearly_investments_open",
};

const sumStack = (month: InvestmentEvolutionItem) =>
  (month.Current ?? 0) + (month.Emergency ?? 0) + (month.Investments ?? 0);

export function YearlyDashboardSection({
  yearlyViewData,
  yearPeriodData,
  fiscalYearBoundsLabel,
  aggregation,
  onAggregationChange,
  currencySymbol,
  chartConfig,
  yearlyIncomeExpenseTooltip,

  investmentEvolution,
  investmentGrowthData,
  netWorth,
  yearlyInvestmentGain,
}: YearlyDashboardSectionProps) {
  const { t } = useI18n();
  const [openState, setOpenState] = useState({ incomeExpenses: true, budget: true, investments: true });

  useEffect(() => {
    setOpenState({
      incomeExpenses: localStorage.getItem(LS_KEYS.incomeExpenses) !== "false",
      budget: localStorage.getItem(LS_KEYS.budget) !== "false",
      investments: localStorage.getItem(LS_KEYS.investments) !== "false",
    });
  }, []);

  const setSection = (key: keyof typeof openState) => {
    const next = !openState[key];
    setOpenState((prev) => ({ ...prev, [key]: next }));
    localStorage.setItem(LS_KEYS[key], String(next));
  };

  const nonNullTotals = investmentEvolution
    .map((month) => (month.Current === null || month.Emergency === null || month.Investments === null ? null : sumStack(month)))
    .filter((value): value is number => value !== null);
  const lowestStackedValue = nonNullTotals.length > 0 ? Math.min(...nonNullTotals) : 0;
  const stackedYAxisMin = lowestStackedValue > 0 ? lowestStackedValue * 0.98 : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-start">
        <p className="text-sm text-muted-foreground">{t("dashboard.fiscalYearRange", { range: fiscalYearBoundsLabel })}</p>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">{t("dashboard.aggregation")}</p>
          <Select value={aggregation} onValueChange={(v) => onAggregationChange(v as "month" | "quarter") }>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">{t("dashboard.monthly")}</SelectItem>
              <SelectItem value="quarter">{t("dashboard.quarterly")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <YearlySummaryCards
        yearlyViewData={yearlyViewData}
        currencySymbol={currencySymbol}
        netWorth={netWorth}
        yearlyInvestmentGain={yearlyInvestmentGain}
      />

      <Card>
        <CardHeader className="cursor-pointer" onClick={() => setSection("incomeExpenses")}>
          <div className="flex items-center justify-between">
            <CardTitle>{t("dashboard.incomeExpensesSection")}</CardTitle>
            {openState.incomeExpenses ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </div>
        </CardHeader>
        {openState.incomeExpenses ? (
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[260px] w-full">
              <BarChart data={yearlyViewData.chartData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="monthLabel" tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(v) => `${currencySymbol}${v}`} tickLine={false} axisLine={false} />
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
        ) : null}
      </Card>

      <Card>
        <CardHeader className="cursor-pointer" onClick={() => setSection("budget")}>
          <div className="flex items-center justify-between">
            <CardTitle>{t("dashboard.budgetSection")}</CardTitle>
            {openState.budget ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </div>
        </CardHeader>
        {openState.budget ? (
          <CardContent>
            <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
              <CategoryBudgetProgressCard rows={yearlyViewData.yearlyCategoryBudgetProgress} currencySymbol={currencySymbol} title={t("dashboard.categoryBudgetProgress")} />
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">{t("dashboard.budgetVsReality")}</CardTitle></CardHeader>
                <CardContent>
                  <div className="w-full">
                    <table className="w-full table-fixed text-xs">
                      <thead><tr className="border-b text-muted-foreground"><th className="w-[22%] py-1 pr-1 text-left font-medium">{t("dashboard.budgetRealityMo")}</th><th className="w-[26%] py-1 pl-1 text-right font-medium">{t("dashboard.budgetRealityInc")}</th><th className="w-[26%] py-1 pl-1 text-right font-medium">{t("dashboard.budgetRealityExp")}</th><th className="w-[26%] py-1 pl-1 text-right font-medium">{t("dashboard.budgetRealitySav")}</th></tr></thead>
                      <tbody>{yearlyViewData.budgetVsReality.map((row) => (<tr key={row.month} className="border-b last:border-b-0"><td className="py-2 pr-1 text-left font-medium">{row.month}</td><td className="py-2 pl-1 text-right">{row.incomePct.toFixed(0)}%</td><td className="py-2 pl-1 text-right">{row.expensesPct.toFixed(0)}%</td><td className={`py-2 pl-1 text-right ${row.actualSavings >= 0 ? "text-emerald-600" : "text-destructive"}`}>{row.savingsPct.toFixed(0)}%</td></tr>))}</tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        ) : null}
      </Card>

      <Card>
        <CardHeader className="cursor-pointer" onClick={() => setSection("investments")}>
          <div className="flex items-center justify-between">
            <CardTitle>{t("dashboard.investmentsSection")}</CardTitle>
            {openState.investments ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </div>
        </CardHeader>
        {openState.investments ? (
          <CardContent>
            <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">{t("dashboard.investmentsStacked", { currency: currencySymbol })}</CardTitle></CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[260px] w-full">
                    <AreaChart data={investmentEvolution}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="month" tickLine={false} axisLine={false} />
                      <YAxis domain={[stackedYAxisMin, "auto"]} tickFormatter={(v) => `${currencySymbol}${v}`} tickLine={false} axisLine={false} />
                      <ChartTooltip />
                      <Legend />
                      <Area type="monotone" dataKey="Investments" stackId="a" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.35} connectNulls={false} />
                      <Area type="monotone" dataKey="Emergency" stackId="a" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.35} connectNulls={false} />
                      <Area type="monotone" dataKey="Current" stackId="a" stroke="hsl(var(--chart-3))" fill="hsl(var(--chart-3))" fillOpacity={0.35} connectNulls={false} />
                    </AreaChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">{t("dashboard.monthlyPctGrowthInvestments")}</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <ChartContainer config={chartConfig} className="h-[260px] w-full">
                    <AreaChart data={investmentGrowthData}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="month" tickLine={false} axisLine={false} />
                      <YAxis tickFormatter={(value) => `${Math.round(Number(value))}%`} tickLine={false} axisLine={false} />
                      <ReferenceLine y={0} stroke="hsl(var(--border))" />
                      <ChartTooltip content={({ active, payload, label }: TooltipProps<number, string>) => {
                        if (!active || !payload?.length) return null;
                        const row = payload[0]?.payload as MonthlyInvestmentGrowthItem;
                        if (row?.cumulativePct === null) return null;
                        return <div className="rounded-lg border bg-background p-3 text-xs shadow-md"><p className="font-medium">{label}</p><p>{t("dashboard.allAndMonth", { all: Math.round(row?.cumulativePct || 0), month: Math.round(row?.monthPct || 0) })}</p></div>;
                      }} />
                      <Area type="monotone" dataKey="cumulativePct" stroke="hsl(var(--chart-4))" fill="hsl(var(--chart-4))" fillOpacity={0.25} connectNulls={false} />
                    </AreaChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        ) : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard.yearlyExpenseMatrix")}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[42rem] text-xs">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="sticky left-0 z-20 bg-muted py-2 pr-2 text-left font-medium">{t("budget.categories")}</th>
                {yearPeriodData.map((m) => (
                  <th key={`header-${m.key}`} className="py-2 px-2 text-right font-medium">{m.monthLabel}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {yearlyViewData.expenseCategoryRows.map((cat) => (
                <tr key={cat.id} className="border-b last:border-b-0">
                  <td className="sticky left-0 z-10 bg-muted py-2 pr-2 font-medium">{cat.name}</td>
                  {cat.values.map((value, idx) => (
                    <td key={`${cat.id}-${idx}`} className="py-2 px-2 text-right">{currencySymbol}{value.toFixed(0)}</td>
                  ))}
                </tr>
              ))}
              <tr className="border-b bg-muted/30 font-semibold">
                <td className="sticky left-0 z-10 bg-muted py-2 pr-2">{t("dashboard.totalExpenses")}</td>
                {yearlyViewData.monthlyStats.map((month) => (
                  <td key={`expenses-${month.key}`} className="py-2 px-2 text-right">{currencySymbol}{month.expenses.toFixed(0)}</td>
                ))}
              </tr>
              <tr className="border-b bg-muted/30 font-semibold">
                <td className="sticky left-0 z-10 bg-muted py-2 pr-2">{t("dashboard.totalIncome")}</td>
                {yearlyViewData.monthlyStats.map((month) => (
                  <td key={`income-${month.key}`} className="py-2 px-2 text-right">{currencySymbol}{month.income.toFixed(0)}</td>
                ))}
              </tr>
              <tr className="border-b bg-muted/30 font-semibold">
                <td className="sticky left-0 z-10 bg-muted py-2 pr-2">{t("dashboard.expenseIncomeRatio")}</td>
                {yearlyViewData.monthlyStats.map((month) => {
                  const ratio = month.income > 0 ? month.expenses / month.income : 0;
                  return <td key={`ratio-${month.key}`} className="py-2 px-2 text-right">{(ratio * 100).toFixed(1)}%</td>;
                })}
              </tr>
              <tr className="bg-muted/30 font-semibold">
                <td className="sticky left-0 z-10 bg-muted py-2 pr-2">{t("dashboard.totalInvestmentValue")}</td>
                {investmentEvolution.map((investmentMonth, idx) => {
                  const total =
                    investmentMonth.Current === null ||
                    investmentMonth.Emergency === null ||
                    investmentMonth.Investments === null
                      ? null
                      : investmentMonth.Current + investmentMonth.Emergency + investmentMonth.Investments;
                  return <td key={`investments-${idx}`} className="py-2 px-2 text-right">{total === null ? "—" : `${currencySymbol}${total.toFixed(0)}`}</td>;
                })}
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
