
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, CreditCard, DollarSign, Loader2 } from 'lucide-react';

const StripeConnectSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [stripeStatus, setStripeStatus] = useState({
    account_id: null,
    onboarding_completed: false,
    charges_enabled: false,
    payouts_enabled: false,
  });

  useEffect(() => {
    if (user) {
      fetchStripeStatus();
    }
  }, [user]);

  const fetchStripeStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('stripe_account_id, stripe_onboarding_completed, stripe_charges_enabled, stripe_payouts_enabled')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      setStripeStatus({
        account_id: data.stripe_account_id,
        onboarding_completed: data.stripe_onboarding_completed,
        charges_enabled: data.stripe_charges_enabled,
        payouts_enabled: data.stripe_payouts_enabled,
      });

      // If account exists, check current status
      if (data.stripe_account_id) {
        checkAccountStatus(data.stripe_account_id);
      }
    } catch (error) {
      console.error('Error fetching Stripe status:', error);
    }
  };

  const checkAccountStatus = async (accountId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('stripe-connect', {
        body: {
          action: 'get-account-status',
          account_id: accountId,
        },
      });

      if (error) throw error;

      setStripeStatus(prev => ({
        ...prev,
        onboarding_completed: data.details_submitted,
        charges_enabled: data.charges_enabled,
        payouts_enabled: data.payouts_enabled,
      }));
    } catch (error) {
      console.error('Error checking account status:', error);
    }
  };

  const createStripeAccount = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-connect', {
        body: {
          action: 'create-connect-account',
          country: 'US',
        },
      });

      if (error) throw error;

      setStripeStatus(prev => ({
        ...prev,
        account_id: data.account_id,
      }));

      toast({
        title: 'Stripe account created',
        description: 'Now you need to complete the onboarding process.',
      });

      // Immediately start onboarding
      startOnboarding(data.account_id);
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const startOnboarding = async (accountId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-connect', {
        body: {
          action: 'create-account-link',
          account_id: accountId,
          refresh_url: window.location.href,
          return_url: window.location.href,
        },
      });

      if (error) throw error;

      // Open onboarding in new tab
      window.open(data.url, '_blank');
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const openStripeDashboard = async () => {
    if (!stripeStatus.account_id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-connect', {
        body: {
          action: 'create-dashboard-link',
          account_id: stripeStatus.account_id,
        },
      });

      if (error) throw error;

      window.open(data.url, '_blank');
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Stripe Connect - Payment Setup
          </CardTitle>
          <Badge variant={stripeStatus.charges_enabled ? 'default' : 'destructive'}>
            {stripeStatus.charges_enabled ? 'Ready to Receive Payments' : 'Setup Required'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Connect your Stripe account to receive payments when customers purchase your scripts. 
          The platform takes a 5% fee from each sale, and buyers pay an additional 5% service fee.
        </p>

        <div className="bg-muted/50 p-4 rounded-lg">
          <h4 className="font-semibold mb-2">Fee Structure:</h4>
          <ul className="text-sm space-y-1">
            <li>• Sellers receive: 95% of listed price</li>
            <li>• Platform fee: 5% of listed price</li>
            <li>• Buyers pay: Listed price + 5% service fee</li>
          </ul>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${stripeStatus.account_id ? 'bg-green-500' : 'bg-gray-400'}`} />
            <span className="text-sm">Account Created</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${stripeStatus.onboarding_completed ? 'bg-green-500' : 'bg-gray-400'}`} />
            <span className="text-sm">Onboarding Complete</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${stripeStatus.payouts_enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
            <span className="text-sm">Payouts Enabled</span>
          </div>
        </div>

        <div className="flex gap-2">
          {!stripeStatus.account_id ? (
            <Button 
              onClick={createStripeAccount}
              disabled={loading}
              className="flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
              Connect Stripe Account
            </Button>
          ) : !stripeStatus.onboarding_completed ? (
            <Button 
              onClick={() => startOnboarding(stripeStatus.account_id)}
              disabled={loading}
              variant="outline"
              className="flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
              Complete Onboarding
            </Button>
          ) : (
            <Button 
              onClick={openStripeDashboard}
              disabled={loading}
              variant="outline"
              className="flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
              Open Stripe Dashboard
            </Button>
          )}
          
          {stripeStatus.account_id && (
            <Button 
              onClick={() => checkAccountStatus(stripeStatus.account_id)}
              variant="ghost"
              size="sm"
            >
              Refresh Status
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default StripeConnectSettings;
