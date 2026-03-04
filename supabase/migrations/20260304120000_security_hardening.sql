-- Security hardening: strict RLS checks, ownership binding, account deletion RPC, and storage policies

-- 1) Harden UPDATE policies with explicit ownership WITH CHECK
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own categories" ON public.categories;
CREATE POLICY "Users can update own categories"
  ON public.categories
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own import batches" ON public.import_batches;
CREATE POLICY "Users can update own import batches"
  ON public.import_batches
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (
      source_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.import_sources s
        WHERE s.id = source_id
          AND s.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can update own transactions" ON public.transactions;
CREATE POLICY "Users can update own transactions"
  ON public.transactions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (
      category_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.categories c
        WHERE c.id = category_id
          AND c.user_id = auth.uid()
      )
    )
    AND (
      import_batch_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.import_batches b
        WHERE b.id = import_batch_id
          AND b.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can update own budgets" ON public.budgets;
CREATE POLICY "Users can update own budgets"
  ON public.budgets
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.categories c
      WHERE c.id = category_id
        AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own monthly settings" ON public.monthly_settings;
CREATE POLICY "Users can update own monthly settings"
  ON public.monthly_settings
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own investments" ON public.investments;
CREATE POLICY "Users can update own investments"
  ON public.investments
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (
      investment_type_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.investment_types t
        WHERE t.id = investment_type_id
          AND t.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can update own rules" ON public.import_rules;
CREATE POLICY "Users can update own rules"
  ON public.import_rules
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own matches" ON public.import_rule_matches;
CREATE POLICY "Users can update own matches"
  ON public.import_rule_matches
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own mappings" ON public.import_source_column_mappings;
CREATE POLICY "Users can update own mappings"
  ON public.import_source_column_mappings
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.import_sources s
      WHERE s.id = source_id
        AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
CREATE POLICY "Users can update own settings"
  ON public.user_settings
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own exchange rates" ON public.exchange_rates;
CREATE POLICY "Users can update own exchange rates"
  ON public.exchange_rates
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own investment types" ON public.investment_types;
CREATE POLICY "Users can update own investment types"
  ON public.investment_types
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own investment snapshots" ON public.investment_snapshots;
CREATE POLICY "Users can update own investment snapshots"
  ON public.investment_snapshots
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.investments i
      WHERE i.id = investment_snapshots.investment_id
        AND i.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.investments i
      WHERE i.id = investment_snapshots.investment_id
        AND i.user_id = auth.uid()
    )
  );

-- 2) Harden INSERT policies with ownership linkage across foreign keys
DROP POLICY IF EXISTS "Users can create own mappings" ON public.import_source_column_mappings;
CREATE POLICY "Users can create own mappings"
  ON public.import_source_column_mappings
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.import_sources s
      WHERE s.id = source_id
        AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create own import batches" ON public.import_batches;
CREATE POLICY "Users can create own import batches"
  ON public.import_batches
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      source_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.import_sources s
        WHERE s.id = source_id
          AND s.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can create own transactions" ON public.transactions;
CREATE POLICY "Users can create own transactions"
  ON public.transactions
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      category_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.categories c
        WHERE c.id = category_id
          AND c.user_id = auth.uid()
      )
    )
    AND (
      import_batch_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.import_batches b
        WHERE b.id = import_batch_id
          AND b.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can create own budgets" ON public.budgets;
CREATE POLICY "Users can create own budgets"
  ON public.budgets
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.categories c
      WHERE c.id = category_id
        AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create own investments" ON public.investments;
CREATE POLICY "Users can create own investments"
  ON public.investments
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      investment_type_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.investment_types t
        WHERE t.id = investment_type_id
          AND t.user_id = auth.uid()
      )
    )
  );

-- 3) GDPR-grade deletion RPC (application data wipe in one transaction)
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM public.investment_snapshots
  WHERE investment_id IN (SELECT id FROM public.investments WHERE user_id = v_uid);

  DELETE FROM public.investments WHERE user_id = v_uid;
  DELETE FROM public.investment_types WHERE user_id = v_uid;
  DELETE FROM public.transactions WHERE user_id = v_uid;
  DELETE FROM public.import_rule_matches WHERE user_id = v_uid;
  DELETE FROM public.import_rules WHERE user_id = v_uid;
  DELETE FROM public.import_source_column_mappings WHERE user_id = v_uid;
  DELETE FROM public.import_batches WHERE user_id = v_uid;
  DELETE FROM public.import_sources WHERE user_id = v_uid;
  DELETE FROM public.budgets WHERE user_id = v_uid;
  DELETE FROM public.monthly_settings WHERE user_id = v_uid;
  DELETE FROM public.exchange_rates WHERE user_id = v_uid;
  DELETE FROM public.categories WHERE user_id = v_uid;
  DELETE FROM public.user_settings WHERE user_id = v_uid;
  DELETE FROM public.profiles WHERE id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;

-- 4) Storage bucket and policies (private-by-default for statements)
INSERT INTO storage.buckets (id, name, public)
VALUES ('statements', 'statements', false)
ON CONFLICT (id)
DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "Users can read own statement objects" ON storage.objects;
CREATE POLICY "Users can read own statement objects"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'statements'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can upload own statement objects" ON storage.objects;
CREATE POLICY "Users can upload own statement objects"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'statements'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can update own statement objects" ON storage.objects;
CREATE POLICY "Users can update own statement objects"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'statements'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'statements'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can delete own statement objects" ON storage.objects;
CREATE POLICY "Users can delete own statement objects"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'statements'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
