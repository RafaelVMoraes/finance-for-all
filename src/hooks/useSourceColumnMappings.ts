import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';
import { ColumnMapping } from '@/lib/columnDetection';

export function useSourceColumnMappings() {
  const { user } = useAuthContext();

  const getMapping = useCallback(async (sourceId: string): Promise<ColumnMapping | null> => {
    if (!user) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
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

  const saveMapping = useCallback(async (sourceId: string, mapping: ColumnMapping) => {
    if (!user || !mapping.date || !mapping.label || !mapping.value) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('import_source_column_mappings')
      .upsert({
        source_id: sourceId,
        user_id: user.id,
        date_column: mapping.date,
        label_column: mapping.label,
        value_column: mapping.value,
        category_column: mapping.category || null,
      }, { onConflict: 'source_id' });
  }, [user]);

  return { getMapping, saveMapping };
}
