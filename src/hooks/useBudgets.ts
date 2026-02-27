import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';
import { startOfMonth, format } from 'date-fns';

export interface Budget {
  id: string;
  user_id: string;
  category_id: string;
  expected_amount: number;
  distribution: 'even' | 'front' | 'back' | 'custom';
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
  comment: string;
  created_at: string;
  updated_at: string;
}

interface UseBudgetsOptions {
  month?: Date;
}

const BUDGET_COLUMNS = `
  id,
  user_id,
  category_id,
  expected_amount,
  distribution,
  created_at,
  updated_at,
  categories (
    id,
    name,
    color,
    type
  )
`;

const MONTHLY_SETTINGS_COLUMNS = `
  id,
  user_id,
  month,
  expected_income,
  comment,
  created_at,
  updated_at
`;

export function useBudgets(options?: UseBudgetsOptions) {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [monthlySettings, setMonthlySettings] = useState<MonthlySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthContext();
  
  const targetMonth = options?.month ?? new Date();
  const monthStr = format(startOfMonth(targetMonth), 'yyyy-MM-dd');

  const fetchBudgets = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    
    // Fetch budgets with category info
    const { data: budgetsData, error: budgetsError } = await supabase
      .from('budgets')
      .select(BUDGET_COLUMNS)
      .eq('user_id', user.id);

    if (budgetsError) {
      console.error('Error fetching budgets:', budgetsError);
    } else {
      setBudgets((budgetsData || []) as Budget[]);
    }

    // Fetch monthly settings for the target month, fall back to most recent
    let { data: settingsData } = await supabase
      .from('monthly_settings')
      .select(MONTHLY_SETTINGS_COLUMNS)
      .eq('user_id', user.id)
      .eq('month', monthStr)
      .maybeSingle();

    // If no settings for this specific month, use the most recent one
    if (!settingsData) {
      const { data: fallbackData } = await supabase
        .from('monthly_settings')
        .select(MONTHLY_SETTINGS_COLUMNS)
        .eq('user_id', user.id)
        .lte('month', monthStr)
        .order('month', { ascending: false })
        .limit(1)
        .maybeSingle();
      settingsData = fallbackData;
    }

    setMonthlySettings(settingsData);
    setLoading(false);
  }, [user, monthStr]);

  useEffect(() => {
    fetchBudgets();
  }, [fetchBudgets]);

  const upsertBudget = useCallback(async (
    categoryId: string,
    expectedAmount: number,
    distribution: Budget['distribution'] = 'even'
  ) => {
    if (!user) return { error: 'Not authenticated' };

    // Check if budget exists for this category
    const existingBudget = budgets.find(b => b.category_id === categoryId);
    
    let result;
    if (existingBudget) {
      // Update existing budget
      result = await supabase
        .from('budgets')
        .update({ expected_amount: expectedAmount, distribution })
        .eq('id', existingBudget.id)
        .select(BUDGET_COLUMNS)
        .single();
    } else {
      // Insert new budget
      result = await supabase
        .from('budgets')
        .insert({
          user_id: user.id,
          category_id: categoryId,
          expected_amount: expectedAmount,
          distribution,
        })
        .select(BUDGET_COLUMNS)
        .single();
    }

    if (result.error) {
      return { error: result.error.message };
    }

    setBudgets(prev => {
      const existing = prev.findIndex(b => b.category_id === categoryId);
      if (existing >= 0) {
        return prev.map((b, i) => i === existing ? result.data : b);
      }
      return [...prev, result.data];
    });
    return { data: result.data };
  }, [user, budgets]);

  const updateExpectedIncome = useCallback(async (amount: number) => {
    if (!user) return { error: 'Not authenticated' };

    if (monthlySettings) {
      const { data, error } = await supabase
        .from('monthly_settings')
        .update({ expected_income: amount })
        .eq('id', monthlySettings.id)
        .select(MONTHLY_SETTINGS_COLUMNS)
        .single();

      if (error) return { error: error.message };
      setMonthlySettings(data);
      return { data };
    } else {
      const { data, error } = await supabase
        .from('monthly_settings')
        .insert({ user_id: user.id, month: monthStr, expected_income: amount })
        .select(MONTHLY_SETTINGS_COLUMNS)
        .single();

      if (error) return { error: error.message };
      setMonthlySettings(data);
      return { data };
    }
  }, [user, monthStr, monthlySettings]);

  const updateMonthlyComment = useCallback(async (comment: string) => {
    if (!user) return { error: 'Not authenticated' };

    if (monthlySettings) {
      const { data, error } = await supabase
        .from('monthly_settings')
        .update({ comment })
        .eq('id', monthlySettings.id)
        .select(MONTHLY_SETTINGS_COLUMNS)
        .single();

      if (error) return { error: error.message };
      setMonthlySettings(data);
      return { data };
    } else {
      const { data, error } = await supabase
        .from('monthly_settings')
        .insert({ user_id: user.id, month: monthStr, comment })
        .select(MONTHLY_SETTINGS_COLUMNS)
        .single();

      if (error) return { error: error.message };
      setMonthlySettings(data);
      return { data };
    }
  }, [user, monthStr, monthlySettings]);

  return {
    budgets,
    monthlySettings,
    loading,
    upsertBudget,
    updateExpectedIncome,
    updateMonthlyComment,
    refetch: fetchBudgets,
  };
}
