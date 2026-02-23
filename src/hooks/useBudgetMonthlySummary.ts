import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format, startOfMonth } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';

interface MonthlyCategorySummaryRow {
  category_id: string;
  total_amount: number;
}

interface MonthlyTotalsRow {
  total_income: number;
}

export function useBudgetMonthlySummary(month: Date) {
  const [categorySpent, setCategorySpent] = useState<Record<string, number>>({});
  const [actualIncome, setActualIncome] = useState(0);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthContext();
  const requestIdRef = useRef(0);

  const monthStr = useMemo(() => format(startOfMonth(month), 'yyyy-MM-dd'), [month]);

  const fetchSummary = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);

    const [{ data: categoryData, error: categoryError }, { data: totalsData, error: totalsError }] = await Promise.all([
      supabase
        .from('monthly_category_summary')
        .select('category_id, total_amount')
        .eq('user_id', user.id)
        .eq('month', monthStr),
      supabase
        .from('monthly_totals')
        .select('total_income')
        .eq('user_id', user.id)
        .eq('month', monthStr)
        .maybeSingle(),
    ]);

    if (requestId !== requestIdRef.current) {
      return;
    }

    if (categoryError) {
      console.error('Error fetching monthly category summary:', categoryError);
      setCategorySpent({});
    } else {
      const spentMap = (categoryData as MonthlyCategorySummaryRow[] | null)?.reduce<Record<string, number>>((acc, row) => {
        acc[row.category_id] = row.total_amount;
        return acc;
      }, {}) ?? {};
      setCategorySpent(spentMap);
    }

    if (totalsError) {
      console.error('Error fetching monthly totals:', totalsError);
      setActualIncome(0);
    } else {
      setActualIncome((totalsData as MonthlyTotalsRow | null)?.total_income ?? 0);
    }

    setLoading(false);
  }, [monthStr, user]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return {
    categorySpent,
    actualIncome,
    loading,
    refetch: fetchSummary,
  };
}
