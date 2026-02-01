-- User settings for main currency
CREATE TABLE public.user_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  main_currency TEXT NOT NULL DEFAULT 'EUR' CHECK (main_currency IN ('EUR', 'USD', 'BRL')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own settings" ON public.user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own settings" ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON public.user_settings FOR UPDATE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Monthly exchange rates (user-defined)
CREATE TABLE public.exchange_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  month DATE NOT NULL,
  from_currency TEXT NOT NULL CHECK (from_currency IN ('EUR', 'USD', 'BRL')),
  to_currency TEXT NOT NULL CHECK (to_currency IN ('EUR', 'USD', 'BRL')),
  rate NUMERIC NOT NULL CHECK (rate > 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, month, from_currency, to_currency)
);

-- Enable RLS
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own exchange rates" ON public.exchange_rates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own exchange rates" ON public.exchange_rates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own exchange rates" ON public.exchange_rates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own exchange rates" ON public.exchange_rates FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_exchange_rates_updated_at
  BEFORE UPDATE ON public.exchange_rates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- User-managed investment types
CREATE TABLE public.investment_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'TrendingUp',
  color TEXT NOT NULL DEFAULT '#22c55e',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

-- Enable RLS
ALTER TABLE public.investment_types ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own investment types" ON public.investment_types FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own investment types" ON public.investment_types FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own investment types" ON public.investment_types FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own investment types" ON public.investment_types FOR DELETE USING (auth.uid() = user_id);

-- Add budget distribution preset to budgets table
ALTER TABLE public.budgets 
ADD COLUMN distribution TEXT NOT NULL DEFAULT 'even' CHECK (distribution IN ('even', 'front', 'back', 'custom'));

-- Add start_month to investments to track when asset was added
ALTER TABLE public.investments 
ADD COLUMN start_month DATE;

-- Update existing investments to use their created_at month
UPDATE public.investments 
SET start_month = date_trunc('month', created_at)::date 
WHERE start_month IS NULL;

-- Add confirmed flag to investment_snapshots
ALTER TABLE public.investment_snapshots 
ADD COLUMN confirmed BOOLEAN NOT NULL DEFAULT false;

-- Create indexes for performance
CREATE INDEX idx_exchange_rates_user_month ON public.exchange_rates(user_id, month DESC);
CREATE INDEX idx_investment_types_user ON public.investment_types(user_id);
CREATE INDEX idx_user_settings_user ON public.user_settings(user_id);