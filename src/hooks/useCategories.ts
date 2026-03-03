import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';

export interface Category {
  id: string;
  user_id: string;
  name: string;
  type: 'fixed' | 'variable' | 'income';
  color: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

// Preset colors for categories (high contrast, accessible)
export const PRESET_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#84cc16', // lime
  '#22c55e', // green
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
  '#64748b', // slate
];

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthContext();

  const fetchCategories = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .order('name');

    if (error) {
      console.error('Error fetching categories:', error);
    } else {
      setCategories(data || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const createCategory = useCallback(async (
    name: string, 
    type: 'fixed' | 'variable' | 'income',
    color: string
  ) => {
    if (!user) return { error: 'Not authenticated' };

    const { data, error } = await supabase
      .from('categories')
      .insert({
        user_id: user.id,
        name,
        type,
        color,
      })
      .select()
      .single();

    if (error) {
      return { error: error.message };
    }

    setCategories(prev => [...prev, data]);
    return { data };
  }, [user]);

  const updateCategory = useCallback(async (
    id: string,
    updates: Partial<Pick<Category, 'name' | 'type' | 'color' | 'archived'>>
  ) => {
    const { data, error } = await supabase
      .from('categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return { error: error.message };
    }

    setCategories(prev => prev.map(c => c.id === id ? data : c));
    return { data };
  }, []);

  const deleteCategory = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) {
      return { error: error.message };
    }

    setCategories(prev => prev.filter(c => c.id !== id));
    return {};
  }, []);

  const activeCategories = categories.filter(c => !c.archived);
  const canAddMore = activeCategories.length < 15;

  return {
    categories,
    activeCategories,
    loading,
    canAddMore,
    createCategory,
    updateCategory,
    deleteCategory,
    refetch: fetchCategories,
  };
}
