import DashboardContent from "@/components/dashboard/DashboardContent";

export default function Dashboard() {
  const { t } = useI18n();

  return (
    <section className="space-y-4">
      <DashboardContent />
    </section>
  );
}
