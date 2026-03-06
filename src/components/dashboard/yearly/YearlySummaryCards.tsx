import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/i18n/I18nProvider";
import { YearlyViewData } from "@/components/dashboard/types";

interface YearlySummaryCardsProps {
  yearlyViewData: YearlyViewData;
  currencySymbol: string;
  netWorth: number;
}

export function YearlySummaryCards({ yearlyViewData, currencySymbol, netWorth }: YearlySummaryCardsProps) {
  const { t } = useI18n();

  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">{t("dashboard.avgIncome")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{currencySymbol}{Math.round(yearlyViewData.totalIncome / yearlyViewData.monthsWithData).toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">
            {t("dashboard.total")} {currencySymbol}{Math.round(yearlyViewData.totalIncome).toLocaleString()} · {yearlyViewData.monthsWithData}{t("dashboard.monthAbbrev")}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">{t("dashboard.avgExpenses")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{currencySymbol}{Math.round(yearlyViewData.totalExpenses / yearlyViewData.monthsWithData).toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">
            {t("dashboard.total")} {currencySymbol}{Math.round(yearlyViewData.totalExpenses).toLocaleString()} · {yearlyViewData.monthsWithData}{t("dashboard.monthAbbrev")}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">{t("dashboard.avgSavings")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${yearlyViewData.totalSavings >= 0 ? "text-emerald-600" : "text-destructive"}`}>
            {currencySymbol}{Math.round(yearlyViewData.totalSavings / yearlyViewData.monthsWithData).toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">
            {t("dashboard.total")} {currencySymbol}{Math.round(yearlyViewData.totalSavings).toLocaleString()} · {yearlyViewData.monthsWithData}{t("dashboard.monthAbbrev")}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">{t("dashboard.netWorth")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{currencySymbol}{Math.round(netWorth).toLocaleString()}</div>
        </CardContent>
      </Card>
    </div>
  );
}
