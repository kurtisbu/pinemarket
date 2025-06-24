
import React from 'react';
import { Check } from 'lucide-react';

interface FeaturesListProps {
  features: string[];
}

const FeaturesList: React.FC<FeaturesListProps> = ({ features }) => {
  if (features.length === 0) return null;

  return (
    <div className="space-y-3">
      <h4 className="font-medium">What's included:</h4>
      <ul className="space-y-2">
        {features.map((feature, index) => (
          <li key={index} className="flex items-center gap-2 text-sm">
            <Check className="w-4 h-4 text-primary flex-shrink-0" />
            {feature}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default FeaturesList;
