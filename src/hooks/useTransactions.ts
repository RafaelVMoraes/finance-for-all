import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';
import { startOfMonth, endOfMonth, format, isBefore } from 'date-fns';
import { APP_START_DATE } from '@/constants/app';

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

export interface NewTransaction {
  payment_date: string;
  label: string;
  amount: number;
  category_id?: string | null;
}

// Keyset pagination cursor
export interface TransactionCursor {
  payment_date: string;
  id: string;
}

const PAGE_SIZE = 50;

// Explicit columns to select (avoids SELECT *)
const TRANSACTION_COLUMNS = `
  id,
  user_id,
  import_batch_id,
  payment_date,
  original_label,
  edited_label,
  amount,
  original_category,
  category_id,
  created_at,
  updated_at,
  categories (
    id,
    name,
    color,
    type
  )
`;

export function useTransactions(filters?: TransactionFilters) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const { user } = useAuthContext();
  
  // Use ref to track cursor for keyset pagination
  const cursorRef = useRef<TransactionCursor | null>(null);
  const isLoadingMoreRef = useRef(false);

  // Reset pagination when filters change
  const resetPagination = useCallback(() => {
    cursorRef.current = null;
    setHasMore(true);
    setTransactions([]);
  }, []);

  const fetchTransactions = useCallback(async (loadMore = false) => {
    if (!user) return;
    
    // Prevent concurrent requests
    if (loadMore && isLoadingMoreRef.current) return;
    
    if (!loadMore) {
      resetPagination();
      setLoading(true);
    } else {
      isLoadingMoreRef.current = true;
    }
    
    // Default to current month if no date filter, but ensure it's not before APP_START_DATE
    let dateFrom = filters?.dateFrom || startOfMonth(new Date());
    const dateTo = filters?.dateTo || endOfMonth(new Date());
    
    // Enforce minimum date
    if (isBefore(dateFrom, APP_START_DATE)) {
      dateFrom = APP_START_DATE;
    }
    
    // Build optimized query with keyset pagination
    // Uses composite index: (user_id, payment_date DESC, id DESC)
    let query = supabase
      .from('transactions')
      .select(TRANSACTION_COLUMNS)
      .eq('user_id', user.id)
      .gte('payment_date', format(dateFrom, 'yyyy-MM-dd'))
      .lte('payment_date', format(dateTo, 'yyyy-MM-dd'))
      .order('payment_date', { ascending: false })
      .order('id', { ascending: false })
      .limit(PAGE_SIZE);

    // Apply keyset pagination cursor (replaces OFFSET)
    if (loadMore && cursorRef.current) {
      // Keyset pagination: get records after the cursor
      // This is much faster than OFFSET as it uses index directly
      query = query.or(
        `payment_date.lt.${cursorRef.current.payment_date},` +
        `and(payment_date.eq.${cursorRef.current.payment_date},id.lt.${cursorRef.current.id})`
      );
    }

    // Apply category filter (uses idx_transactions_user_category)
    if (filters?.categoryId) {
      query = query.eq('category_id', filters.categoryId);
    }

    // Apply amount filters
    if (filters?.minAmount !== undefined) {
      query = query.gte('amount', filters.minAmount);
    }

    if (filters?.maxAmount !== undefined) {
      query = query.lte('amount', filters.maxAmount);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching transactions:', error);
      setLoading(false);
      isLoadingMoreRef.current = false;
      return;
    }

    let filtered = data || [];
    
    // Filter by completion status (client-side for flexibility)
    if (filters?.completionStatus === 'complete') {
      filtered = filtered.filter(t => t.category_id !== null);
    } else if (filters?.completionStatus === 'incomplete') {
      filtered = filtered.filter(t => t.category_id === null);
    }
    
    // Update cursor for next page
    if (filtered.length > 0) {
      const lastItem = filtered[filtered.length - 1];
      cursorRef.current = {
        payment_date: lastItem.payment_date,
        id: lastItem.id,
      };
    }
    
    // Check if there are more records
    setHasMore(filtered.length === PAGE_SIZE);
    
    // Append or replace transactions
    if (loadMore) {
      setTransactions(prev => [...prev, ...filtered]);
    } else {
      setTransactions(filtered);
    }
    
    setLoading(false);
    isLoadingMoreRef.current = false;
  }, [user, filters, resetPagination]);

  // Load more function for infinite scroll
  const loadMore = useCallback(() => {
    if (hasMore && !loading) {
      fetchTransactions(true);
    }
  }, [hasMore, loading, fetchTransactions]);

  useEffect(() => {
    fetchTransactions(false);
  }, [fetchTransactions]);

  const createTransaction = useCallback(async (newTx: NewTransaction) => {
    if (!user) return { error: 'Not authenticated' };
    
    // Validate date
    const txDate = new Date(newTx.payment_date);
    if (isBefore(txDate, APP_START_DATE)) {
      return { error: 'Date cannot be before September 2025' };
    }
    
    const { data, error } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        payment_date: newTx.payment_date,
        original_label: newTx.label,
        amount: newTx.amount,
        category_id: newTx.category_id || null,
      })
      .select(TRANSACTION_COLUMNS)
      .single();

    if (error) {
      return { error: error.message };
    }

    // Insert at correct position maintaining sort order
    setTransactions(prev => {
      const newList = [data, ...prev];
      return newList.sort((a, b) => {
        const dateCompare = new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime();
        if (dateCompare !== 0) return dateCompare;
        return b.id.localeCompare(a.id);
      });
    });
    return { data };
  }, [user]);

  const updateTransaction = useCallback(async (
    id: string,
    updates: { edited_label?: string | null; category_id?: string | null }
  ) => {
    const { data, error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', id)
      .select(TRANSACTION_COLUMNS)
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
    hasMore,
    completeCount,
    incompleteCount,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    refetch: () => fetchTransactions(false),
    loadMore,
  };
}
