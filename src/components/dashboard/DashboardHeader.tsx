import { Calendar, Target } from "lucide-react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/i18n/I18nProvider";
import { DashboardView  from "@/hooks/useDashboardViewState";

interface DashboardHeaderProps {
  view: DashboardView;
  onViewChange: (view: DashboardView) => void;
}

export function DashboardHeader({ view, onViewChange }: DashboardHeaderProps) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
        {t("nav.dashboard")}
      </h1>
      <Tabs
        data-tutorial="dashboard-view-tabs"
        value={view}
        onValueChange={(v) => onViewChange(v as DashboardView)}
      >
        <TabsList>
          <TabsTrigger value="monthly" className="gap-2">
            <Calendar className="h-4 w-4" />
            {t("dashboard.monthly")}
          </TabsTrigger>
          <TabsTrigger value="yearly" className="gap-2">
            <Target className="h-4 w-4" />
            {t("dashboard.yearly")}
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
