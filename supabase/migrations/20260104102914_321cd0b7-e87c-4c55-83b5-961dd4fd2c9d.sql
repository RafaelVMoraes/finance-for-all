-- Add unique constraint for investment_snapshots upsert
ALTER TABLE public.investment_snapshots 
ADD CONSTRAINT investment_snapshots_investment_month_unique 
UNIQUE (investment_id, month);

-- Add UPDATE policy for investment_snapshots (needed for upsert)
CREATE POLICY "Users can update own investment snapshots" 
ON public.investment_snapshots 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM investments 
  WHERE investments.id = investment_snapshots.investment_id 
  AND investments.user_id = auth.uid()
));