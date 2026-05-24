
CREATE OR REPLACE FUNCTION public.get_admin_activity_feed(p_limit integer DEFAULT 100)
RETURNS TABLE(
  event_type text,
  event_at timestamp with time zone,
  user_id uuid,
  username text,
  display_name text,
  resource_id uuid,
  resource_title text,
  metadata jsonb
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;

  RETURN QUERY
  WITH signups AS (
    SELECT
      'signup'::text AS event_type,
      p.created_at AS event_at,
      p.id AS user_id,
      p.username,
      p.display_name,
      NULL::uuid AS resource_id,
      NULL::text AS resource_title,
      jsonb_build_object(
        'tradingview_username', p.tradingview_username,
        'role', p.role
      ) AS metadata
    FROM public.profiles p
  ),
  onboarded AS (
    SELECT
      'seller_onboarded'::text AS event_type,
      p.updated_at AS event_at,
      p.id AS user_id,
      p.username,
      p.display_name,
      NULL::uuid AS resource_id,
      NULL::text AS resource_title,
      jsonb_build_object(
        'stripe_charges_enabled', p.stripe_charges_enabled,
        'tradingview_connected', p.is_tradingview_connected
      ) AS metadata
    FROM public.profiles p
    WHERE COALESCE(p.stripe_charges_enabled, false) = true
      AND COALESCE(p.is_tradingview_connected, false) = true
  ),
  first_pub AS (
    SELECT DISTINCT ON (pr.seller_id)
      'first_program_published'::text AS event_type,
      pr.created_at AS event_at,
      pr.seller_id AS user_id,
      pf.username,
      pf.display_name,
      pr.id AS resource_id,
      pr.title AS resource_title,
      jsonb_build_object('category', pr.category) AS metadata
    FROM public.programs pr
    LEFT JOIN public.profiles pf ON pf.id = pr.seller_id
    WHERE pr.status = 'published'
    ORDER BY pr.seller_id, pr.created_at ASC
  )
  SELECT * FROM signups
  UNION ALL SELECT * FROM onboarded
  UNION ALL SELECT * FROM first_pub
  ORDER BY event_at DESC
  LIMIT p_limit;
END;
$$;
