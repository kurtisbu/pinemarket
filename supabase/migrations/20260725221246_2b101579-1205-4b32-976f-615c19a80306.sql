CREATE OR REPLACE FUNCTION public.admin_list_test_accounts()
 RETURNS TABLE(id uuid, username text, display_name text, email text, created_at timestamp with time zone, stripe_charges_enabled boolean, is_tradingview_connected boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  RETURN QUERY
  SELECT p.id, p.username, p.display_name,
         (SELECT u.email::text FROM auth.users u WHERE u.id = p.id),
         p.created_at, p.stripe_charges_enabled, p.is_tradingview_connected
  FROM public.profiles p
  WHERE p.is_test_account = true
  ORDER BY p.created_at DESC;
END;
$function$;