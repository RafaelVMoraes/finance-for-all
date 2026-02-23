import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';

export interface Investment {
  id: string;
  user_id: string;
  name: string;
  investment_type: string;
  currency: 'EUR' | 'USD' | 'BRL';
  initial_amount: number;
  monthly_contribution: number;
  created_at: string;
  updated_at: string;
}

export interface InvestmentSnapshot {
  id: string;
  investment_id: string;
  month: string;
  total_value: number;
  created_at: string;
}

const INVESTMENT_COLUMNS = `
  id,
  user_id,
  name,
  investment_type,
  currency,
  initial_amount,
  monthly_contribution,
  created_at,
  updated_at
`;

const SNAPSHOT_COLUMNS = `
  id,
  investment_id,
  month,
  total_value,
  created_at
`;

export function useInvestments() {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [snapshots, setSnapshots] = useState<InvestmentSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthContext();

  const fetchInvestments = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    
    const { data, error } = await supabase
      .from('investments')
      .select(INVESTMENT_COLUMNS)
      .eq('user_id', user.id)
      .order('name');

    if (error) {
      console.error('Error fetching investments:', error);
    } else {
      setInvestments(data || []);
      
      // Fetch snapshots for all investments
      if (data && data.length > 0) {
        const { data: snapshotsData } = await supabase
          .from('investment_snapshots')
          .select(SNAPSHOT_COLUMNS)
          .in('investment_id', data.map(i => i.id))
          .order('month', { ascending: false });
        
        setSnapshots(snapshotsData || []);
      }
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchInvestments();
  }, [fetchInvestments]);

  const createInvestment = useCallback(async (
    name: string,
    investmentType: string,
    currency: 'EUR' | 'USD' | 'BRL',
    initialAmount: number,
    monthlyContribution: number
  ) => {
    if (!user) return { error: 'Not authenticated' };

    const { data, error } = await supabase
      .from('investments')
      .insert({
        user_id: user.id,
        name,
        investment_type: investmentType,
        currency,
        initial_amount: initialAmount,
        monthly_contribution: monthlyContribution
      })
      .select(INVESTMENT_COLUMNS)
      .single();

    if (error) {
      return { error: error.message };
    }

    setInvestments(prev => [...prev, data]);
    return { data };
  }, [user]);

  const updateInvestment = useCallback(async (
    id: string,
    updates: Partial<Pick<Investment, 'name' | 'investment_type' | 'currency' | 'initial_amount' | 'monthly_contribution'>>
  ) => {
    const { data, error } = await supabase
      .from('investments')
      .update(updates)
      .eq('id', id)
      .select(INVESTMENT_COLUMNS)
      .single();

    if (error) {
      return { error: error.message };
    }

    setInvestments(prev => prev.map(i => i.id === id ? data : i));
    return { data };
  }, []);

  const deleteInvestment = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('investments')
      .delete()
      .eq('id', id);

    if (error) {
      return { error: error.message };
    }

    setInvestments(prev => prev.filter(i => i.id !== id));
    setSnapshots(prev => prev.filter(s => s.investment_id !== id));
    return {};
  }, []);

  const addSnapshot = useCallback(async (investmentId: string, month: string, totalValue: number) => {
    const { data, error } = await supabase
      .from('investment_snapshots')
      .upsert({
        investment_id: investmentId,
        month,
        total_value: totalValue
      }, {
        onConflict: 'investment_id,month'
      })
      .select(SNAPSHOT_COLUMNS)
      .single();

    if (error) {
      return { error: error.message };
    }

    setSnapshots(prev => {
      const existing = prev.findIndex(s => s.investment_id === investmentId && s.month === month);
      if (existing >= 0) {
        return prev.map((s, i) => i === existing ? data : s);
      }
      return [...prev, data];
    });
    return { data };
  }, []);

  // Calculate total portfolio value
  const totalValue = investments.reduce((sum, inv) => {
    const latestSnapshot = snapshots
      .filter(s => s.investment_id === inv.id)
      .sort((a, b) => b.month.localeCompare(a.month))[0];
    return sum + (latestSnapshot?.total_value || inv.initial_amount);
  }, 0);

  return {
    investments,
    snapshots,
    loading,
    totalValue,
    createInvestment,
    updateInvestment,
    deleteInvestment,
    addSnapshot,
    refetch: fetchInvestments,
  };
}
