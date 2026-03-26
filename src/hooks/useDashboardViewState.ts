import { useEffect, useMemo, useState } from "react";

export type DashboardView = "monthly" | "yearly";
export type YearAggregation = "month" | "quarter";

const YEAR_START_MONTH_KEY = "fintrack_year_start_month";
const SELECTED_YEAR_KEY = "fintrack_selected_year";

interface UseDashboardViewStateParams {
  today: Date;
}

export function useDashboardViewState({ today }: UseDashboardViewStateParams) {
  const currentYear = today.getFullYear();
  const [view, setView] = useState<DashboardView>("monthly");
  const [selectedYear, setSelectedYear] = useState(() => {
    const saved = localStorage.getItem(SELECTED_YEAR_KEY);
    const parsed = saved !== null ? Number(saved) : NaN;
    return Number.isFinite(parsed) ? parsed : currentYear;
  });
  const [yearStartMonth, setYearStartMonth] = useState(() => {
    const saved = localStorage.getItem(YEAR_START_MONTH_KEY);
    const parsed = saved !== null ? Number(saved) : NaN;
    if (!Number.isFinite(parsed)) return 0;
    return Math.min(11, Math.max(0, Math.trunc(parsed)));
  });
  const [aggregation, setAggregation] = useState<YearAggregation>("month");

  useEffect(() => {
    // Keep dashboard year aligned with real current year when a new year starts,
    // while still allowing manual navigation afterwards.
    setSelectedYear((savedYear) => (savedYear < currentYear ? currentYear : savedYear));
  }, [currentYear]);

  useEffect(() => {
    localStorage.setItem(YEAR_START_MONTH_KEY, String(yearStartMonth));
  }, [yearStartMonth]);

  useEffect(() => {
    localStorage.setItem(SELECTED_YEAR_KEY, String(selectedYear));
  }, [selectedYear]);

  useEffect(() => {
    const syncFromStorage = () => {
      const monthRaw = Number(localStorage.getItem(YEAR_START_MONTH_KEY) ?? 0);
      if (!Number.isFinite(monthRaw)) {
        setYearStartMonth(0);
        return;
      }
      setYearStartMonth(Math.min(11, Math.max(0, Math.trunc(monthRaw))));
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
