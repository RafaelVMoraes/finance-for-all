import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';

export function useInputPageStats() {
  const { user } = useAuthContext();
  const [lastImportDate, setLastImportDate] = useState<string | null>(null);
  const [pendingAssets, setPendingAssets] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;

    // Fetch most recent import date
    supabase
      .from('import_batches')
      .select('imported_at')
      .eq('user_id', user.id)
      .order('imported_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const d = new Date(data[0].imported_at);
          setLastImportDate(format(d, 'dd/MM'));
        }
      });

    // Count investments missing a confirmed snapshot for the current month
    const currentMonth = format(new Date(), 'yyyy-MM-01');

    supabase
      .from('investments')
      .select('id')
      .eq('user_id', user.id)
      .then(({ data: investments }) => {
        if (!investments || investments.length === 0) {
          setPendingAssets(0);
          return;
        }

        const ids = investments.map((i) => i.id);

        supabase
          .from('investment_snapshots')
          .select('investment_id')
          .in('investment_id', ids)
          .eq('month', currentMonth)
          .eq('confirmed', true)
          .then(({ data: confirmed }) => {
            const confirmedIds = new Set((confirmed || []).map((s) => s.investment_id));
            setPendingAssets(ids.filter((id) => !confirmedIds.has(id)).length);
          });
      });
  }, [user]);

  return { lastImportDate, pendingAssets };
}
