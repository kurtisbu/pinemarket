
-- Backfill existing NULL usernames and auto-generate on new signups

CREATE OR REPLACE FUNCTION public.generate_unique_username(_seed text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base text;
  candidate text;
  n int := 0;
BEGIN
  base := lower(regexp_replace(COALESCE(NULLIF(_seed, ''), 'user'), '[^a-z0-9_]+', '', 'gi'));
  IF base IS NULL OR length(base) < 3 THEN
    base := 'user' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  END IF;
  base := left(base, 24);
  candidate := base;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate) LOOP
    n := n + 1;
    candidate := left(base, 20) || n::text;
  END LOOP;
  RETURN candidate;
END;
$$;

-- Update signup trigger to set username
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  seed text;
  uname text;
BEGIN
  seed := COALESCE(
    NEW.raw_user_meta_data ->> 'tradingview_username',
    split_part(NEW.email, '@', 1)
  );
  uname := public.generate_unique_username(seed);

  INSERT INTO public.profiles (id, username, tradingview_username)
  VALUES (
    NEW.id,
    uname,
    NEW.raw_user_meta_data ->> 'tradingview_username'
  );
  RETURN NEW;
END;
$$;

-- Backfill existing rows with NULL username
DO $$
DECLARE
  r record;
  seed text;
BEGIN
  FOR r IN SELECT p.id, p.tradingview_username, u.email
           FROM public.profiles p
           JOIN auth.users u ON u.id = p.id
           WHERE p.username IS NULL LOOP
    seed := COALESCE(NULLIF(r.tradingview_username, ''), split_part(r.email, '@', 1));
    UPDATE public.profiles
       SET username = public.generate_unique_username(seed)
     WHERE id = r.id;
  END LOOP;
END $$;
