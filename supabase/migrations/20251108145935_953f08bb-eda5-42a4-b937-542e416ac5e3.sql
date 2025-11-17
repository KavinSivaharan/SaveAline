-- Allow 'partial' status for scrape jobs
ALTER TABLE scrape_jobs DROP CONSTRAINT IF EXISTS scrape_jobs_status_check;
ALTER TABLE scrape_jobs ADD CONSTRAINT scrape_jobs_status_check 
  CHECK (status IN ('pending', 'processing', 'completed', 'partial', 'failed'));