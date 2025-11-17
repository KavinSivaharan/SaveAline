-- Create scrape_jobs table to track background scraping
CREATE TABLE IF NOT EXISTS public.scrape_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  progress INTEGER DEFAULT 0,
  total INTEGER DEFAULT 0,
  result JSONB,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scrape_jobs ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read and create jobs (public scraper)
CREATE POLICY "Anyone can view scrape jobs" ON public.scrape_jobs FOR SELECT USING (true);
CREATE POLICY "Anyone can create scrape jobs" ON public.scrape_jobs FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update scrape jobs" ON public.scrape_jobs FOR UPDATE USING (true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_scrape_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_scrape_jobs_updated_at
  BEFORE UPDATE ON public.scrape_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_scrape_jobs_updated_at();