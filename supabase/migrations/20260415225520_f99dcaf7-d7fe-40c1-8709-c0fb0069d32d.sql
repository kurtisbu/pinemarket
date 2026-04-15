
CREATE TABLE public.interest_signups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  tradingview_username text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_interest_signups_email ON public.interest_signups (email);

ALTER TABLE public.interest_signups ENABLE ROW LEVEL SECURITY;

-- Anyone can submit (no auth required)
CREATE POLICY "Anyone can submit interest signup"
  ON public.interest_signups
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only admins can view
CREATE POLICY "Admins can view interest signups"
  ON public.interest_signups
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
