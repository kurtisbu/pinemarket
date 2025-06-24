
-- Update the handle_new_user function to only use tradingview_username from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, tradingview_username)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'tradingview_username'
  );
  RETURN NEW;
END;
$$;
