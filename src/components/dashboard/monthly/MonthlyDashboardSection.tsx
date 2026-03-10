import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { Bar, CartesianGrid, ComposedChart, LabelList, Legend, Line, XAxis, YAxis } from "recharts";

import { MonthlySummaryCards } from "@/components/dashboard/monthly/MonthlySummaryCards";
import { MonthlyInvestmentEvolution, MonthlyInvestmentRateRow, MonthlyViewData } from "@/components/dashboard/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { useI18n } from "@/i18n/I18nProvider";

interface MonthlyDashboardSectionProps {
  selectedMonth: string;
  minMonth: string;
  onMonthChange: (month: string) => void;
  monthlyViewData: MonthlyViewData;
  monthlyInvestmentEvolution: MonthlyInvestmentEvolution;
  currencySymbol: string;
  commentDraft: string;
  onCommentChange: (value: string) => void;
  chartConfig: Record<string, { label: string; color: string }>;
  formatPercent: (value: number) => string;
  calculateRatio: (value: number, total: number) => number;
  monthlyInvestmentRates: MonthlyInvestmentRateRow[];
}

export function MonthlyDashboardSection({
  selectedMonth,
  minMonth,
  onMonthChange,
  monthlyViewData,
  monthlyInvestmentEvolution,
  currencySymbol,
  commentDraft,
  onCommentChange,
  chartConfig,
  formatPercent,
  calculateRatio,
  monthlyInvestmentRates,
}: MonthlyDashboardSectionProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="month"
          min={minMonth}
          value={selectedMonth}
          onChange={(e) => onMonthChange(e.target.value)}
          className="w-full max-w-full min-w-0 rounded-md border bg-background px-3 py-2 text-sm sm:w-auto"
        />
        <Badge variant="outline">{t("dashboard.analyzeMonthlyPerformance")}</Badge>
      </div>

      <MonthlySummaryCards
        monthlyViewData={monthlyViewData}
        monthlyInvestmentEvolution={monthlyInvestmentEvolution}
        currencySymbol={currencySymbol}
        formatPercent={formatPercent}
        calculateRatio={calculateRatio}
      />

      <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
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
                  <ChartTooltip content={<ChartTooltipContent />} />
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
                <div key={alert.id} className="space-y-1 rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 flex-1 break-words font-medium">{alert.name}</span>
                    <Badge className="shrink-0" variant={alert.percent >= 100 ? "destructive" : "secondary"}>
                      {alert.percent.toFixed(0)}%
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {currencySymbol}{alert.spent.toFixed(0)} / {currencySymbol}{alert.budget.toFixed(0)}
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
            <p className="text-muted-foreground">{t("dashboard.noBudgetsSetYet")}</p>
          ) : (
            monthlyViewData.categoryProgress.slice(0, 12).map((cat) => (
              <div key={cat.id} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{cat.name}</span>
                  <span>{currencySymbol}{cat.spent.toFixed(0)} / {currencySymbol}{cat.budget.toFixed(0)}</span>
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

      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard.lastThreeMonthsInvestmentRates")}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {monthlyInvestmentRates.length === 0 ? (
            <p className="text-muted-foreground">{t("dashboard.noInvestmentDataYet")}</p>
          ) : (
            <table className="w-full min-w-[32rem] text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-2 pr-2 text-left font-medium">{t("investments.assets.title")}</th>
                  <th className="py-2 px-2 text-right font-medium">M-2</th>
                  <th className="py-2 px-2 text-right font-medium">M-1</th>
                  <th className="py-2 pl-2 text-right font-medium">M</th>
                </tr>
              </thead>
              <tbody>
                {monthlyInvestmentRates.map((row) => (
                  <tr key={row.id} className="border-b last:border-b-0">
                    <td className="py-2 pr-2">{row.name}</td>
                    {row.monthRates.map((rate, idx) => (
                      <td key={`${row.id}-${idx}`} className={`py-2 px-2 text-right ${rate >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                        {formatPercent(rate)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">{t("dashboard.monthlyNotes")}</CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            className="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[80px] resize-y focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder={t("dashboard.monthlyNotesPlaceholder")}
            value={commentDraft}
            onChange={(e) => onCommentChange(e.target.value)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
