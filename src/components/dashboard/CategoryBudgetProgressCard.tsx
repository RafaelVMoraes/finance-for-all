import { YearlyCategoryProgress } from "@/components/dashboard/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/i18n/I18nProvider";

interface CategoryBudgetProgressCardProps {
  rows: YearlyCategoryProgress[];
  currencySymbol: string;
  title: string;
}

export function CategoryBudgetProgressCard({ rows, currencySymbol, title }: CategoryBudgetProgressCardProps) {
  const { t } = useI18n();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-4 rounded-sm bg-black" /> {t("dashboard.spentLegend")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-2.5 w-4 rounded-sm border border-emerald-700"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(135deg, rgba(5, 150, 105, 0.4) 0 2px, rgba(5, 150, 105, 0.15) 2px 5px)",
              }}
            />
            {t("dashboard.underBudgetLegend")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-4 rounded-sm border border-black bg-red-800" />
            {t("dashboard.overBudgetLegend")}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("dashboard.noBudgetsSetYet")}</p>
        ) : (
          rows.slice(0, 15).map((cat) => {
            const allowedPct = cat.annualBudget > 0 ? Math.min((cat.allowedByNow / cat.annualBudget) * 100, 100) : 0;
            const spentPct = cat.annualBudget > 0 ? Math.min((cat.spent / cat.annualBudget) * 100, 100) : 0;
            const overspentPct = cat.annualBudget > 0 ? Math.min((Math.max(0, cat.spent - cat.allowedByNow) / cat.annualBudget) * 100, 100) : 0;

            return (
              <div key={cat.id} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate font-medium">{cat.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground sm:text-sm">
                    {currencySymbol}{cat.spent.toFixed(0)} / {currencySymbol}{cat.annualBudget.toFixed(0)}
                  </span>
                </div>
                <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
                  <div className="absolute left-0 top-0 h-full bg-black" style={{ width: `${spentPct}%` }} />
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
                  <span>{t("dashboard.consumed")}: {(cat.allowedByNow > 0 ? (cat.spent / cat.allowedByNow) * 100 : 0).toFixed(0)}%</span>
                  <span>{t("dashboard.expected")}: {currencySymbol}{cat.allowedByNow.toFixed(0)}</span>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
