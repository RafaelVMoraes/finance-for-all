-- Create import_rules table for storing user-defined categorization rules
CREATE TABLE public.import_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  
  -- Rule conditions (stored as JSONB for flexibility)
  -- Format: [{"type": "label_contains", "value": "vir"}, {"type": "value_min", "value": 100}]
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Rule actions
  -- Format: {"category_id": "uuid", "duplicate_action": "accept"|"reject"|null}
  actions JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Stats for suggestions
  times_applied INTEGER NOT NULL DEFAULT 0,
  last_applied_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.import_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own rules" 
  ON public.import_rules 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own rules" 
  ON public.import_rules 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rules" 
  ON public.import_rules 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own rules" 
  ON public.import_rules 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Index for efficient rule lookup during import
CREATE INDEX idx_import_rules_user_priority 
  ON public.import_rules (user_id, priority DESC, created_at ASC)
  WHERE enabled = true;

-- Index for user_id (RLS performance)
CREATE INDEX idx_import_rules_user_id ON public.import_rules (user_id);

-- Trigger for updated_at
CREATE TRIGGER update_import_rules_updated_at
  BEFORE UPDATE ON public.import_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create table for tracking rule application history (for suggestions)
CREATE TABLE public.import_rule_matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  label_normalized TEXT NOT NULL,
  value_range TEXT, -- 'income', 'expense', 'low', 'medium', 'high'
  category_id UUID,
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.import_rule_matches ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own matches" 
  ON public.import_rule_matches 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own matches" 
  ON public.import_rule_matches 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own matches" 
  ON public.import_rule_matches 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own matches" 
  ON public.import_rule_matches 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Index for suggestion queries
CREATE INDEX idx_rule_matches_user_label 
  ON public.import_rule_matches (user_id, label_normalized);

CREATE INDEX idx_rule_matches_user_count 
  ON public.import_rule_matches (user_id, occurrence_count DESC);

-- Unique constraint for upsert
CREATE UNIQUE INDEX idx_rule_matches_unique 
  ON public.import_rule_matches (user_id, label_normalized, COALESCE(value_range, ''));