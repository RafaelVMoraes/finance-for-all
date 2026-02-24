-- Fix 1: Lock down aggregation tables - users should only read, trigger writes
DROP POLICY IF EXISTS "Users can manage own summaries" ON public.monthly_category_summary;
DROP POLICY IF EXISTS "Users can manage own totals" ON public.monthly_totals;

-- Fix 2: Add missing UPDATE policy on investment_snapshots (already exists per RLS dump, but ensure)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'investment_snapshots' 
    AND policyname = 'Users can update own investment snapshots'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Users can update own investment snapshots"
      ON public.investment_snapshots
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.investments
          WHERE investments.id = investment_snapshots.investment_id
          AND investments.user_id = auth.uid()
        )
      )
    $policy$;
  END IF;
END $$;