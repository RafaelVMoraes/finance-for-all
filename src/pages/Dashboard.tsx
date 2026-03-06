import DashboardContent from "@/components/dashboard/DashboardContent";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/i18n/I18nProvider";

export default function Dashboard() {
  const { t } = useI18n();

  return (
    <section className="space-y-4">
      <Card className="border-dashed">
        <CardContent className="pt-6 text-sm text-muted-foreground">
          {t("dashboard.analyzeMonthlyPerformance")}
        </CardContent>
      </Card>

      <DashboardContent />
    </section>
  );
}
