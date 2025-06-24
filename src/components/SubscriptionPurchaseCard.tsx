
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw } from 'lucide-react';
import PricingOptions from './subscription/PricingOptions';
import PriceDisplay from './subscription/PriceDisplay';
import FeaturesList from './subscription/FeaturesList';
import SubscriptionButton from './subscription/SubscriptionButton';
import { 
  Program, 
  SubscriptionPlan,
  createVirtualPlan,
  getIntervalOptions,
  getCurrentPrice,
  getIntervalDisplay
} from './subscription/subscriptionUtils';

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
  const [selectedInterval, setSelectedInterval] = useState<'month' | 'year'>('month');

  useEffect(() => {
    console.log('SubscriptionPurchaseCard - Program received:', {
      id: program.id,
      pricing_model: program.pricing_model,
      monthly_price: program.monthly_price,
      yearly_price: program.yearly_price,
      billing_interval: program.billing_interval,
      subscription_plan_id: program.subscription_plan_id
    });

    if (program.pricing_model === 'subscription') {
      if (program.subscription_plan_id) {
        fetchSubscriptionPlan();
      } else {
        const virtualPlan = createVirtualPlan(program);
        console.log('Virtual plan created:', virtualPlan);
        setSubscriptionPlan(virtualPlan);
        setLoading(false);
      }
      if (user) {
        checkUserAccess();
      }
    } else {
      setLoading(false);
    }
  }, [program, user]);

  const fetchSubscriptionPlan = async () => {
    if (!program.subscription_plan_id) return;

    try {
      console.log('Fetching subscription plan:', program.subscription_plan_id);
      
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('id', program.subscription_plan_id)
        .single();

      if (error) throw error;
      
      const transformedPlan = {
        ...data,
        features: Array.isArray(data.features) 
          ? data.features.filter(item => typeof item === 'string') as string[]
          : typeof data.features === 'string' ? [data.features] : []
      };
      
      console.log('Subscription plan fetched:', transformedPlan);
      setSubscriptionPlan(transformedPlan);
    } catch (error: any) {
      console.error('Error fetching subscription plan:', error);
      const virtualPlan = createVirtualPlan(program);
      setSubscriptionPlan(virtualPlan);
    } finally {
      setLoading(false);
    }
  };

  const checkUserAccess = async () => {
    if (!user || !program.subscription_plan_id) return;

    try {
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
      const currentPrice = getCurrentPrice(program, selectedInterval, subscriptionPlan);
      const requestBody: any = {
        successUrl: `${window.location.origin}/subscription/success`,
        cancelUrl: `${window.location.origin}/subscription/cancel`,
      };

      if (program.subscription_plan_id) {
        requestBody.planId = program.subscription_plan_id;
      } else {
        requestBody.programId = program.id;
        requestBody.price = currentPrice;
        requestBody.interval = selectedInterval;
        requestBody.productName = program.title;
      }

      console.log('Creating subscription with:', requestBody);

      const { data, error } = await supabase.functions.invoke('create-subscription', {
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

  const intervalOptions = getIntervalOptions(program);
  const currentPrice = getCurrentPrice(program, selectedInterval, subscriptionPlan);
  const intervalDisplay = getIntervalDisplay(selectedInterval);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Subscription Required
          </CardTitle>
          {hasAccess && <Badge variant="default">Active Subscriber</Badge>}
        </div>
        <CardDescription>
          Subscribe to get access to this Pine Script
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <PricingOptions 
          options={intervalOptions}
          selectedInterval={selectedInterval}
          onIntervalChange={setSelectedInterval}
        />

        <PriceDisplay 
          price={currentPrice}
          interval={intervalDisplay}
          trialPeriodDays={program.trial_period_days}
        />

        {subscriptionPlan && (
          <FeaturesList features={subscriptionPlan.features} />
        )}

        <SubscriptionButton 
          hasAccess={hasAccess}
          subscribing={subscribing}
          price={currentPrice}
          interval={intervalDisplay}
          trialPeriodDays={program.trial_period_days}
          onSubscribe={handleSubscribe}
        />

        <div className="text-center">
          <Button variant="link" onClick={() => window.open('/subscriptions', '_blank')}>
            View All Subscription Plans
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default SubscriptionPurchaseCard;
