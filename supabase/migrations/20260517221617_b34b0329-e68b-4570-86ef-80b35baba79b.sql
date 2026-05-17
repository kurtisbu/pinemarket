
-- Support tickets system
CREATE TYPE public.support_ticket_status AS ENUM ('open', 'in_progress', 'waiting_user', 'resolved', 'closed');
CREATE TYPE public.support_ticket_priority AS ENUM ('low', 'normal', 'high', 'urgent');
CREATE TYPE public.support_ticket_category AS ENUM ('billing', 'tradingview_access', 'bug_report', 'account', 'feature_request', 'other');
CREATE TYPE public.support_message_author_type AS ENUM ('user', 'admin', 'system');

CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text NOT NULL,
  display_name text,
  subject text NOT NULL,
  category public.support_ticket_category NOT NULL DEFAULT 'other',
  status public.support_ticket_status NOT NULL DEFAULT 'open',
  priority public.support_ticket_priority NOT NULL DEFAULT 'normal',
  related_purchase_id uuid,
  related_program_id uuid,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_type public.support_message_author_type NOT NULL DEFAULT 'user',
  author_name text,
  body text NOT NULL,
  is_internal_note boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_tickets_user_id ON public.support_tickets(user_id);
CREATE INDEX idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX idx_support_tickets_last_message_at ON public.support_tickets(last_message_at DESC);
CREATE INDEX idx_support_ticket_messages_ticket_id ON public.support_ticket_messages(ticket_id, created_at);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

-- Tickets policies
CREATE POLICY "Users can view their own tickets"
  ON public.support_tickets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all tickets"
  ON public.support_tickets FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can create their own tickets"
  ON public.support_tickets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND email IS NOT NULL);

CREATE POLICY "Anonymous users can create tickets with email"
  ON public.support_tickets FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL AND email IS NOT NULL AND length(email) > 3);

CREATE POLICY "Users can update their own ticket status"
  ON public.support_tickets FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update any ticket"
  ON public.support_tickets FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Messages policies
CREATE POLICY "Users can view messages on their tickets"
  ON public.support_ticket_messages FOR SELECT
  USING (
    NOT is_internal_note
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all messages"
  ON public.support_ticket_messages FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can post replies on their tickets"
  ON public.support_ticket_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND author_type = 'user'
    AND is_internal_note = false
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Anonymous users can post initial message on guest ticket"
  ON public.support_ticket_messages FOR INSERT
  TO anon
  WITH CHECK (
    author_id IS NULL
    AND author_type = 'user'
    AND is_internal_note = false
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id AND t.user_id IS NULL
    )
  );

CREATE POLICY "Admins can post messages"
  ON public.support_ticket_messages FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') AND author_id = auth.uid()
  );

-- Trigger to update ticket last_message_at + updated_at
CREATE OR REPLACE FUNCTION public.touch_support_ticket_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.support_tickets
  SET last_message_at = NEW.created_at,
      updated_at = NEW.created_at,
      status = CASE
        WHEN NEW.is_internal_note THEN status
        WHEN NEW.author_type = 'admin' AND status IN ('open', 'in_progress') THEN 'waiting_user'::support_ticket_status
        WHEN NEW.author_type = 'user' AND status IN ('waiting_user', 'resolved') THEN 'open'::support_ticket_status
        ELSE status
      END
  WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_touch_support_ticket_on_message
  AFTER INSERT ON public.support_ticket_messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_support_ticket_on_message();

CREATE TRIGGER trg_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
