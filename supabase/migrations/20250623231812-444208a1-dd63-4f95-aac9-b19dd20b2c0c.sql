
-- Create subscription_plans table to define available subscription tiers
CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  interval TEXT NOT NULL CHECK (interval IN ('month', 'year')),
  stripe_price_id TEXT UNIQUE,
  features JSONB DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_subscriptions table to track user subscription status
CREATE TABLE public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subscription_plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'past_due', 'trialing', 'incomplete')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, subscription_plan_id)
);

-- Create subscription_access table to track which programs users can access via subscription
CREATE TABLE public.subscription_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_subscription_id UUID NOT NULL REFERENCES public.user_subscriptions(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_subscription_id, program_id)
);

-- Add subscription-related columns to programs table
ALTER TABLE public.programs 
ADD COLUMN pricing_model TEXT NOT NULL DEFAULT 'one_time' CHECK (pricing_model IN ('one_time', 'subscription')),
ADD COLUMN subscription_plan_id UUID REFERENCES public.subscription_plans(id),
ADD COLUMN trial_period_days INTEGER DEFAULT 0;

-- Enable RLS on new tables
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_access ENABLE ROW LEVEL SECURITY;

-- RLS policies for subscription_plans (public read access)
CREATE POLICY "Anyone can view active subscription plans" 
ON public.subscription_plans FOR SELECT 
USING (is_active = true);

-- RLS policies for user_subscriptions
CREATE POLICY "Users can view their own subscriptions" 
ON public.user_subscriptions FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Service can manage subscriptions" 
ON public.user_subscriptions FOR ALL 
USING (true);

-- RLS policies for subscription_access
CREATE POLICY "Users can view their own subscription access" 
ON public.subscription_access FOR SELECT 
USING (
  user_subscription_id IN (
    SELECT id FROM public.user_subscriptions WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Service can manage subscription access" 
ON public.subscription_access FOR ALL 
USING (true);

-- Add triggers for updated_at
CREATE TRIGGER subscription_plans_updated_at
BEFORE UPDATE ON public.subscription_plans
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER user_subscriptions_updated_at
BEFORE UPDATE ON public.user_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Insert sample subscription plans
INSERT INTO public.subscription_plans (name, description, price, interval, features) VALUES
('Basic', 'Access to basic scripts', 9.99, 'month', '["Basic script access", "Community support"]'),
('Premium', 'Access to premium scripts and features', 19.99, 'month', '["Premium script access", "Priority support", "Advanced analytics"]'),
('Pro', 'Full access to all scripts and features', 49.99, 'month', '["All script access", "1-on-1 support", "Custom script requests", "API access"]');
