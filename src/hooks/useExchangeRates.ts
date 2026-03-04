import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';
import { format, startOfMonth } from 'date-fns';
import { logClientError } from '@/lib/logger';

export type Currency = 'EUR' | 'USD' | 'BRL';

export interface ExchangeRate {
  id: string;
  user_id: string;
  month: string;
  from_currency: Currency;
  to_currency: Currency;
  rate: number;
  created_at: string;
  updated_at: string;
}

export function useExchangeRates() {
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthContext();

  const fetchRates = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('exchange_rates')
      .select('*')
      .eq('user_id', user.id)
      .order('month', { ascending: false });

    if (error) {
      logClientError('[EXCHANGE_RATES_FETCH_ERR]', error);
    } else {
      setRates((data || []) as unknown as ExchangeRate[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  // Get rate for a specific month (or fallback to latest)
  const getRate = useCallback((
    fromCurrency: Currency,
    toCurrency: Currency,
    month: Date
  ): { rate: number; isFallback: boolean } => {
    if (fromCurrency === toCurrency) return { rate: 1, isFallback: false };
    
    const monthStr = format(startOfMonth(month), 'yyyy-MM-dd');
    
    // Try exact month
    const exactRate = rates.find(
      r => r.month === monthStr && 
           r.from_currency === fromCurrency && 
           r.to_currency === toCurrency
    );
    if (exactRate) return { rate: exactRate.rate, isFallback: false };
    
    // Try inverse rate
    const inverseRate = rates.find(
      r => r.month === monthStr && 
           r.from_currency === toCurrency && 
           r.to_currency === fromCurrency
    );
    if (inverseRate) return { rate: 1 / inverseRate.rate, isFallback: false };
    
    // Fallback to latest rate
    const fallbackRate = rates.find(
      r => r.from_currency === fromCurrency && r.to_currency === toCurrency
    );
    if (fallbackRate) return { rate: fallbackRate.rate, isFallback: true };
    
    // Try inverse fallback
    const inverseFallback = rates.find(
      r => r.from_currency === toCurrency && r.to_currency === fromCurrency
    );
    if (inverseFallback) return { rate: 1 / inverseFallback.rate, isFallback: true };
    
    return { rate: 1, isFallback: true };
  }, [rates]);

  // Get current month rates
  const getCurrentMonthRates = useCallback((month: Date) => {
    const monthStr = format(startOfMonth(month), 'yyyy-MM-dd');
    return rates.filter(r => r.month === monthStr);
  }, [rates]);

  // Check if current month has rates defined
  const hasRatesForMonth = useCallback((month: Date): boolean => {
    const monthStr = format(startOfMonth(month), 'yyyy-MM-dd');
    return rates.some(r => r.month === monthStr);
  }, [rates]);

  const upsertRate = useCallback(async (
    fromCurrency: Currency,
    toCurrency: Currency,
    rate: number,
    month: Date
  ) => {
    if (!user) return { error: 'Not authenticated' };
    
    const monthStr = format(startOfMonth(month), 'yyyy-MM-dd');
    
    const { data, error } = await supabase
      .from('exchange_rates')
      .upsert({
        user_id: user.id,
        month: monthStr,
        from_currency: fromCurrency,
        to_currency: toCurrency,
        rate,
      }, {
        onConflict: 'user_id,month,from_currency,to_currency'
      })
      .select()
      .single();

    if (error) return { error: error.message };
    
    setRates(prev => {
      const filtered = prev.filter(
        r => !(r.month === monthStr && 
               r.from_currency === fromCurrency && 
               r.to_currency === toCurrency)
      );
      return [...filtered, data as unknown as ExchangeRate];
    });
    
    return { data };
  }, [user]);

  return {
    rates,
    loading,
    getRate,
    getCurrentMonthRates,
    hasRatesForMonth,
    upsertRate,
    refetch: fetchRates,
  };
}
