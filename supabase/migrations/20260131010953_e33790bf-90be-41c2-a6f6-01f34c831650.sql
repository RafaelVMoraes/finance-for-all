-- Create import_sources table for user-managed sources
CREATE TABLE public.import_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.import_sources ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own sources" ON public.import_sources FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own sources" ON public.import_sources FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own sources" ON public.import_sources FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users can update own sources" ON public.import_sources FOR UPDATE USING (auth.uid() = user_id);

-- Add source_id, date_range to import_batches
ALTER TABLE public.import_batches
  ADD COLUMN source_id UUID REFERENCES public.import_sources(id) ON DELETE SET NULL,
  ADD COLUMN date_from DATE,
  ADD COLUMN date_to DATE;

-- Create unique index on import_sources (user_id, name) to prevent duplicate source names
CREATE UNIQUE INDEX idx_import_sources_user_name ON public.import_sources(user_id, LOWER(name));

-- Create index for faster lookups
CREATE INDEX idx_import_batches_source ON public.import_batches(source_id);