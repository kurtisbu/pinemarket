
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, RefreshCw, Star } from 'lucide-react';

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
    console.log('Creating virtual plan from program data');
    
    // Determine default interval and price
    let defaultPrice = 0;
    let defaultInterval = 'month';
    
    if (program.billing_interval === 'month' && program.monthly_price) {
      defaultPrice = program.monthly_price;
      defaultInterval = 'month';
    } else if (program.billing_interval === 'year' && program.yearly_price) {
      defaultPrice = program.yearly_price;
      defaultInterval = 'year';
    } else if (program.billing_interval === 'both') {
      // Default to monthly if both are available
      if (program.monthly_price) {
        defaultPrice = program.monthly_price;
        defaultInterval = 'month';
      } else if (program.yearly_price) {
        defaultPrice = program.yearly_price;
        defaultInterval = 'year';
      }
    }

    const virtualPlan: SubscriptionPlan = {
      id: `virtual-${program.id}`,
      name: `${program.title} Access`,
      description: 'Subscribe to access this Pine Script',
      price: defaultPrice,
      interval: defaultInterval,
      features: [
        'Full access to this Pine Script',
        'Automatic updates and improvements',
        'Direct assignment to your TradingView account',
        'Priority support from the script author'
      ]
    };

    console.log('Virtual plan created:', virtualPlan);
    setSubscriptionPlan(virtualPlan);
    setLoading(false);
  };

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
      createVirtualPlan();
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

  const getCurrentPrice = () => {
    if (!program) return 0;
    
    if (selectedInterval === 'month' && program.monthly_price) {
      return program.monthly_price;
    } else if (selectedInterval === 'year' && program.yearly_price) {
      return program.yearly_price;
    }
    
    return subscriptionPlan?.price || 0;
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
      const currentPrice = getCurrentPrice();
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

  const getIntervalOptions = () => {
    const options = [];
    if (program.monthly_price && (program.billing_interval === 'month' || program.billing_interval === 'both')) {
      options.push({ value: 'month' as const, label: 'Monthly', price: program.monthly_price });
    }
    if (program.yearly_price && (program.billing_interval === 'year' || program.billing_interval === 'both')) {
      options.push({ value: 'year' as const, label: 'Yearly', price: program.yearly_price });
    }
    return options;
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

  const intervalOptions = getIntervalOptions();
  const currentPrice = getCurrentPrice();

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
        {/* Pricing Options */}
        {intervalOptions.length > 1 && (
          <div className="space-y-3">
            <h4 className="font-medium">Choose your billing interval:</h4>
            <div className="grid gap-2">
              {intervalOptions.map((option) => (
                <Button
                  key={option.value}
                  variant={selectedInterval === option.value ? "default" : "outline"}
                  className="justify-between h-auto p-4"
                  onClick={() => setSelectedInterval(option.value)}
                >
                  <div className="text-left">
                    <div className="font-medium">{option.label}</div>
                    <div className="text-sm text-muted-foreground">
                      ${option.price}/{option.value}
                    </div>
                  </div>
                  {selectedInterval === option.value && <Check className="w-4 h-4" />}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Current Price Display */}
        <div className="text-center p-4 bg-muted/50 rounded-lg">
          <div className="text-3xl font-bold text-green-600">
            ${currentPrice}
            <span className="text-lg font-normal text-muted-foreground">
              /{selectedInterval}
            </span>
          </div>
          {program.trial_period_days && program.trial_period_days > 0 && (
            <Badge variant="secondary" className="mt-2">
              {program.trial_period_days} day free trial
            </Badge>
          )}
        </div>

        {/* Features */}
        {subscriptionPlan && subscriptionPlan.features.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium">What's included:</h4>
            <ul className="space-y-2">
              {subscriptionPlan.features.map((feature, index) => (
                <li key={index} className="flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action Button */}
        {hasAccess ? (
          <div className="text-center space-y-2">
            <Badge variant="default" className="mb-2 flex items-center gap-2 justify-center">
              <Star className="w-4 h-4" />
              You have access to this script
            </Badge>
            <p className="text-sm text-muted-foreground">
              Your subscription includes access to this Pine Script.
            </p>
          </div>
        ) : (
          <Button 
            onClick={handleSubscribe} 
            disabled={subscribing}
            className="w-full h-12 text-lg font-semibold"
          >
            {subscribing ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                Subscribe for ${currentPrice}/{selectedInterval}
                {program.trial_period_days && program.trial_period_days > 0 && (
                  <span className="ml-2 text-sm font-normal">
                    ({program.trial_period_days} day trial)
                  </span>
                )}
              </>
            )}
          </Button>
        )}

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
