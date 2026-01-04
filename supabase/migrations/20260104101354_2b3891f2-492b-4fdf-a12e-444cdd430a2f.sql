-- Add unique constraint for budgets upsert (user_id + category_id)
ALTER TABLE public.budgets 
ADD CONSTRAINT budgets_user_category_unique UNIQUE (user_id, category_id);

-- Add unique constraint for monthly_settings upsert (user_id + month)
ALTER TABLE public.monthly_settings 
ADD CONSTRAINT monthly_settings_user_month_unique UNIQUE (user_id, month);