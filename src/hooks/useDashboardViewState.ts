import { useCallback, useEffect, useMemo, useRef, useState } from "react";
export type DashboardView = "monthly" | "yearly";
export type YearAggregation = "month" | "quarter";

const YEAR_START_MONTH_KEY = "fintrack_year_start_month";
const SELECTED_YEAR_KEY = "fintrack_selected_year";
const CYCLE_START_DAY_KEY = "fintrack_cycle_start_day";

interface UseDashboardViewStateParams {
  today: Date;
  selectedMonth: string;
  monthlyComment?: string;
  onUpdateMonthlyComment: (comment: string) => void;
}

export function useDashboardViewState({
  today,
  selectedMonth,
  monthlyComment,
  onUpdateMonthlyComment,
}: UseDashboardViewStateParams) {
  const [view, setView] = useState<DashboardView>("monthly");
  const [selectedYear, setSelectedYear] = useState(() => {
    const saved = localStorage.getItem(SELECTED_YEAR_KEY);
    return saved !== null ? Number(saved) : today.getFullYear();
  });
  const [yearStartMonth, setYearStartMonth] = useState(() => {
    const saved = localStorage.getItem(YEAR_START_MONTH_KEY);
    return saved !== null ? Number(saved) : 0;
  });
  const [cycleStartDay, setCycleStartDay] = useState(() => {
    const saved = localStorage.getItem(CYCLE_START_DAY_KEY);
    const parsed = saved !== null ? Number(saved) : 1;
    return Math.min(28, Math.max(1, Number.isFinite(parsed) ? parsed : 1));
  });
  const [aggregation, setAggregation] = useState<YearAggregation>("month");
  const [commentDraft, setCommentDraft] = useState("");
  const commentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    localStorage.setItem(YEAR_START_MONTH_KEY, String(yearStartMonth));
  }, [yearStartMonth]);

  useEffect(() => {
    localStorage.setItem(SELECTED_YEAR_KEY, String(selectedYear));
  }, [selectedYear]);

  useEffect(() => {
    localStorage.setItem(CYCLE_START_DAY_KEY, String(cycleStartDay));
  }, [cycleStartDay]);

  useEffect(() => {
    setCommentDraft(monthlyComment || "");
  }, [monthlyComment, selectedMonth]);

  const yearlyStartMonth = useMemo(
    () => `${selectedYear}-${String(yearStartMonth + 1).padStart(2, "0")}`,
    [selectedYear, yearStartMonth],
  );

  const handleCommentChange = useCallback(
    (value: string) => {
      setCommentDraft(value);
      if (commentTimerRef.current) clearTimeout(commentTimerRef.current);
      commentTimerRef.current = setTimeout(() => {
        onUpdateMonthlyComment(value);
      }, 1000);
    },
    [onUpdateMonthlyComment],
  );

  return {
    view,
    setView,
    selectedYear,
    setSelectedYear,
    yearStartMonth,
    setYearStartMonth,
    cycleStartDay,
    setCycleStartDay,
    aggregation,
    setAggregation,
    commentDraft,
    yearlyStartMonth,
    handleCommentChange,
  };
}
