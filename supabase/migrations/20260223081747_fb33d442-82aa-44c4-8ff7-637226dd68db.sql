
-- Fix: Add missing UPDATE policy on import_batches
CREATE POLICY "Users can update own import batches"
ON public.import_batches
FOR UPDATE
USING (auth.uid() = user_id);
