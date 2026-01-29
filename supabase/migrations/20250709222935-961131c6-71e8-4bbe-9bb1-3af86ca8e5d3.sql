
-- Update script_assignments table to support trials
ALTER TABLE public.script_assignments 
ADD COLUMN IF NOT EXISTS access_type TEXT DEFAULT 'full_purchase',
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_trial BOOLEAN DEFAULT FALSE;

-- Create trial usage tracking table
CREATE TABLE IF NOT EXISTS public.trial_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  program_id UUID NOT NULL REFERENCES programs(id),
  used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, program_id)
);

-- Enable RLS on trial_usage table
ALTER TABLE public.trial_usage ENABLE ROW LEVEL SECURITY;

-- Create policies for trial_usage table
CREATE POLICY "Users can view their own trial usage" 
  ON public.trial_usage 
  FOR SELECT 
  USING (user_id = auth.uid());

CREATE POLICY "Service can insert trial usage" 
  ON public.trial_usage 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Service can update trial usage" 
  ON public.trial_usage 
  FOR UPDATE 
  USING (true);

-- Update assignment_status enum to include expired
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assignment_status') THEN
    CREATE TYPE assignment_status AS ENUM ('pending', 'assigned', 'failed', 'expired');
  ELSE
    -- Add 'expired' if it doesn't exist
    BEGIN
      ALTER TYPE assignment_status ADD VALUE IF NOT EXISTS 'expired';
    EXCEPTION
      WHEN duplicate_object THEN null;
    END;
  END IF;
END$$;

-- Create function to check trial eligibility
CREATE OR REPLACE FUNCTION public.check_trial_eligibility(p_user_id UUID, p_program_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user has already used trial for this program
  RETURN NOT EXISTS (
    SELECT 1 FROM public.trial_usage 
    WHERE user_id = p_user_id AND program_id = p_program_id
  );
END;
$$;

-- Create function to record trial usage
CREATE OR REPLACE FUNCTION public.record_trial_usage(p_user_id UUID, p_program_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.trial_usage (user_id, program_id)
  VALUES (p_user_id, p_program_id)
  ON CONFLICT (user_id, program_id) DO NOTHING;
END;
$$;
