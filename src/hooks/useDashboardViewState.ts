import { useEffect, useMemo, useState } from "react";

export type DashboardView = "monthly" | "yearly";
export type YearAggregation = "month" | "quarter";

const YEAR_START_MONTH_KEY = "fintrack_year_start_month";
const SELECTED_YEAR_KEY = "fintrack_selected_year";

interface UseDashboardViewStateParams {
  today: Date;
}

export function useDashboardViewState({ today }: UseDashboardViewStateParams) {
  const [view, setView] = useState<DashboardView>("monthly");
  const [selectedYear, setSelectedYear] = useState(() => {
    const saved = localStorage.getItem(SELECTED_YEAR_KEY);
    return saved !== null ? Number(saved) : today.getFullYear();
  });
  const [yearStartMonth, setYearStartMonth] = useState(() => {
    const saved = localStorage.getItem(YEAR_START_MONTH_KEY);
    return saved !== null ? Number(saved) : 0;
  });
  const [aggregation, setAggregation] = useState<YearAggregation>("month");

  useEffect(() => {
    localStorage.setItem(YEAR_START_MONTH_KEY, String(yearStartMonth));
  }, [yearStartMonth]);

  useEffect(() => {
    localStorage.setItem(SELECTED_YEAR_KEY, String(selectedYear));
  }, [selectedYear]);

  useEffect(() => {
    const syncFromStorage = () => {
      const monthRaw = Number(localStorage.getItem(YEAR_START_MONTH_KEY) ?? 0);
      setYearStartMonth(Number.isFinite(monthRaw) ? monthRaw : 0);
    };

    window.addEventListener("fintrack-settings-changed", syncFromStorage);
    window.addEventListener("storage", syncFromStorage);
    return () => {
      window.removeEventListener("fintrack-settings-changed", syncFromStorage);
      window.removeEventListener("storage", syncFromStorage);
    };
  }, []);
  const yearlyStartMonth = useMemo(
    () => `${selectedYear}-${String(yearStartMonth + 1).padStart(2, "0")}`,
    [selectedYear, yearStartMonth],
  );

  return {
    view,
    setView,
    selectedYear,
    setSelectedYear,
    yearStartMonth,
    setYearStartMonth,
    aggregation,
    setAggregation,
    yearlyStartMonth,
  };
}
