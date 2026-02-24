import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';
import { startOfMonth, endOfMonth, format } from 'date-fns';

export interface CategorySpending {
  id: string;
  name: string;
  color: string;
  type: 'fixed' | 'variable' | 'income';
  spent: number;
}

export interface WeeklySpending {
  week_start: string;
  spent: number;
}

export interface MonthlySummary {
  total_income: number;
  total_expenses: number;
  transaction_count: number;
  incomplete_count: number;
  category_spending: CategorySpending[];
  weekly_spending: WeeklySpending[];
}

export interface MonthlyData {
  month_date: string;
  month_name: string;
  income: number;
  fixed_expenses: number;
  variable_expenses: number;
  savings: number;
}

export interface CategoryMonthlySpending {
  id: string;
  name: string;
  color: string;
  type: string;
  month_date: string;
  month_name: string;
  spent: number;
}

export interface YearlySummary {
  monthly_data: MonthlyData[];
  category_monthly_spending: CategoryMonthlySpending[];
  total_income: number;
  total_expenses: number;
}

export interface InvestmentData {
  id: string;
  name: string;
  investment_type: string;
  currency: string;
  initial_amount: number;
  snapshots: { month: string; total_value: number }[];
}

export interface InvestmentSummary {
  investments: InvestmentData[];
  total_value: number;
}

// Cache for memoization
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute cache

function getCacheKey(userId: string, type: string, params: string): string {
  return `${userId}:${type}:${params}`;
}

function getCachedData<T>(key: string): T | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as T;
  }
  return null;
}

function setCachedData<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

export function useMonthlySummary(date: Date = new Date()) {
  const [data, setData] = useState<MonthlySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuthContext();
  const requestIdRef = useRef(0);

  const monthStart = format(startOfMonth(date), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(date), 'yyyy-MM-dd');

  const fetchData = useCallback(async () => {
    if (!user) return;

    const requestId = ++requestIdRef.current;

    const cacheKey = getCacheKey(user.id, 'monthly', `${monthStart}-${monthEnd}`);
    const cached = getCachedData<MonthlySummary>(cacheKey);
    
    if (cached) {
      setData(cached);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: result, error: rpcError } = await supabase.rpc('get_monthly_summary', {
        p_month_start: monthStart,
        p_month_end: monthEnd,
      });

      if (rpcError) throw rpcError;
      
      const summary = result as unknown as MonthlySummary;
      if (requestId !== requestIdRef.current) return;
      setCachedData(cacheKey, summary);
      setData(summary);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      if (err instanceof Error) {
        setError(err.message);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [user, monthStart, monthEnd]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

export function useYearlySummary(year: number = new Date().getFullYear()) {
  const [data, setData] = useState<YearlySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuthContext();
  const requestIdRef = useRef(0);

  const fetchData = useCallback(async () => {
    if (!user) return;

    const requestId = ++requestIdRef.current;

    const cacheKey = getCacheKey(user.id, 'yearly', String(year));
    const cached = getCachedData<YearlySummary>(cacheKey);
    
    if (cached) {
      setData(cached);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: result, error: rpcError } = await supabase.rpc('get_yearly_summary', {
        p_year: year,
      });

      if (rpcError) throw rpcError;
      
      const summary = result as unknown as YearlySummary;
      if (requestId !== requestIdRef.current) return;
      setCachedData(cacheKey, summary);
      setData(summary);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      if (err instanceof Error) {
        setError(err.message);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [user, year]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
    
    if (cached) {
      setData(cached);
      setLoading(false);
      return;
    }

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
      if (err instanceof Error) {
        setError(err.message);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Invalidate cache when needed
  const invalidateCache = useCallback(() => {
    if (user) {
      cache.delete(getCacheKey(user.id, 'investments', 'all'));
    }
  }, [user]);

  return { data, loading, error, refetch: fetchData, invalidateCache };
}

// Utility to clear all caches (useful after mutations)
export function clearDashboardCache() {
  cache.clear();
}
