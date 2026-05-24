import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, CreditCard, ExternalLink, CheckCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface StripeSetupStepProps {
  onNext: () => void;
  onBack: () => void;
}

const StripeSetupStep: React.FC<StripeSetupStepProps> = ({ onNext, onBack }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [status, setStatus] = useState({
    hasAccount: false,
    chargesEnabled: false,
    onboardingCompleted: false,
  });

  const refreshStatus = async () => {
    setChecking(true);
    try {
      const { data, error } = await supabase.rpc('get_user_stripe_status');
      if (error) throw error;
      if (data && data.length > 0) {
        const s = data[0];
        setStatus({
          hasAccount: s.has_stripe_account,
          chargesEnabled: s.charges_enabled,
          onboardingCompleted: s.onboarding_completed,
        });

        if (s.has_stripe_account) {
          // Sync latest from Stripe
          const { data: live } = await supabase.functions.invoke('stripe-connect', {
            body: { action: 'get-my-account-status' },
          });
          if (live?.success) {
            setStatus({
              hasAccount: live.has_account,
              chargesEnabled: live.charges_enabled,
              onboardingCompleted: live.details_submitted,
            });
          }
        }
      }
    } catch (err: any) {
      console.error('Stripe status check failed:', err);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    refreshStatus();
  }, []);

  const startStripeOnboarding = async () => {
    setLoading(true);
    try {
      if (!status.hasAccount) {
        const { error: createErr } = await supabase.functions.invoke('stripe-connect', {
          body: { action: 'create-connect-account', country: 'US' },
        });
        if (createErr) throw createErr;
      }

      const { data, error } = await supabase.functions.invoke('stripe-connect', {
        body: {
          action: 'create-my-account-link',
          refresh_url: window.location.href,
          return_url: window.location.href,
        },
      });
      if (error) throw error;

      window.open(data.url, '_blank');

      toast({
        title: 'Stripe onboarding opened',
        description: 'Complete the setup in the new tab, then return here and click "Refresh Status".',
      });

      setStatus(prev => ({ ...prev, hasAccount: true }));
    } catch (err: any) {
      toast({
        title: 'Stripe setup failed',
        description: err.message || 'Could not start Stripe onboarding.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <CreditCard className="w-6 h-6 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Set Up Payments</h2>
        <p className="text-muted-foreground">
          Connect Stripe so you can get paid when customers purchase your scripts.
        </p>
      </div>

      <div className="bg-muted/50 p-4 rounded-lg space-y-1 text-sm">
        <p className="font-semibold">Fee structure</p>
        <p>• Sellers receive 95% of the listed price</p>
        <p>• Platform fee: 5%</p>
        <p>• Buyers pay a 5% service fee on top</p>
      </div>

      {status.chargesEnabled ? (
        <div className="border border-green-200 bg-green-50 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-green-800">Stripe is connected</p>
            <p className="text-sm text-green-700">
              Your account is fully set up and ready to receive payments.
            </p>
          </div>
        </div>
      ) : status.hasAccount ? (
        <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-yellow-800">Onboarding incomplete</p>
            <p className="text-sm text-yellow-700">
              Finish Stripe's onboarding form to enable payouts. You can resume any time from your dashboard.
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Button
          onClick={startStripeOnboarding}
          disabled={loading || checking}
          className="w-full"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ExternalLink className="w-4 h-4" />
          )}
          {status.hasAccount ? 'Continue Stripe Onboarding' : 'Connect Stripe Account'}
        </Button>

        {status.hasAccount && (
          <Button
            onClick={refreshStatus}
            variant="ghost"
            size="sm"
            disabled={checking}
          >
            {checking && <Loader2 className="w-4 h-4 animate-spin" />}
            Refresh Status
          </Button>
        )}
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext} variant={status.chargesEnabled ? 'default' : 'outline'}>
          {status.chargesEnabled ? 'Continue' : 'Skip for now'}
        </Button>
      </div>

      {!status.chargesEnabled && (
        <p className="text-xs text-muted-foreground text-center">
          You can complete Stripe setup later, but you won't be able to publish programs until it's done.
        </p>
      )}
    </div>
  );
};

export default StripeSetupStep;
