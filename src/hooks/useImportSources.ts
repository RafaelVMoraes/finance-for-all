import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';

export interface ImportSource {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export function useImportSources() {
  const [sources, setSources] = useState<ImportSource[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthContext();

  const fetchSources = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('import_sources')
      .select('*')
      .eq('user_id', user.id)
      .order('name');
    
    if (error) {
      console.error('Error fetching import sources:', error);
    } else {
      setSources(data || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const createSource = useCallback(async (name: string) => {
    if (!user) return { error: 'Not authenticated' };
    
    const trimmedName = name.trim();
    if (!trimmedName) return { error: 'Source name is required' };
    
    // Check for existing source (case-insensitive)
    const existing = sources.find(s => s.name.toLowerCase() === trimmedName.toLowerCase());
    if (existing) {
      return { data: existing }; // Return existing source
    }
    
    const { data, error } = await supabase
      .from('import_sources')
      .insert({ user_id: user.id, name: trimmedName })
      .select()
      .single();
    
    if (error) {
      if (error.code === '23505') { // Unique violation
        // Fetch the existing source
        const { data: existingData } = await supabase
          .from('import_sources')
          .select('*')
          .eq('user_id', user.id)
          .ilike('name', trimmedName)
          .single();
        return { data: existingData };
      }
      return { error: error.message };
    }
    
    setSources(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    return { data };
  }, [user, sources]);

  const deleteSource = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('import_sources')
      .delete()
      .eq('id', id);
    
    if (error) {
      return { error: error.message };
    }
    
    setSources(prev => prev.filter(s => s.id !== id));
    return {};
  }, []);

  return {
    sources,
    loading,
    createSource,
    deleteSource,
    refetch: fetchSources,
  };
}
