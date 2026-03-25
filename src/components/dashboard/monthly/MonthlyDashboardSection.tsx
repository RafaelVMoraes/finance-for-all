import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Bar, CartesianGrid, ComposedChart, LabelList, Legend, Line, XAxis, YAxis } from "recharts";

import { MonthlySummaryCards } from "@/components/dashboard/monthly/MonthlySummaryCards";
import { MonthlyInvestmentEvolution, MonthlyViewData } from "@/components/dashboard/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { useI18n } from "@/i18n/I18nProvider";

interface MonthlyDashboardSectionProps {
  periodLabel: string;
  onPreviousPeriod: () => void;
  onNextPeriod: () => void;
  monthlyViewData: MonthlyViewData;
  monthlyInvestmentEvolution: MonthlyInvestmentEvolution;
  currencySymbol: string;
  commentDraft: string;
  onCommentChange: (value: string) => void;
  chartConfig: Record<string, { label: string; color: string }>;
  formatPercent: (value: number) => string;
  calculateRatio: (value: number, total: number) => number;
}

export function MonthlyDashboardSection({
  periodLabel,
  onPreviousPeriod,
  onNextPeriod,
  monthlyViewData,
  monthlyInvestmentEvolution,
  currencySymbol,
  commentDraft,
  onCommentChange,
  chartConfig,
  formatPercent,
  calculateRatio,
}: MonthlyDashboardSectionProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={onPreviousPeriod}><ChevronLeft className="h-4 w-4" /></Button>
        <Badge variant="secondary">{periodLabel}</Badge>
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

      <Card><CardHeader><CardTitle>{t("dashboard.categoryBudgetProgress")}</CardTitle></CardHeader><CardContent className="space-y-3">{monthlyViewData.categoryProgress.length === 0 ? <p className="text-muted-foreground">{t("dashboard.noBudgetsSetYet")}</p> : monthlyViewData.categoryProgress.slice(0, 12).map((cat) => (<div key={cat.id} className="space-y-1"><div className="flex justify-between text-sm"><span>{cat.name}</span><span>{currencySymbol}{cat.spent.toFixed(0)} / {currencySymbol}{cat.budget.toFixed(0)}</span></div><Progress value={Math.min(cat.percent, 100)} /></div>))}<div className="pt-2"><Button asChild variant="outline"><Link to="/input/budget">{t("dashboard.adjustBudget")}</Link></Button></div></CardContent></Card>

      <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t("dashboard.monthlyNotes")}</CardTitle></CardHeader><CardContent><textarea className="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[80px] resize-y focus:outline-none focus:ring-2 focus:ring-ring" placeholder={t("dashboard.monthlyNotesPlaceholder")} value={commentDraft} onChange={(e) => onCommentChange(e.target.value)} /></CardContent></Card>
    </div>
  );
}
