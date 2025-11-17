-- Fix function search_path for security with CASCADE
DROP FUNCTION IF EXISTS public.update_scrape_jobs_updated_at() CASCADE;
CREATE OR REPLACE FUNCTION public.update_scrape_jobs_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS update_scrape_jobs_updated_at ON scrape_jobs;
CREATE TRIGGER update_scrape_jobs_updated_at
  BEFORE UPDATE ON scrape_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_scrape_jobs_updated_at();