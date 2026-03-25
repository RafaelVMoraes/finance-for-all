import { ArrowDownRight, ArrowUpRight, PiggyBank } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/i18n/I18nProvider";
import { MonthlyInvestmentEvolution, MonthlyViewData } from "@/components/dashboard/types";

interface MonthlySummaryCardsProps {
  monthlyViewData: MonthlyViewData;
  monthlyInvestmentEvolution: MonthlyInvestmentEvolution;
  currencySymbol: string;
  formatPercent: (value: number) => string;
  calculateRatio: (value: number, total: number) => number;
}

export function MonthlySummaryCards({
  monthlyViewData,
  monthlyInvestmentEvolution,
  currencySymbol,
  formatPercent,
  calculateRatio,
}: MonthlySummaryCardsProps) {
  const { t } = useI18n();

  return (
    <div data-tutorial="dashboard-key-metrics" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm text-muted-foreground">{t("dashboard.income")}</CardTitle>
          <ArrowUpRight className="h-4 w-4 text-emerald-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{currencySymbol}{monthlyViewData.actualIncome.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">
            {t("dashboard.expected")} {currencySymbol}
            {monthlyViewData.expectedIncome.toLocaleString()} · {formatPercent(calculateRatio(monthlyViewData.actualIncome, monthlyViewData.expectedIncome || 1))}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm text-muted-foreground">{t("dashboard.expenses")}</CardTitle>
          <ArrowDownRight className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{currencySymbol}{monthlyViewData.totalExpenses.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">
            {t("dashboard.expected")} {currencySymbol}
            {monthlyViewData.expectedExpenses.toFixed(0)} · {formatPercent(calculateRatio(monthlyViewData.totalExpenses, monthlyViewData.expectedExpenses || 1))}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm text-muted-foreground">{t("dashboard.savings")}</CardTitle>
          <PiggyBank className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${monthlyViewData.actualSavings >= 0 ? "text-emerald-600" : "text-destructive"}`}>
            {currencySymbol}{monthlyViewData.actualSavings.toFixed(0)}
          </div>
          <p className="text-xs text-muted-foreground">
            {t("dashboard.expected")} {currencySymbol}
            {monthlyViewData.expectedSavings.toFixed(0)} · {formatPercent(monthlyViewData.expectedSavings !== 0 ? (monthlyViewData.actualSavings / monthlyViewData.expectedSavings) * 100 : 0)}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">{t("dashboard.investmentsVsLastMonth")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${monthlyInvestmentEvolution.pctChange >= 0 ? "text-emerald-600" : "text-destructive"}`}>
            {formatPercent(monthlyInvestmentEvolution.pctChange)}
          </div>
          <p className="text-xs text-muted-foreground">
            {currencySymbol}{monthlyInvestmentEvolution.current.toFixed(0)} {t("dashboard.vs")} {currencySymbol}{monthlyInvestmentEvolution.lastMonth.toFixed(0)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
