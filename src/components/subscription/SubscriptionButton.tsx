
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Star } from 'lucide-react';

interface SubscriptionButtonProps {
  hasAccess: boolean;
  subscribing: boolean;
  price: number;
  interval: string;
  trialPeriodDays?: number | null;
  onSubscribe: () => void;
}

const SubscriptionButton: React.FC<SubscriptionButtonProps> = ({
  hasAccess,
  subscribing,
  price,
  interval,
  trialPeriodDays,
  onSubscribe
}) => {
  if (hasAccess) {
    return (
      <div className="text-center space-y-2">
        <Badge variant="default" className="mb-2 flex items-center gap-2 justify-center">
          <Star className="w-4 h-4" />
          You have access to this script
        </Badge>
        <p className="text-sm text-muted-foreground">
          Your subscription includes access to this Pine Script.
        </p>
      </div>
    );
  }

  return (
    <Button 
      onClick={onSubscribe} 
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
          Subscribe for ${price}/{interval}
          {trialPeriodDays && trialPeriodDays > 0 && (
            <span className="ml-2 text-sm font-normal">
              ({trialPeriodDays} day trial)
            </span>
          )}
        </>
      )}
    </Button>
  );
};

export default SubscriptionButton;
