
-- Create alert secret in vault (idempotent)
DO $$
DECLARE
  existing uuid;
BEGIN
  SELECT id INTO existing FROM vault.secrets WHERE name = 'discord_alert_secret';
  IF existing IS NULL THEN
    PERFORM vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'discord_alert_secret');
  END IF;
END $$;

-- Helper: post an alert to the discord-alerts edge function via pg_net
CREATE OR REPLACE FUNCTION public.notify_discord_alert(_payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  alert_secret text;
BEGIN
  SELECT decrypted_secret INTO alert_secret
  FROM vault.decrypted_secrets
  WHERE name = 'discord_alert_secret'
  LIMIT 1;

  IF alert_secret IS NULL THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://zympnpibhohnxsnbxtaf.supabase.co/functions/v1/discord-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-alert-secret', alert_secret
    ),
    body := _payload,
    timeout_milliseconds := 5000
  );
EXCEPTION WHEN OTHERS THEN
  -- never break the originating write
  RAISE WARNING 'notify_discord_alert failed: %', SQLERRM;
END;
$$;

-- Trigger: new signup
CREATE OR REPLACE FUNCTION public.trg_alert_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.notify_discord_alert(jsonb_build_object(
    'event', 'signup',
    'user_id', NEW.id,
    'username', NEW.username,
    'display_name', NEW.display_name
  ));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_alert_signup ON public.profiles;
CREATE TRIGGER profiles_alert_signup
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.trg_alert_signup();

-- Trigger: seller finished onboarding (Stripe charges enabled AND TradingView connected, first time)
CREATE OR REPLACE FUNCTION public.trg_alert_seller_onboarded()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  was_onboarded boolean;
  is_onboarded boolean;
BEGIN
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

DROP TRIGGER IF EXISTS profiles_alert_seller_onboarded ON public.profiles;
CREATE TRIGGER profiles_alert_seller_onboarded
AFTER UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.trg_alert_seller_onboarded();

-- Trigger: program published (status transitions to 'published')
CREATE OR REPLACE FUNCTION public.trg_alert_program_published()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  seller_username text;
  seller_display text;
BEGIN
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

DROP TRIGGER IF EXISTS programs_alert_published ON public.programs;
CREATE TRIGGER programs_alert_published
AFTER INSERT OR UPDATE OF status ON public.programs
FOR EACH ROW EXECUTE FUNCTION public.trg_alert_program_published();
