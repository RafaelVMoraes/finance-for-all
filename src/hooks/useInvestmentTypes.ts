import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';

export interface InvestmentType {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  created_at: string;
}

// Default types to seed for new users
const DEFAULT_TYPES = [
  { name: 'Investments', icon: 'TrendingUp', color: '#22c55e' },
  { name: 'Emergency savings', icon: 'PiggyBank', color: '#f59e0b' },
  { name: 'Current account', icon: 'Landmark', color: '#3b82f6' },
];

export function useInvestmentTypes() {
  const [types, setTypes] = useState<InvestmentType[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthContext();

  const fetchTypes = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('investment_types')
      .select('*')
      .eq('user_id', user.id)
      .order('name');

    if (error) {
      console.error('Error fetching investment types:', error);
    } else if (data && data.length === 0) {
      // Seed default types for new users
      await seedDefaultTypes();
    } else {
      setTypes((data || []) as unknown as InvestmentType[]);
    }
    setLoading(false);
  }, [user]);

  const seedDefaultTypes = useCallback(async () => {
    if (!user) return;
    
    const insertData = DEFAULT_TYPES.map(t => ({
      user_id: user.id,
      ...t
    }));
    
    const { data, error } = await supabase
      .from('investment_types')
      .insert(insertData)
      .select();

    if (!error && data) {
      setTypes(data as unknown as InvestmentType[]);
    }
  }, [user]);

  useEffect(() => {
    fetchTypes();
  }, [fetchTypes]);

  const createType = useCallback(async (
    name: string,
    icon: string = 'TrendingUp',
    color: string = '#22c55e'
  ) => {
    if (!user) return { error: 'Not authenticated' };

    const { data, error } = await supabase
      .from('investment_types')
      .insert({
        user_id: user.id,
        name,
        icon,
        color,
      })
      .select()
      .single();

    if (error) return { error: error.message };
    setTypes(prev => [...prev, data as unknown as InvestmentType]);
    return { data };
  }, [user]);

  const updateType = useCallback(async (
    id: string,
    updates: Partial<Pick<InvestmentType, 'name' | 'icon' | 'color'>>
  ) => {
    const { data, error } = await supabase
      .from('investment_types')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) return { error: error.message };
    setTypes(prev => prev.map(t => t.id === id ? data as unknown as InvestmentType : t));
    return { data };
  }, []);

  const deleteType = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('investment_types')
      .delete()
      .eq('id', id);

    if (error) return { error: error.message };
    setTypes(prev => prev.filter(t => t.id !== id));
    return {};
  }, []);

  return {
    types,
    loading,
    createType,
    updateType,
    deleteType,
    refetch: fetchTypes,
  };
}
