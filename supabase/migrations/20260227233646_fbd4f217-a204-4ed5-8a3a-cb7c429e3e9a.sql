-- Add monthly comment to monthly_settings
ALTER TABLE public.monthly_settings ADD COLUMN IF NOT EXISTS comment text DEFAULT '' NOT NULL;

-- Add ON DELETE CASCADE to transactions.import_batch_id foreign key
-- so deleting a batch cascades to its transactions
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_import_batch_id_fkey;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_import_batch_id_fkey 
  FOREIGN KEY (import_batch_id) REFERENCES public.import_batches(id) ON DELETE CASCADE;