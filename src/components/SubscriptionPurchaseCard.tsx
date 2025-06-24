
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check } from 'lucide-react';

interface Program {
  id: string;
  title: string;
  price: number;
  pricing_model: string;
  subscription_plan_id: string | null;
  trial_period_days: number | null;
  monthly_price: number | null;
  yearly_price: number | null;
  billing_interval: string | null;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  interval: string;
  features: string[];
}

interface SubscriptionPurchaseCardProps {
  program: Program;
}

const SubscriptionPurchaseCard: React.FC<SubscriptionPurchaseCardProps> = ({ program }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [subscriptionPlan, setSubscriptionPlan] = useState<SubscriptionPlan | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    if (program.pricing_model === 'subscription') {
      if (program.subscription_plan_id) {
        fetchSubscriptionPlan();
      } else {
        // If no subscription_plan_id, create a virtual plan from program data
        createVirtualPlan();
      }
      if (user) {
        checkUserAccess();
      }
    } else {
      setLoading(false);
    }
  }, [program, user]);

  const createVirtualPlan = () => {
    // Create a virtual subscription plan from the program's pricing data
    let price = 0;
    let interval = 'month';
    let description = 'Access to this script';

    if (program.billing_interval === 'month' && program.monthly_price) {
      price = program.monthly_price;
      interval = 'month';
    } else if (program.billing_interval === 'year' && program.yearly_price) {
      price = program.yearly_price;
      interval = 'year';
    } else if (program.billing_interval === 'both') {
      // Default to monthly if both are available
      price = program.monthly_price || program.yearly_price || 0;
      interval = program.monthly_price ? 'month' : 'year';
    }

    const virtualPlan: SubscriptionPlan = {
      id: `virtual-${program.id}`,
      name: `${program.title} Subscription`,
      description,
      price,
      interval,
      features: ['Access to this script', 'Regular updates', 'Support']
    };

    setSubscriptionPlan(virtualPlan);
    setLoading(false);
  };

  const fetchSubscriptionPlan = async () => {
    if (!program.subscription_plan_id) return;

    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('id', program.subscription_plan_id)
        .single();

      if (error) throw error;
      
      // Transform the data to ensure features is always a string array
      const transformedPlan = {
        ...data,
        features: Array.isArray(data.features) 
          ? data.features.filter(item => typeof item === 'string') as string[]
          : typeof data.features === 'string' ? [data.features] : []
      };
      
      setSubscriptionPlan(transformedPlan);
    } catch (error: any) {
      console.error('Error fetching subscription plan:', error);
      // Fallback to virtual plan if fetching fails
      createVirtualPlan();
    } finally {
      setLoading(false);
    }
  };

  const checkUserAccess = async () => {
    if (!user || !program.subscription_plan_id) return;

    try {
      // Check if user has active subscription to this plan
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('subscription_plan_id', program.subscription_plan_id)
        .in('status', ['active', 'trialing'])
        .maybeSingle();

      if (error) throw error;
      setHasAccess(!!data);
    } catch (error: any) {
      console.error('Error checking user access:', error);
    }
  };

  const handleSubscribe = async () => {
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to subscribe',
        variant: 'destructive',
      });
      return;
    }

    setSubscribing(true);

    try {
      let functionName = 'create-subscription';
      let requestBody: any = {
        successUrl: `${window.location.origin}/subscription/success`,
        cancelUrl: `${window.location.origin}/subscription/cancel`,
      };

      if (program.subscription_plan_id) {
        // Use existing subscription plan
        requestBody.planId = program.subscription_plan_id;
      } else {
        // Create subscription for individual program
        requestBody.programId = program.id;
        requestBody.price = subscriptionPlan?.price || 0;
        requestBody.interval = subscriptionPlan?.interval || 'month';
        requestBody.productName = program.title;
      }

      console.log('Creating subscription with:', requestBody);

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: requestBody,
      });

      if (error) throw error;

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error('Subscription error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create subscription',
        variant: 'destructive',
      });
    } finally {
      setSubscribing(false);
    }
  };

  if (program.pricing_model !== 'subscription') {
    return null;
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Subscription Required</CardTitle>
          {hasAccess && <Badge variant="default">Subscribed</Badge>}
        </div>
        {subscriptionPlan && (
          <CardDescription>
            This script requires a {subscriptionPlan.name} subscription
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {subscriptionPlan && (
          <div className="space-y-3">
            <div>
              <div className="text-2xl font-bold">
                ${subscriptionPlan.price}
                <span className="text-sm font-normal text-muted-foreground">
                  /{subscriptionPlan.interval}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{subscriptionPlan.description}</p>
            </div>

            {program.trial_period_days && program.trial_period_days > 0 && (
              <Badge variant="secondary">
                {program.trial_period_days} day free trial
              </Badge>
            )}

            <div className="space-y-2">
              <h4 className="font-medium">Includes:</h4>
              <ul className="space-y-1">
                {subscriptionPlan.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {hasAccess ? (
          <div className="text-center">
            <Badge variant="default" className="mb-2">You have access to this script</Badge>
            <p className="text-sm text-muted-foreground">
              Your subscription includes access to this and other premium scripts.
            </p>
          </div>
        ) : (
          <Button 
            onClick={handleSubscribe} 
            disabled={subscribing}
            className="w-full"
          >
            {subscribing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                Subscribe to {subscriptionPlan?.name || 'Plan'}
                {program.trial_period_days && program.trial_period_days > 0 && (
                  <span className="ml-2 text-xs">
                    ({program.trial_period_days} day trial)
                  </span>
                )}
              </>
            )}
          </Button>
        )}

        <div className="text-center">
          <Button variant="link" onClick={() => window.open('/subscriptions', '_blank')}>
            View All Plans
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default SubscriptionPurchaseCard;
