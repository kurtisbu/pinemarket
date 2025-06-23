
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  interval: string;
  features: string[];
  is_active: boolean;
}

interface SubscriptionPlanSelectorProps {
  selectedPlanId: string;
  onPlanChange: (planId: string) => void;
  trialPeriodDays: number;
  onTrialPeriodChange: (days: number) => void;
}

const SubscriptionPlanSelector: React.FC<SubscriptionPlanSelectorProps> = ({
  selectedPlanId,
  onPlanChange,
  trialPeriodDays,
  onTrialPeriodChange,
}) => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('price');

      if (error) throw error;
      
      const transformedPlans = (data || []).map(plan => ({
        ...plan,
        features: Array.isArray(plan.features) 
          ? plan.features.filter(item => typeof item === 'string') as string[]
          : typeof plan.features === 'string' ? [plan.features] : []
      }));
      
      setPlans(transformedPlans);
    } catch (error) {
      console.error('Error fetching subscription plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedPlan = plans.find(plan => plan.id === selectedPlanId);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="subscription-plan">Subscription Plan *</Label>
        <Select value={selectedPlanId} onValueChange={onPlanChange} required>
          <SelectTrigger>
            <SelectValue placeholder="Select a subscription plan" />
          </SelectTrigger>
          <SelectContent>
            {loading ? (
              <SelectItem value="" disabled>Loading plans...</SelectItem>
            ) : (
              plans.map((plan) => (
                <SelectItem key={plan.id} value={plan.id}>
                  {plan.name} - ${plan.price}/{plan.interval}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      {selectedPlan && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{selectedPlan.name}</CardTitle>
            <CardDescription>{selectedPlan.description}</CardDescription>
            <div className="text-2xl font-bold">
              ${selectedPlan.price}
              <span className="text-sm font-normal text-muted-foreground">
                /{selectedPlan.interval}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <h4 className="font-medium">Plan includes:</h4>
              <ul className="space-y-1">
                {selectedPlan.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        <Label htmlFor="trial-period">Free Trial Period (days)</Label>
        <Input
          id="trial-period"
          type="number"
          min="0"
          max="30"
          value={trialPeriodDays}
          onChange={(e) => onTrialPeriodChange(parseInt(e.target.value) || 0)}
          placeholder="0"
        />
        <p className="text-sm text-muted-foreground">
          Set to 0 for no free trial. Maximum 30 days.
        </p>
      </div>
    </div>
  );
};

export default SubscriptionPlanSelector;
