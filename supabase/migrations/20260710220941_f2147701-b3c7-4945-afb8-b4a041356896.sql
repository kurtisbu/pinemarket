ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_discord_invite_url text,
  ADD COLUMN IF NOT EXISTS default_discord_description text;

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS discord_invite_url text,
  ADD COLUMN IF NOT EXISTS discord_description text;

ALTER TABLE public.program_packages
  ADD COLUMN IF NOT EXISTS discord_invite_url text,
  ADD COLUMN IF NOT EXISTS discord_description text;

CREATE OR REPLACE FUNCTION public.validate_discord_invite_url()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.discord_invite_url IS NOT NULL AND NEW.discord_invite_url <> '' THEN
    IF length(NEW.discord_invite_url) > 200 THEN
      RAISE EXCEPTION 'Discord invite URL too long';
    END IF;
    IF NEW.discord_invite_url !~* '^https://(discord\.gg/|discord\.com/invite/)[A-Za-z0-9-]+/?$' THEN
      RAISE EXCEPTION 'Invalid Discord invite URL. Must be https://discord.gg/... or https://discord.com/invite/...';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_profile_discord_invite_url()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.default_discord_invite_url IS NOT NULL AND NEW.default_discord_invite_url <> '' THEN
    IF length(NEW.default_discord_invite_url) > 200 THEN
      RAISE EXCEPTION 'Discord invite URL too long';
    END IF;
    IF NEW.default_discord_invite_url !~* '^https://(discord\.gg/|discord\.com/invite/)[A-Za-z0-9-]+/?$' THEN
      RAISE EXCEPTION 'Invalid Discord invite URL. Must be https://discord.gg/... or https://discord.com/invite/...';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_programs_discord ON public.programs;
CREATE TRIGGER trg_validate_programs_discord BEFORE INSERT OR UPDATE OF discord_invite_url ON public.programs
  FOR EACH ROW EXECUTE FUNCTION public.validate_discord_invite_url();

DROP TRIGGER IF EXISTS trg_validate_packages_discord ON public.program_packages;
CREATE TRIGGER trg_validate_packages_discord BEFORE INSERT OR UPDATE OF discord_invite_url ON public.program_packages
  FOR EACH ROW EXECUTE FUNCTION public.validate_discord_invite_url();

DROP TRIGGER IF EXISTS trg_validate_profiles_discord ON public.profiles;
CREATE TRIGGER trg_validate_profiles_discord BEFORE INSERT OR UPDATE OF default_discord_invite_url ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.validate_profile_discord_invite_url();

CREATE TABLE IF NOT EXISTS public.discord_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid REFERENCES public.purchases(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  program_id uuid REFERENCES public.programs(id) ON DELETE SET NULL,
  package_id uuid REFERENCES public.program_packages(id) ON DELETE SET NULL,
  invite_url text NOT NULL,
  delivered_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.discord_deliveries TO authenticated;
GRANT ALL ON public.discord_deliveries TO service_role;

ALTER TABLE public.discord_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Buyers can view own discord deliveries" ON public.discord_deliveries;
CREATE POLICY "Buyers can view own discord deliveries" ON public.discord_deliveries FOR SELECT TO authenticated USING (buyer_id = auth.uid());

DROP POLICY IF EXISTS "Sellers can view discord deliveries for their sales" ON public.discord_deliveries;
CREATE POLICY "Sellers can view discord deliveries for their sales" ON public.discord_deliveries FOR SELECT TO authenticated USING (seller_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all discord deliveries" ON public.discord_deliveries;
CREATE POLICY "Admins can view all discord deliveries" ON public.discord_deliveries FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_discord_deliveries_buyer ON public.discord_deliveries(buyer_id);
CREATE INDEX IF NOT EXISTS idx_discord_deliveries_purchase ON public.discord_deliveries(purchase_id);

DROP TRIGGER IF EXISTS trg_discord_deliveries_updated_at ON public.discord_deliveries;
CREATE TRIGGER trg_discord_deliveries_updated_at BEFORE UPDATE ON public.discord_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP FUNCTION IF EXISTS public.get_safe_profile_by_username(text);
CREATE OR REPLACE FUNCTION public.get_safe_profile_by_username(_username text)
 RETURNS TABLE(id uuid, username text, display_name text, avatar_url text, bio text, role text, created_at timestamp with time zone, is_tradingview_connected boolean, is_featured boolean, featured_at timestamp with time zone, featured_priority integer, featured_description text, default_discord_invite_url text, default_discord_description text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT p.id, p.username, p.display_name, p.avatar_url, p.bio, p.role, p.created_at,
    p.is_tradingview_connected, p.is_featured, p.featured_at, p.featured_priority, p.featured_description,
    p.default_discord_invite_url, p.default_discord_description
  FROM public.profiles p WHERE p.username = _username LIMIT 1;
$$;