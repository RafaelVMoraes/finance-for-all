import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';
import { startOfMonth, endOfMonth, format } from 'date-fns';

export interface Transaction {
  id: string;
  user_id: string;
  import_batch_id: string | null;
  payment_date: string;
  original_label: string;
  edited_label: string | null;
  amount: number;
  original_category: string | null;
  category_id: string | null;
  created_at: string;
  updated_at: string;
  categories?: {
    id: string;
    name: string;
    color: string;
    type: 'fixed' | 'variable' | 'income';
  } | null;
}

export interface TransactionFilters {
  categoryId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  completionStatus?: 'all' | 'complete' | 'incomplete';
  minAmount?: number;
  maxAmount?: number;
}

export function useTransactions(filters?: TransactionFilters) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthContext();

  const fetchTransactions = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    
    // Default to current month if no date filter
    const dateFrom = filters?.dateFrom || startOfMonth(new Date());
    const dateTo = filters?.dateTo || endOfMonth(new Date());
    
    let query = supabase
      .from('transactions')
      .select(`
        *,
        categories (
          id,
          name,
          color,
          type
        )
      `)
      .eq('user_id', user.id)
      .gte('payment_date', format(dateFrom, 'yyyy-MM-dd'))
      .lte('payment_date', format(dateTo, 'yyyy-MM-dd'))
      .order('payment_date', { ascending: false });

    if (filters?.categoryId) {
      query = query.eq('category_id', filters.categoryId);
    }

    if (filters?.minAmount !== undefined) {
      query = query.gte('amount', filters.minAmount);
    }

    if (filters?.maxAmount !== undefined) {
      query = query.lte('amount', filters.maxAmount);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching transactions:', error);
    } else {
      let filtered = data || [];
      
      // Filter by completion status
      if (filters?.completionStatus === 'complete') {
        filtered = filtered.filter(t => t.category_id !== null);
      } else if (filters?.completionStatus === 'incomplete') {
        filtered = filtered.filter(t => t.category_id === null);
      }
      
      setTransactions(filtered);
    }
    setLoading(false);
  }, [user, filters]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const updateTransaction = useCallback(async (
    id: string,
    updates: { edited_label?: string; category_id?: string | null }
  ) => {
    const { data, error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', id)
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

    setTransactions(prev => prev.map(t => t.id === id ? data : t));
    return { data };
  }, []);

  const deleteTransaction = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id);

    if (error) {
      return { error: error.message };
    }

    setTransactions(prev => prev.filter(t => t.id !== id));
    return {};
  }, []);

  const completeCount = transactions.filter(t => t.category_id !== null).length;
  const incompleteCount = transactions.filter(t => t.category_id === null).length;

  return {
    transactions,
    loading,
    completeCount,
    incompleteCount,
    updateTransaction,
    deleteTransaction,
    refetch: fetchTransactions,
  };
}
