-- Fix the handle_updated_at function to have explicit search_path
DROP FUNCTION IF EXISTS public.handle_updated_at() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Recreate the trigger
DROP TRIGGER IF EXISTS set_updated_at ON public.scraped_content;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.scraped_content
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();