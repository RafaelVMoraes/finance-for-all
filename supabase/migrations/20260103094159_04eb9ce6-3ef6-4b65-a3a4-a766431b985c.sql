-- Add missing DELETE policy for monthly_settings table
CREATE POLICY "Users can delete own monthly settings" 
ON public.monthly_settings
FOR DELETE 
USING (auth.uid() = user_id);