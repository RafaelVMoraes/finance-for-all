import { ChevronLeft, ChevronRight } from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, LabelList, Legend, Line, TooltipProps, XAxis, YAxis } from "recharts";

import { CategoryBudgetProgressCard } from "@/components/dashboard/CategoryBudgetProgressCard";
import { MonthlySummaryCards } from "@/components/dashboard/monthly/MonthlySummaryCards";
import { MonthlyInvestmentEvolution, MonthlyViewData } from "@/components/dashboard/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { useI18n } from "@/i18n/I18nProvider";

interface MonthlyDashboardSectionProps {
  periodLabel: string;
  fiscalYearLabel?: string;
  onPreviousPeriod: () => void;
  onNextPeriod: () => void;
  monthlyViewData: MonthlyViewData;
  monthlyInvestmentEvolution: MonthlyInvestmentEvolution;
  currencySymbol: string;
  chartConfig: Record<string, { label: string; color: string }>;
  formatPercent: (value: number) => string;
  calculateRatio: (value: number, total: number) => number;
}

const compactNumber = (value: number) => Math.round(value).toString();

export function MonthlyDashboardSection({
  periodLabel,
  fiscalYearLabel,
  onPreviousPeriod,
  onNextPeriod,
  monthlyViewData,
  monthlyInvestmentEvolution,
  currencySymbol,
  chartConfig,
  formatPercent,
  calculateRatio,
}: MonthlyDashboardSectionProps) {
  const { t } = useI18n();

  const maxVariable = Math.max(1, ...monthlyViewData.expenseHeatmap.map((day) => day.variableTotal));

  const categoryKeys = Object.keys(monthlyViewData.monthlyInvestmentGrowthByCategory[0] || {}).filter(
    (key) => !["month", "hasData", "monthTotal"].includes(key),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={onPreviousPeriod}><ChevronLeft className="h-4 w-4" /></Button>
        <Badge variant="secondary">{periodLabel}</Badge>
        {fiscalYearLabel ? <Badge variant="outline">{fiscalYearLabel}</Badge> : null}
        <Button variant="outline" size="sm" onClick={onNextPeriod}><ChevronRight className="h-4 w-4" /></Button>
        <Badge variant="outline">{t("dashboard.analyzeMonthlyPerformance")}</Badge>
      </div>

      <MonthlySummaryCards
        monthlyViewData={monthlyViewData}
        monthlyInvestmentEvolution={monthlyInvestmentEvolution}
        currencySymbol={currencySymbol}
        formatPercent={formatPercent}
        calculateRatio={calculateRatio}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("dashboard.monthExpenseOverview")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1">
            {monthlyViewData.expenseHeatmap.map((day) => {
              const intensity = day.variableTotal > 0 ? day.variableTotal / maxVariable : 0;
              const bg = day.hasFixedOnly
                ? "#d1d5db"
                : `rgba(22, 163, 74, ${Math.max(0.08, Math.min(0.9, intensity))})`;

              const breakdown = day.categories
                .map((category) => `${category.name}: ${currencySymbol}${Math.round(category.amount)}`)
                .join(" · ");
              return (
                <div
                  key={day.date}
                  className="h-4 w-4 rounded-sm border border-border"
                  style={{ backgroundColor: day.hasTransactions ? bg : "rgba(22,163,74,0.03)" }}
                  title={`${day.label} · ${currencySymbol}${Math.round(day.total)}${breakdown ? ` · ${breakdown}` : ""}`}
                />
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{t("dashboard.heatMapHint")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("dashboard.weeklySpendingVsBudget")}</CardTitle>
        </CardHeader>
        <CardContent>
          {monthlyViewData.weeklyData.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-[260px] w-full">
              <ComposedChart data={monthlyViewData.weeklyData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="week" tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(v) => `${currencySymbol}${v}`} tickLine={false} axisLine={false} />
                <ChartTooltip
                  content={({ active, payload, label }: TooltipProps<number, string>) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="rounded-lg border bg-background p-3 text-xs shadow-md">
                        <p className="mb-2 font-medium">{label}</p>
                        {payload.map((entry) => (
                          <p key={entry.dataKey as string} className="text-muted-foreground">
                            {entry.name}: {currencySymbol}{compactNumber(Number(entry.value || 0))}
                          </p>
                        ))}
                      </div>
                    );
                  }}
                />
                <Legend />
                <Bar dataKey="spent" fill="hsl(var(--chart-1))" radius={6}>
                  <LabelList dataKey="deltaLabel" position="top" className="fill-muted-foreground text-xs" />
                </Bar>
                <Line type="monotone" dataKey="budget" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ChartContainer>
          ) : (
            <p className="py-8 text-center text-muted-foreground">{t("dashboard.noSpendingDataYet")}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard.topFiveExpenses")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {monthlyViewData.topExpenses.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("dashboard.noSpendingDataYet")}</p>
          ) : (
            monthlyViewData.topExpenses.map((expense) => (
              <div key={expense.id} className="flex items-center justify-between gap-3 rounded-md border p-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{expense.name}</p>
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: expense.categoryColor }} />
                    {expense.categoryName}
                  </p>
                </div>
                <p className="text-sm font-semibold">{currencySymbol}{Math.round(expense.amount).toLocaleString()}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <CategoryBudgetProgressCard
        rows={monthlyViewData.monthlyCategoryBudgetProgress}
        currencySymbol={currencySymbol}
        title={t("dashboard.categoryBudgetProgress")}
      />

      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard.investmentGrowthLastSixMonths")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[260px] w-full">
            <ComposedChart data={monthlyViewData.monthlyInvestmentGrowthByCategory}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <YAxis tickFormatter={(value) => `${Math.round(Number(value))}%`} tickLine={false} axisLine={false} />
              <ChartTooltip />
              <Legend />
              {categoryKeys.map((key, index) => (
                <Bar key={key} dataKey={key} stackId="investment-growth" fill={`hsl(var(--chart-${(index % 5) + 1}))`} />
              ))}
            </ComposedChart>
          </ChartContainer>
          <p className="text-xs text-muted-foreground">{t("dashboard.lastSixMonthsCalendar")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
