import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';
import { startOfMonth, format } from 'date-fns';

export interface Budget {
  id: string;
  user_id: string;
  category_id: string;
  expected_amount: number;
  created_at: string;
  updated_at: string;
  categories?: {
    id: string;
    name: string;
    color: string;
    type: 'fixed' | 'variable' | 'income';
  } | null;
}

export interface MonthlySettings {
  id: string;
  user_id: string;
  month: string;
  expected_income: number;
  created_at: string;
  updated_at: string;
}

export function useBudgets() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [monthlySettings, setMonthlySettings] = useState<MonthlySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthContext();
  
  const currentMonth = format(startOfMonth(new Date()), 'yyyy-MM-dd');

  const fetchBudgets = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    
    // Fetch budgets with category info
    const { data: budgetsData, error: budgetsError } = await supabase
      .from('budgets')
      .select(`
        *,
        categories (
          id,
          name,
          color,
          type
        )
      `)
      .eq('user_id', user.id);

    if (budgetsError) {
      console.error('Error fetching budgets:', budgetsError);
    } else {
      setBudgets(budgetsData || []);
    }

    // Fetch monthly settings
    const { data: settingsData } = await supabase
      .from('monthly_settings')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .maybeSingle();

    setMonthlySettings(settingsData);
    setLoading(false);
  }, [user, currentMonth]);

  useEffect(() => {
    fetchBudgets();
  }, [fetchBudgets]);

  const upsertBudget = useCallback(async (categoryId: string, expectedAmount: number) => {
    if (!user) return { error: 'Not authenticated' };

    const { data, error } = await supabase
      .from('budgets')
      .upsert({
        user_id: user.id,
        category_id: categoryId,
        expected_amount: expectedAmount
      }, {
        onConflict: 'user_id,category_id'
      })
      .select(`
        *,
        categories (
          id,
          name,
          color,
          type
        )
      `)
      .single();

    if (error) {
      return { error: error.message };
    }

    setBudgets(prev => {
      const existing = prev.findIndex(b => b.category_id === categoryId);
      if (existing >= 0) {
        return prev.map((b, i) => i === existing ? data : b);
      }
      return [...prev, data];
    });
    return { data };
  }, [user]);

  const updateExpectedIncome = useCallback(async (amount: number) => {
    if (!user) return { error: 'Not authenticated' };

    const { data, error } = await supabase
      .from('monthly_settings')
      .upsert({
        user_id: user.id,
        month: currentMonth,
        expected_income: amount
      }, {
        onConflict: 'user_id,month'
      })
      .select()
      .single();

    if (error) {
      return { error: error.message };
    }

    setMonthlySettings(data);
    return { data };
  }, [user, currentMonth]);

  return {
    budgets,
    monthlySettings,
    loading,
    upsertBudget,
    updateExpectedIncome,
    refetch: fetchBudgets,
  };
}
