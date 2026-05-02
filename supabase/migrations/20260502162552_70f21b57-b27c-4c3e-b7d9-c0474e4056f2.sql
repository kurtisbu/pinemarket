
-- 1. Add trending_score column
ALTER TABLE public.programs
ADD COLUMN IF NOT EXISTS trending_score numeric NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_programs_trending_score
  ON public.programs (trending_score DESC)
  WHERE status = 'published';

-- 2. Recompute function: full refresh OR single program
CREATE OR REPLACE FUNCTION public.calculate_trending_scores(p_program_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  WITH stats AS (
    SELECT
      pr.id AS program_id,
      pr.created_at,
      COALESCE(COUNT(pu.id) FILTER (
        WHERE pu.status = 'completed'
          AND pu.purchased_at > now() - INTERVAL '30 days'
      ), 0) AS recent_purchases,
      COALESCE(SUM(pu.amount) FILTER (
        WHERE pu.status = 'completed'
          AND pu.purchased_at > now() - INTERVAL '30 days'
      ), 0) AS recent_revenue
    FROM public.programs pr
    LEFT JOIN public.purchases pu ON pu.program_id = pr.id
    WHERE p_program_id IS NULL OR pr.id = p_program_id
    GROUP BY pr.id, pr.created_at
  )
  UPDATE public.programs p
  SET trending_score = (
    (s.recent_purchases * 10)
    + (LN(s.recent_revenue + 1) * 5)
  ) / POWER(EXTRACT(EPOCH FROM (now() - s.created_at)) / 3600 + 2, 1.5)
  FROM stats s
  WHERE p.id = s.program_id;
END;
$$;

-- 3. Trigger: recompute on purchase status change to completed
CREATE OR REPLACE FUNCTION public.trigger_recalc_trending_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.program_id IS NOT NULL THEN
    PERFORM public.calculate_trending_scores(NEW.program_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS purchases_recalc_trending ON public.purchases;
CREATE TRIGGER purchases_recalc_trending
AFTER INSERT OR UPDATE OF status ON public.purchases
FOR EACH ROW
WHEN (NEW.status = 'completed')
EXECUTE FUNCTION public.trigger_recalc_trending_score();

-- 4. Hourly cron refresh (handles time decay)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

SELECT cron.unschedule('refresh-trending-scores')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-trending-scores');

SELECT cron.schedule(
  'refresh-trending-scores',
  '0 * * * *',
  $$ SELECT public.calculate_trending_scores(NULL); $$
);

-- 5. Initial population
SELECT public.calculate_trending_scores(NULL);
