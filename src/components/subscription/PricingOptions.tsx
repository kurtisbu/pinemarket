
import React from 'react';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';

interface PricingOption {
  value: 'month' | 'year';
  label: string;
  price: number;
}

interface PricingOptionsProps {
  options: PricingOption[];
  selectedInterval: 'month' | 'year';
  onIntervalChange: (interval: 'month' | 'year') => void;
}

const PricingOptions: React.FC<PricingOptionsProps> = ({
  options,
  selectedInterval,
  onIntervalChange
}) => {
  if (options.length <= 1) return null;

  return (
    <div className="space-y-3">
      <h4 className="font-medium">Choose your billing interval:</h4>
      <div className="grid gap-2">
        {options.map((option) => (
          <Button
            key={option.value}
            variant={selectedInterval === option.value ? "default" : "outline"}
            className="justify-between h-auto p-4"
            onClick={() => onIntervalChange(option.value)}
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
  );
};

export default PricingOptions;
