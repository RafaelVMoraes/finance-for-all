import { useCallback, useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';
import { logClientError } from '@/lib/logger';
import { getFinancialPeriod, getFinancialPeriodBounds, normalizeCycleStartDay, normalizeFiscalYearStartMonth } from '@/lib/financialPeriod';

interface TxRow {
  amount: number;
  category_id: string | null;
  categories: { type: 'fixed' | 'variable' | 'income' } | null;
}

const normalizeTransactionAmount = (
  amount: number,
  categoryType?: 'fixed' | 'variable' | 'income',
) => (categoryType === 'income' ? amount : Math.abs(amount));

export function useBudgetMonthlySummary(month: Date, cycleStartDay = 1, fiscalYearStartMonth = 1) {
  const [categorySpent, setCategorySpent] = useState<Record<string, number>>({});
  const [actualIncome, setActualIncome] = useState(0);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthContext();
  const requestIdRef = useRef(0);

  const safeDay = normalizeCycleStartDay(cycleStartDay);
  const safeFiscal = normalizeFiscalYearStartMonth(fiscalYearStartMonth);
  const period = getFinancialPeriod(month, safeDay, safeFiscal);
  const { start, end } = getFinancialPeriodBounds(period.year, period.month, safeDay, safeFiscal);
  const periodStart = format(start, 'yyyy-MM-dd');
  const periodEnd = format(end, 'yyyy-MM-dd');

  const fetchSummary = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);

    const { data, error } = await supabase
      .from('transactions')
      .select('amount,category_id,categories(type)')
      .eq('user_id', user.id)
      .gte('payment_date', periodStart)
      .lte('payment_date', periodEnd);

    if (requestId !== requestIdRef.current) return;

    if (error) {
      logClientError('[BUDGET_MONTH_SUMMARY_TX_ERR]', error);
      setCategorySpent({});
      setActualIncome(0);
      setLoading(false);
      return;
    }

    const spentMap: Record<string, number> = {};
    let income = 0;
    ((data || []) as TxRow[]).forEach((row) => {
      const amount = normalizeTransactionAmount(Number(row.amount || 0), row.categories?.type);
      if (row.categories?.type === 'income') {
        income += amount;
        return;
      }
      if (row.category_id) spentMap[row.category_id] = (spentMap[row.category_id] || 0) + amount;
    });

    setCategorySpent(spentMap);
    setActualIncome(income);
    setLoading(false);
  }, [periodEnd, periodStart, user]);

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
