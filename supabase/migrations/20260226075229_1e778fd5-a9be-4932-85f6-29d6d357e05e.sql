
CREATE TABLE public.import_source_column_mappings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id uuid NOT NULL REFERENCES public.import_sources(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  date_column text NOT NULL,
  label_column text NOT NULL,
  value_column text NOT NULL,
  category_column text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(source_id)
);

ALTER TABLE public.import_source_column_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own mappings" ON public.import_source_column_mappings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own mappings" ON public.import_source_column_mappings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own mappings" ON public.import_source_column_mappings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own mappings" ON public.import_source_column_mappings FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_import_source_column_mappings_updated_at
  BEFORE UPDATE ON public.import_source_column_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
