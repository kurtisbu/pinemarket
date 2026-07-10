CREATE OR REPLACE FUNCTION public.get_public_seller_info(_seller_id uuid)
RETURNS TABLE(
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  bio text,
  is_tradingview_connected boolean,
  tradingview_username text,
  default_discord_invite_url text,
  default_discord_description text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.username, p.display_name, p.avatar_url, p.bio,
         p.is_tradingview_connected, p.tradingview_username,
         p.default_discord_invite_url, p.default_discord_description
  FROM public.profiles p WHERE p.id = _seller_id LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_seller_info(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_sellers_info(_seller_ids uuid[])
RETURNS TABLE(
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  bio text,
  is_tradingview_connected boolean,
  tradingview_username text,
  default_discord_invite_url text,
  default_discord_description text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.username, p.display_name, p.avatar_url, p.bio,
         p.is_tradingview_connected, p.tradingview_username,
         p.default_discord_invite_url, p.default_discord_description
  FROM public.profiles p WHERE p.id = ANY(_seller_ids);
$$;

GRANT EXECUTE ON FUNCTION public.get_public_sellers_info(uuid[]) TO anon, authenticated;