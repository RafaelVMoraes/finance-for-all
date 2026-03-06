import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, ReferenceLine, XAxis, YAxis } from "recharts";

import { YearlySummaryCards } from "@/components/dashboard/yearly/YearlySummaryCards";
import {
  InvestmentEvolutionItem,
  YearPeriodItem,
  YearlyTooltipRenderer,
  YearlyViewData,
} from "@/components/dashboard/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
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
  yearlyStartMonth: string;
  minMonth: string;
  onYearWindowChange: (month: string) => void;
  aggregation: "month" | "quarter";
  onAggregationChange: (value: "month" | "quarter") => void;
  currencySymbol: string;
  chartConfig: Record<string, { label: string; color: string }>;
  yearlyIncomeExpenseTooltip: YearlyTooltipRenderer;
  
  investmentEvolution: InvestmentEvolutionItem[];
  netWorth: number;
}

export function YearlyDashboardSection({
  yearlyViewData,
  yearPeriodData,
  yearlyStartMonth,
  minMonth,
  onYearWindowChange,
  aggregation,
  onAggregationChange,
  currencySymbol,
  chartConfig,
  yearlyIncomeExpenseTooltip,
  
  investmentEvolution,
  netWorth,
}: YearlyDashboardSectionProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-start">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{t("dashboard.yearWindowStart")}</p>
            <input
              type="month"
              value={yearlyStartMonth}
              min={minMonth}
              onChange={(e) => onYearWindowChange(e.target.value)}
              className="w-full max-w-full min-w-0 rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
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
      </div>

      <YearlySummaryCards yearlyViewData={yearlyViewData} currencySymbol={currencySymbol} netWorth={netWorth} />

      <Card>
        <CardHeader>
          <CardTitle>
            {t("dashboard.incomeVsExpenses")} ({aggregation === "month" ? t("dashboard.monthly") : t("dashboard.quarterly")})
          </CardTitle>
        </CardHeader>
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
      </Card>

      <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("dashboard.budgetVsReality")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full">
              <table className="w-full table-fixed text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="w-[22%] py-1 pr-1 text-left font-medium">{t("dashboard.budgetRealityMo")}</th>
                    <th className="w-[26%] py-1 pl-1 text-right font-medium">{t("dashboard.budgetRealityInc")}</th>
                    <th className="w-[26%] py-1 pl-1 text-right font-medium">{t("dashboard.budgetRealityExp")}</th>
                    <th className="w-[26%] py-1 pl-1 text-right font-medium">{t("dashboard.budgetRealitySav")}</th>
                  </tr>
                </thead>
                <tbody>
                  {yearlyViewData.budgetVsReality.map((row) => (
                    <tr key={row.month} className="border-b last:border-b-0">
                      <td className="py-2 pr-1 text-left font-medium">{row.month}</td>
                      <td className="py-2 pl-1 text-right">{row.incomePct.toFixed(0)}%</td>
                      <td className="py-2 pl-1 text-right">{row.expensesPct.toFixed(0)}%</td>
                      <td className={`py-2 pl-1 text-right ${row.actualSavings >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                        {row.savingsPct.toFixed(0)}%
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
            <CardTitle className="text-base">{t("dashboard.investmentsStacked", { currency: currencySymbol })}</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[260px] w-full">
              <AreaChart data={investmentEvolution}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(v) => `${currencySymbol}${v}`} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <Area type="monotone" dataKey="Investments" stackId="a" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.35} />
                <Area type="monotone" dataKey="Emergency" stackId="a" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.35} />
                <Area type="monotone" dataKey="Current" stackId="a" stroke="hsl(var(--chart-3))" fill="hsl(var(--chart-3))" fillOpacity={0.35} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("dashboard.categoryBudgetProgress")}</CardTitle>
          <p className="text-xs text-muted-foreground">{t("dashboard.categoryBudgetProgressYearlySubtitle")}</p>
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
            <p className="text-sm text-muted-foreground">{t("dashboard.noBudgetsSetYet")}</p>
          ) : (
            yearlyViewData.yearlyCategoryBudgetProgress.slice(0, 15).map((cat) => {
              const allowedPct = cat.annualBudget > 0 ? Math.min((cat.allowedByNow / cat.annualBudget) * 100, 100) : 0;
              const spentPct = cat.annualBudget > 0 ? Math.min((cat.spent / cat.annualBudget) * 100, 100) : 0;
              const overspentPct = cat.annualBudget > 0 ? Math.min((Math.max(0, cat.spent - cat.allowedByNow) / cat.annualBudget) * 100, 100) : 0;

              return (
                <div key={cat.id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate font-medium">{cat.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground sm:text-sm">
                      {currencySymbol}{cat.spent.toFixed(0)} / {currencySymbol}{cat.allowedByNow.toFixed(0)}
                    </span>
                  </div>
                  <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
                    {/* Black: spent within allowed */}
                    <div
                      className="absolute left-0 top-0 h-full bg-black"
                      style={{ width: `${spentPct}%` }}
                    />
                    {/* Hatched green: underspent (allowed but not yet spent) */}
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
                    {/* Dark red with black border: overspent */}
                    {cat.spent > cat.allowedByNow && overspentPct > 0 ? (
                      <div
                        className="absolute top-0 h-full border border-black bg-red-800"
                        style={{
                          left: `${Math.min(allowedPct, 100)}%`,
                          width: `${Math.min(overspentPct, 100 - Math.min(allowedPct, 100))}%`,
                        }}
                      />
                    ) : null}
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground sm:text-xs">
                    <span>Consumed: {(cat.allowedByNow > 0 ? (cat.spent / cat.allowedByNow) * 100 : 0).toFixed(0)}%</span>
                    <span>{t("dashboard.expected")}: {currencySymbol}{cat.allowedByNow.toFixed(0)}</span>
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
                  const total = investmentMonth.Current + investmentMonth.Emergency + investmentMonth.Investments;
                  return <td key={`investments-${idx}`} className="py-2 px-2 text-right">{currencySymbol}{total.toFixed(0)}</td>;
                })}
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
