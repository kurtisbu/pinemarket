
import React from 'react';
import { Badge } from '@/components/ui/badge';

interface PriceDisplayProps {
  price: number;
  interval: string;
  trialPeriodDays?: number | null;
}

const PriceDisplay: React.FC<PriceDisplayProps> = ({
  price,
  interval,
  trialPeriodDays
}) => {
  return (
    <div className="text-center p-4 bg-muted/50 rounded-lg">
      <div className="text-3xl font-bold text-green-600">
        ${price}
        <span className="text-lg font-normal text-muted-foreground">
          /{interval}
        </span>
      </div>
      {trialPeriodDays && trialPeriodDays > 0 && (
        <Badge variant="secondary" className="mt-2">
          {trialPeriodDays} day free trial
        </Badge>
      )}
    </div>
  );
};

export default PriceDisplay;
