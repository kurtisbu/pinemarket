
-- 1. Flags on profiles + programs
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_test_account boolean NOT NULL DEFAULT false;
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS is_test_program boolean NOT NULL DEFAULT false;

-- 2. is_test on transactional tables
ALTER TABLE public.purchases           ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
ALTER TABLE public.script_assignments  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
ALTER TABLE public.payouts             ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
ALTER TABLE public.seller_balances     ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
ALTER TABLE public.user_subscriptions  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
ALTER TABLE public.trial_usage         ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
ALTER TABLE public.assignment_logs     ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
ALTER TABLE public.discord_deliveries  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_programs_is_test ON public.programs(is_test_program);
CREATE INDEX IF NOT EXISTS idx_profiles_is_test ON public.profiles(is_test_account);
CREATE INDEX IF NOT EXISTS idx_purchases_is_test ON public.purchases(is_test);

-- 3. Trigger: auto-tag programs from test sellers
CREATE OR REPLACE FUNCTION public.set_program_test_flag()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  SELECT COALESCE(is_test_account, false) INTO NEW.is_test_program
  FROM public.profiles WHERE id = NEW.seller_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_program_test_flag ON public.programs;
CREATE TRIGGER trg_set_program_test_flag
  BEFORE INSERT ON public.programs
  FOR EACH ROW EXECUTE FUNCTION public.set_program_test_flag();

-- 4. Skip discord alerts for test users/programs
CREATE OR REPLACE FUNCTION public.trg_alert_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE(NEW.is_test_account, false) THEN RETURN NEW; END IF;
  PERFORM public.notify_discord_alert(jsonb_build_object(
    'event', 'signup',
    'user_id', NEW.id,
    'username', NEW.username,
    'display_name', NEW.display_name
  ));
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_alert_seller_onboarded()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  was_onboarded boolean;
  is_onboarded boolean;
BEGIN
  IF COALESCE(NEW.is_test_account, false) THEN RETURN NEW; END IF;
  was_onboarded := COALESCE(OLD.stripe_charges_enabled, false) AND COALESCE(OLD.is_tradingview_connected, false);
  is_onboarded  := COALESCE(NEW.stripe_charges_enabled, false) AND COALESCE(NEW.is_tradingview_connected, false);
  IF is_onboarded AND NOT was_onboarded THEN
    PERFORM public.notify_discord_alert(jsonb_build_object(
      'event', 'seller_onboarded',
      'user_id', NEW.id,
      'username', NEW.username,
      'display_name', NEW.display_name
    ));
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_alert_program_published()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  seller_username text;
  seller_display text;
BEGIN
  IF COALESCE(NEW.is_test_program, false) THEN RETURN NEW; END IF;
  IF NEW.status = 'published' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published') THEN
    SELECT username, display_name INTO seller_username, seller_display
    FROM public.profiles WHERE id = NEW.seller_id;
    PERFORM public.notify_discord_alert(jsonb_build_object(
      'event', 'program_published',
      'program_id', NEW.id,
      'program_title', NEW.title,
      'category', NEW.category,
      'user_id', NEW.seller_id,
      'username', seller_username,
      'display_name', seller_display
    ));
  END IF;
  RETURN NEW;
END;
$$;

-- 5. Trending calc excludes test purchases
CREATE OR REPLACE FUNCTION public.calculate_trending_scores(p_program_id uuid DEFAULT NULL::uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  WITH stats AS (
    SELECT
      pr.id AS program_id,
      pr.created_at,
      COALESCE(COUNT(pu.id) FILTER (
        WHERE pu.status = 'completed'
          AND COALESCE(pu.is_test, false) = false
          AND pu.purchased_at > now() - INTERVAL '30 days'
      ), 0) AS recent_purchases,
      COALESCE(SUM(pu.amount) FILTER (
        WHERE pu.status = 'completed'
          AND COALESCE(pu.is_test, false) = false
          AND pu.purchased_at > now() - INTERVAL '30 days'
      ), 0) AS recent_revenue
    FROM public.programs pr
    LEFT JOIN public.purchases pu ON pu.program_id = pr.id
    WHERE (p_program_id IS NULL OR pr.id = p_program_id)
      AND COALESCE(pr.is_test_program, false) = false
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

-- 6. Public creator/featured lists hide test users
CREATE OR REPLACE FUNCTION public.get_featured_creators_with_stats()
RETURNS TABLE(id uuid, username text, display_name text, avatar_url text, bio text, role text, created_at timestamp with time zone, is_tradingview_connected boolean, is_featured boolean, featured_at timestamp with time zone, featured_priority integer, featured_description text, custom_platform_fee_percent numeric, total_programs bigint, avg_rating numeric, total_sales bigint, total_revenue numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    p.id, p.username, p.display_name, p.avatar_url, p.bio, p.role, p.created_at,
    p.is_tradingview_connected, p.is_featured, p.featured_at, p.featured_priority, p.featured_description,
    p.custom_platform_fee_percent,
    COALESCE(prog_stats.total_programs, 0::bigint) AS total_programs,
    COALESCE(prog_stats.avg_rating, 0::numeric) AS avg_rating,
    COALESCE(sales_stats.total_sales, 0::bigint) AS total_sales,
    COALESCE(sales_stats.total_revenue, 0::numeric) AS total_revenue
  FROM public.profiles p
  LEFT JOIN (
    SELECT seller_id, COUNT(*) AS total_programs, AVG(average_rating) AS avg_rating
    FROM public.programs
    WHERE status = 'published' AND COALESCE(is_test_program, false) = false
    GROUP BY seller_id
  ) prog_stats ON p.id = prog_stats.seller_id
  LEFT JOIN (
    SELECT seller_id, COUNT(*) AS total_sales, SUM(amount) AS total_revenue
    FROM public.purchases
    WHERE status = 'completed' AND COALESCE(is_test, false) = false
    GROUP BY seller_id
  ) sales_stats ON p.id = sales_stats.seller_id
  WHERE p.is_featured = true AND COALESCE(p.is_test_account, false) = false
  ORDER BY p.featured_priority DESC, p.featured_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_public_profiles()
RETURNS TABLE(id uuid, username text, display_name text, avatar_url text, bio text, role text, created_at timestamp with time zone, is_tradingview_connected boolean, is_featured boolean, featured_at timestamp with time zone, featured_priority integer, featured_description text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.username, p.display_name, p.avatar_url, p.bio, p.role, p.created_at,
    p.is_tradingview_connected, p.is_featured, p.featured_at, p.featured_priority, p.featured_description
  FROM public.profiles p
  WHERE COALESCE(p.is_test_account, false) = false;
$$;

-- 7. Admin RPCs
CREATE OR REPLACE FUNCTION public.admin_set_test_account(_user_id uuid, _is_test boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;

  UPDATE public.profiles
  SET is_test_account = _is_test,
      -- clear Stripe fields so user re-onboards in the correct mode
      stripe_account_id = CASE WHEN _is_test THEN NULL ELSE stripe_account_id END,
      stripe_onboarding_completed = CASE WHEN _is_test THEN false ELSE stripe_onboarding_completed END,
      stripe_charges_enabled = CASE WHEN _is_test THEN false ELSE stripe_charges_enabled END,
      stripe_payouts_enabled = CASE WHEN _is_test THEN false ELSE stripe_payouts_enabled END,
      updated_at = now()
  WHERE id = _user_id;

  -- Sync program flags for this user
  UPDATE public.programs
  SET is_test_program = _is_test, updated_at = now()
  WHERE seller_id = _user_id;

  PERFORM public.log_security_event(
    'admin_set_test_account',
    'profile',
    _user_id::text,
    jsonb_build_object('is_test', _is_test),
    'low'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_test_accounts()
RETURNS TABLE(id uuid, username text, display_name text, email text, created_at timestamp with time zone, stripe_charges_enabled boolean, is_tradingview_connected boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  RETURN QUERY
  SELECT p.id, p.username, p.display_name,
         (SELECT u.email FROM auth.users u WHERE u.id = p.id),
         p.created_at, p.stripe_charges_enabled, p.is_tradingview_connected
  FROM public.profiles p
  WHERE p.is_test_account = true
  ORDER BY p.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_wipe_test_data()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  deleted jsonb := '{}'::jsonb;
  n int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;

  DELETE FROM public.discord_deliveries WHERE is_test = true;      GET DIAGNOSTICS n = ROW_COUNT; deleted := deleted || jsonb_build_object('discord_deliveries', n);
  DELETE FROM public.assignment_logs WHERE is_test = true;         GET DIAGNOSTICS n = ROW_COUNT; deleted := deleted || jsonb_build_object('assignment_logs', n);
  DELETE FROM public.script_assignments WHERE is_test = true;      GET DIAGNOSTICS n = ROW_COUNT; deleted := deleted || jsonb_build_object('script_assignments', n);
  DELETE FROM public.trial_usage WHERE is_test = true;             GET DIAGNOSTICS n = ROW_COUNT; deleted := deleted || jsonb_build_object('trial_usage', n);
  DELETE FROM public.user_subscriptions WHERE is_test = true;      GET DIAGNOSTICS n = ROW_COUNT; deleted := deleted || jsonb_build_object('user_subscriptions', n);
  DELETE FROM public.payouts WHERE is_test = true;                 GET DIAGNOSTICS n = ROW_COUNT; deleted := deleted || jsonb_build_object('payouts', n);
  DELETE FROM public.purchases WHERE is_test = true;               GET DIAGNOSTICS n = ROW_COUNT; deleted := deleted || jsonb_build_object('purchases', n);
  DELETE FROM public.seller_balances WHERE is_test = true;         GET DIAGNOSTICS n = ROW_COUNT; deleted := deleted || jsonb_build_object('seller_balances', n);
  DELETE FROM public.programs WHERE is_test_program = true;        GET DIAGNOSTICS n = ROW_COUNT; deleted := deleted || jsonb_build_object('programs', n);

  PERFORM public.log_security_event('admin_wipe_test_data', 'system', NULL, deleted, 'medium');
  RETURN deleted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_test_account(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_test_accounts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_wipe_test_data() TO authenticated;
