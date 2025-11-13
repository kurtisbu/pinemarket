import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CreditCard } from 'lucide-react';

interface StripeConnectBannerProps {
  stripeAccountId: string | null;
  stripeChargesEnabled: boolean;
  variant?: 'warning' | 'error';
  showAction?: boolean;
}

const StripeConnectBanner: React.FC<StripeConnectBannerProps> = ({
  stripeAccountId,
  stripeChargesEnabled,
  variant = 'warning',
  showAction = true,
}) => {
  const navigate = useNavigate();

  if (stripeAccountId && stripeChargesEnabled) {
    return null; // Don't show banner if Stripe is properly connected
  }

  const getMessage = () => {
    if (!stripeAccountId) {
      return {
        title: 'Stripe Account Required',
        description: 'You need to connect a Stripe account before you can publish programs and receive payments. This takes just a few minutes.',
      };
    }
    if (!stripeChargesEnabled) {
      return {
        title: 'Complete Stripe Onboarding',
        description: 'Your Stripe account setup is incomplete. Please complete the onboarding process to enable payments.',
      };
    }
    return {
      title: 'Stripe Setup Needed',
      description: 'Please complete your Stripe setup to start receiving payments.',
    };
  };

  const message = getMessage();

  return (
    <Alert variant={variant === 'error' ? 'destructive' : 'default'} className="mb-6">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2">
        <CreditCard className="h-4 w-4" />
        {message.title}
      </AlertTitle>
      <AlertDescription className="mt-2">
        {message.description}
        {showAction && (
          <Button
            onClick={() => navigate('/seller-dashboard')}
            variant="outline"
            size="sm"
            className="mt-3"
          >
            {stripeAccountId ? 'Complete Setup' : 'Connect Stripe Account'}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
};

export default StripeConnectBanner;
