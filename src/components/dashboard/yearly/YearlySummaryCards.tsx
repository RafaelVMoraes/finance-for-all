import { YearlyViewData } from "@/components/dashboard/types";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useI18n } from "@/i18n/I18nProvider";

interface DriverItem {
  key: string;
  value: number;
}

interface YearlySummaryCardsProps {
  yearlyViewData: YearlyViewData;
  currencySymbol: string;
  netWorth: number;
  yearlyInvestmentGain: number;
}

const clampScore = (value: number) => Math.max(0, Math.min(100, value));

export function YearlySummaryCards({ yearlyViewData, currencySymbol, netWorth, yearlyInvestmentGain }: YearlySummaryCardsProps) {
  const { t } = useI18n();

  const savingsRate = yearlyViewData.totalIncome > 0 ? (yearlyViewData.totalSavings / yearlyViewData.totalIncome) * 100 : 0;
  const savingsRateScore = clampScore(savingsRate);

  const expenseRatios = yearlyViewData.monthlyStats
    .filter((month) => month.income > 0)
    .map((month) => month.expenses / month.income);
  const expenseAverage = expenseRatios.length ? expenseRatios.reduce((sum, value) => sum + value, 0) / expenseRatios.length : 0;
  const expenseVolatility = expenseRatios.length
    ? Math.sqrt(expenseRatios.reduce((sum, value) => sum + (value - expenseAverage) ** 2, 0) / expenseRatios.length)
    : 0;
  const expenseVolatilityScore = clampScore(100 - expenseVolatility * 200);

  const budgetRows = yearlyViewData.budgetVsReality;
  const budgetAccuracy = budgetRows.length
    ? clampScore(
        100 -
          budgetRows.reduce((sum, row) => {
            const incomeDelta = Math.abs(row.incomePct - 100);
            const expensesDelta = Math.abs(row.expensesPct - 100);
            return sum + (incomeDelta + expensesDelta) / 2;
          }, 0) /
            budgetRows.length,
      )
    : 0;

  const monthlyIncomes = yearlyViewData.monthlyStats.map((month) => month.income).filter((income) => income > 0);
  const incomeAvg = monthlyIncomes.length ? monthlyIncomes.reduce((sum, value) => sum + value, 0) / monthlyIncomes.length : 0;
  const incomeVolatility = monthlyIncomes.length
    ? Math.sqrt(monthlyIncomes.reduce((sum, value) => sum + (value - incomeAvg) ** 2, 0) / monthlyIncomes.length)
    : 0;
  const incomeStability = incomeAvg > 0 ? clampScore(100 - (incomeVolatility / incomeAvg) * 100) : 0;

  const netWorthGrowth = netWorth > 0 ? clampScore((yearlyInvestmentGain / netWorth) * 100) : 0;

  const financialScore = clampScore(
    0.3 * savingsRateScore +
      0.2 * budgetAccuracy +
      0.2 * expenseVolatilityScore +
      0.15 * netWorthGrowth +
      0.15 * incomeStability,
  );

  const scoreLabel = financialScore >= 80 ? t("dashboard.healthExcellent") : financialScore >= 60 ? t("dashboard.healthGood") : t("dashboard.healthNeedsAttention");

  const drivers: DriverItem[] = [
    { key: t("dashboard.savingsRate"), value: savingsRateScore },
    { key: t("dashboard.budgetAdherence"), value: budgetAccuracy },
    { key: t("dashboard.expenseStability"), value: expenseVolatilityScore },
    { key: t("dashboard.netWorthGrowth"), value: netWorthGrowth },
    { key: t("dashboard.incomeStability"), value: incomeStability },
  ].sort((a, b) => a.value - b.value);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>{t("dashboard.financialHealthScore")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-3xl font-bold">{Math.round(financialScore)}/100</p>
              <p className="text-sm text-muted-foreground">{scoreLabel}</p>
            </div>
            <div className="w-full max-w-sm">
              <Progress value={financialScore} />
            </div>
          </div>
          <div className="mt-3 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
            {drivers.map((driver) => (
              <p key={driver.key}>{driver.key}: {Math.round(driver.value)}</p>
            ))}
          </div>
        </CardContent>
      </Card>

      <Accordion type="multiple" defaultValue={["investment", "budget", "expenses"]} className="space-y-3">
        <AccordionItem value="investment" className="rounded-lg border px-4">
          <AccordionTrigger>{t("dashboard.investmentSection")}</AccordionTrigger>
          <AccordionContent>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">{t("dashboard.netWorth")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{currencySymbol}{Math.round(netWorth).toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">{t("dashboard.thisYear")} {currencySymbol}{Math.round(yearlyInvestmentGain).toLocaleString()}</p>
                </CardContent>
              </Card>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="budget" className="rounded-lg border px-4">
          <AccordionTrigger>{t("dashboard.budgetSection")}</AccordionTrigger>
          <AccordionContent>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">{t("dashboard.avgIncome")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{currencySymbol}{Math.round(yearlyViewData.totalIncome / yearlyViewData.monthsWithData).toLocaleString()}</div>
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
                </CardContent>
              </Card>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="expenses" className="rounded-lg border px-4">
          <AccordionTrigger>{t("dashboard.expenseSection")}</AccordionTrigger>
          <AccordionContent>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">{t("dashboard.avgExpenses")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{currencySymbol}{Math.round(yearlyViewData.totalExpenses / yearlyViewData.monthsWithData).toLocaleString()}</div>
              </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
