-- Create table for storing scraped technical content
CREATE TABLE IF NOT EXISTS public.scraped_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  content_type TEXT NOT NULL,
  summary TEXT,
  key_concepts TEXT[],
  code_snippets JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS (public read for demo purposes)
ALTER TABLE public.scraped_content ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read scraped content
CREATE POLICY "Anyone can read scraped content"
  ON public.scraped_content
  FOR SELECT
  USING (true);

-- Allow anyone to insert scraped content (for demo)
CREATE POLICY "Anyone can insert scraped content"
  ON public.scraped_content
  FOR INSERT
  WITH CHECK (true);

-- Create index for search
CREATE INDEX idx_scraped_content_search ON public.scraped_content USING gin(to_tsvector('english', title || ' ' || content));
CREATE INDEX idx_scraped_content_url ON public.scraped_content(source_url);
CREATE INDEX idx_scraped_content_created ON public.scraped_content(created_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.scraped_content
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();