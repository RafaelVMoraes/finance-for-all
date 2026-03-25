import { useState, useEffect, useCallback, useRef } from 'react';
import { format, startOfWeek } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';
import {
  FinancialPeriod,
  getFinancialPeriod,
  getFinancialPeriodBounds,
  getFinancialPeriodsInYear,
  normalizeCycleStartDay,
  normalizeFiscalYearStartMonth,
} from '@/lib/financialPeriod';

export interface CategorySpending {
  id: string;
  name: string;
  color: string;
  type: 'fixed' | 'variable' | 'income';
  spent: number;
}

export interface WeeklySpending { week_start: string; spent: number; }
export interface MonthlySummary {
  total_income: number;
  total_expenses: number;
  transaction_count: number;
  incomplete_count: number;
  category_spending: CategorySpending[];
  weekly_spending: WeeklySpending[];
}

export interface MonthlyData { month_date: string; month_name: string; income: number; fixed_expenses: number; variable_expenses: number; savings: number; }
export interface CategoryMonthlySpending { id: string; name: string; color: string; type: string; month_date: string; month_name: string; spent: number; }
export interface YearlySummary { monthly_data: MonthlyData[]; category_monthly_spending: CategoryMonthlySpending[]; total_income: number; total_expenses: number; }

export interface InvestmentData { id: string; name: string; investment_type: string; currency: string; initial_amount: number; snapshots: { month: string; total_value: number }[]; }
export interface InvestmentSummary { investments: InvestmentData[]; total_value: number; }

interface TxRow {
  amount: number;
  payment_date: string;
  category_id: string | null;
  categories: { id: string; name: string; color: string; type: 'fixed' | 'variable' | 'income' } | null;
}

const normalizeTransactionAmount = (amount: number, categoryType?: 'fixed' | 'variable' | 'income') => {
  if (categoryType === 'income') return amount;
  return Math.abs(amount);
};

const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 60000;
const getCacheKey = (userId: string, type: string, params: string) => `${userId}:${type}:${params}`;
const getCachedData = <T,>(key: string): T | null => {
  const cached = cache.get(key);
  return cached && Date.now() - cached.timestamp < CACHE_TTL ? (cached.data as T) : null;
};
const setCachedData = <T,>(key: string, data: T): void => { cache.set(key, { data, timestamp: Date.now() }); };

const aggregateMonthlySummary = (transactions: TxRow[], periodStart: Date): MonthlySummary => {
  const byCategory = new Map<string, CategorySpending>();
  const byWeek = new Map<string, number>();
  let totalIncome = 0;
  let totalExpenses = 0;
  let incompleteCount = 0;

  transactions.forEach((tx) => {
    const categoryType = tx.categories?.type;
    const amount = normalizeTransactionAmount(Number(tx.amount || 0), categoryType);
    if (!categoryType || !tx.category_id || !tx.categories) {
      incompleteCount += 1;
      return;
    }

    if (categoryType === 'income') totalIncome += amount;
    else {
      totalExpenses += amount;
      const weekStart = format(startOfWeek(new Date(tx.payment_date), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      byWeek.set(weekStart, (byWeek.get(weekStart) || 0) + amount);
    }

    const existing = byCategory.get(tx.category_id) || {
      id: tx.category_id,
      name: tx.categories.name,
      color: tx.categories.color,
      type: categoryType,
      spent: 0,
    };
    existing.spent += amount;
    byCategory.set(tx.category_id, existing);
  });

  return {
    total_income: totalIncome,
    total_expenses: totalExpenses,
    transaction_count: transactions.length,
    incomplete_count: incompleteCount,
    category_spending: Array.from(byCategory.values()),
    weekly_spending: Array.from(byWeek.entries())
      .map(([week_start, spent]) => ({ week_start, spent }))
      .sort((a, b) => a.week_start.localeCompare(b.week_start)),
  };
};

export function useMonthlySummary(
  date: Date = new Date(),
  cycleStartDay = 1,
  fiscalYearStartMonth = 1,
) {
  const [data, setData] = useState<MonthlySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuthContext();
  const requestIdRef = useRef(0);

  const safeDay = normalizeCycleStartDay(cycleStartDay);
  const safeFiscal = normalizeFiscalYearStartMonth(fiscalYearStartMonth);
  const period = getFinancialPeriod(date, safeDay, safeFiscal);
  const { start, end } = getFinancialPeriodBounds(period.year, period.month, safeDay, safeFiscal);
  const startStr = format(start, 'yyyy-MM-dd');
  const endStr = format(end, 'yyyy-MM-dd');

  const fetchData = useCallback(async () => {
    if (!user) return;
    const requestId = ++requestIdRef.current;
    const cacheKey = getCacheKey(user.id, 'monthly', `${startStr}-${endStr}-${safeDay}-${safeFiscal}`);
    const cached = getCachedData<MonthlySummary>(cacheKey);
    if (cached) { setData(cached); setLoading(false); return; }

    setLoading(true);
    setError(null);
    try {
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('amount,payment_date,category_id,categories(id,name,color,type)')
        .eq('user_id', user.id)
        .gte('payment_date', startStr)
        .lte('payment_date', endStr);
      if (txError) throw txError;

      const summary = aggregateMonthlySummary((txData || []) as TxRow[], start);
      if (requestId !== requestIdRef.current) return;
      setCachedData(cacheKey, summary);
      setData(summary);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      if (err instanceof Error) setError(err.message);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [user, startStr, endStr, safeDay, safeFiscal]);

  useEffect(() => { fetchData(); }, [fetchData]);
  return { data, loading, error, refetch: fetchData };
}

export function useYearlySummary(
  year: number,
  cycleStartDay = 1,
  fiscalYearStartMonth = 1,
) {
  const [data, setData] = useState<YearlySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuthContext();
  const requestIdRef = useRef(0);

  const safeDay = normalizeCycleStartDay(cycleStartDay);
  const safeFiscal = normalizeFiscalYearStartMonth(fiscalYearStartMonth);
  const periods = getFinancialPeriodsInYear(year, safeDay, safeFiscal);
  const yearStartStr = format(periods[0].start, 'yyyy-MM-dd');
  const yearEndStr = format(periods[periods.length - 1].end, 'yyyy-MM-dd');

  const fetchData = useCallback(async () => {
    if (!user) return;
    const requestId = ++requestIdRef.current;
    const cacheKey = getCacheKey(user.id, 'yearly', `${year}-${safeDay}-${safeFiscal}`);
    const cached = getCachedData<YearlySummary>(cacheKey);
    if (cached) { setData(cached); setLoading(false); return; }

    setLoading(true);
    setError(null);
    try {
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('amount,payment_date,category_id,categories(id,name,color,type)')
        .eq('user_id', user.id)
        .gte('payment_date', yearStartStr)
        .lte('payment_date', yearEndStr);
      if (txError) throw txError;

      const periodIndex = new Map<string, number>();
      const monthlyData = periods.map((p, idx) => {
        const key = `${p.year}-${String(p.month).padStart(2, '0')}`;
        periodIndex.set(key, idx);
        const monthName = new Intl.DateTimeFormat('en', { month: 'short' }).format(new Date(p.end));
        return { month_date: format(p.start, 'yyyy-MM-dd'), month_name: monthName, income: 0, fixed_expenses: 0, variable_expenses: 0, savings: 0 };
      });

      const categoryMonthlySpending: CategoryMonthlySpending[] = [];
      const categoryMap = new Map<string, CategoryMonthlySpending>();

      ((txData || []) as TxRow[]).forEach((tx) => {
        if (!tx.categories || !tx.category_id) return;
        const period = getFinancialPeriod(new Date(tx.payment_date), safeDay, safeFiscal);
        if (period.year !== year) return;
        const key = `${period.year}-${String(period.month).padStart(2, '0')}`;
        const idx = periodIndex.get(key);
        if (idx === undefined) return;
        const amount = normalizeTransactionAmount(Number(tx.amount || 0), tx.categories.type);
        if (tx.categories.type === 'income') monthlyData[idx].income += amount;
        else if (tx.categories.type === 'fixed') monthlyData[idx].fixed_expenses += amount;
        else monthlyData[idx].variable_expenses += amount;

        const catKey = `${tx.category_id}:${idx}`;
        const existing = categoryMap.get(catKey) || {
          id: tx.category_id,
          name: tx.categories.name,
          color: tx.categories.color,
          type: tx.categories.type,
          month_date: monthlyData[idx].month_date,
          month_name: monthlyData[idx].month_name,
          spent: 0,
        };
        existing.spent += amount;
        categoryMap.set(catKey, existing);
      });

      monthlyData.forEach((m) => {
        m.savings = m.income - m.fixed_expenses - m.variable_expenses;
      });
      categoryMonthlySpending.push(...Array.from(categoryMap.values()));
      const totalIncome = monthlyData.reduce((sum, m) => sum + m.income, 0);
      const totalExpenses = monthlyData.reduce((sum, m) => sum + m.fixed_expenses + m.variable_expenses, 0);

      const summary: YearlySummary = { monthly_data: monthlyData, category_monthly_spending: categoryMonthlySpending, total_income: totalIncome, total_expenses: totalExpenses };
      if (requestId !== requestIdRef.current) return;
      setCachedData(cacheKey, summary);
      setData(summary);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      if (err instanceof Error) setError(err.message);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [user, year, safeDay, safeFiscal, yearStartStr, yearEndStr, periods]);

  useEffect(() => { fetchData(); }, [fetchData]);
  return { data, loading, error, refetch: fetchData };
}

export function useInvestmentSummary() {
  const [data, setData] = useState<InvestmentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuthContext();
  const requestIdRef = useRef(0);

  const fetchData = useCallback(async () => {
    if (!user) return;
    const requestId = ++requestIdRef.current;
    const cacheKey = getCacheKey(user.id, 'investments', 'all');
    const cached = getCachedData<InvestmentSummary>(cacheKey);
    if (cached) { setData(cached); setLoading(false); return; }

    setLoading(true);
    setError(null);
    try {
      const { data: result, error: rpcError } = await supabase.rpc('get_investment_summary');
      if (rpcError) throw rpcError;
      const summary = result as unknown as InvestmentSummary;
      if (requestId !== requestIdRef.current) return;
      setCachedData(cacheKey, summary);
      setData(summary);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      if (err instanceof Error) setError(err.message);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);
  const invalidateCache = useCallback(() => { if (user) cache.delete(getCacheKey(user.id, 'investments', 'all')); }, [user]);
  return { data, loading, error, refetch: fetchData, invalidateCache };
}

export function clearDashboardCache() { cache.clear(); }
