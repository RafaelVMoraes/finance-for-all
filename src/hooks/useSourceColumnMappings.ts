import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';
import { ColumnMapping } from '@/lib/columnDetection';

type SaveMappingResult = {
  success: boolean;
  error: string | null;
};

export function useSourceColumnMappings() {
  const { user } = useAuthContext();

  const getMapping = useCallback(async (sourceId: string): Promise<ColumnMapping | null> => {
    if (!user) return null;

    const { data, error } = await supabase
      .from('import_source_column_mappings')
      .select('date_column, label_column, value_column, category_column')
      .eq('source_id', sourceId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error || !data) return null;

    return {
      date: data.date_column,
      label: data.label_column,
      value: data.value_column,
      category: data.category_column || null,
    };
  }, [user]);

  const saveMapping = useCallback(async (sourceId: string, mapping: ColumnMapping): Promise<SaveMappingResult> => {
    if (!user || !mapping.date || !mapping.label || !mapping.value) {
      return { success: false, error: 'Missing required mapping fields or user session.' };
    }

    const { error } = await supabase
      .from('import_source_column_mappings')
      .upsert({
        source_id: sourceId,
        user_id: user.id,
        date_column: mapping.date,
        label_column: mapping.label,
        value_column: mapping.value,
        category_column: mapping.category || null,
      }, { onConflict: 'source_id' });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  }, [user]);

  return { getMapping, saveMapping };
}
