
import React from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';

interface CompleteStepProps {
  onComplete: () => void;
}

const CompleteStep: React.FC<CompleteStepProps> = ({ onComplete }) => {
  return (
    <div className="text-center space-y-6">
      <div className="space-y-2">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
        <h2 className="text-2xl font-bold">Setup Complete!</h2>
        <p className="text-muted-foreground">
          Your TradingView account is connected and your scripts have been synced.
        </p>
      </div>
      <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
        <h3 className="font-semibold mb-2">What's next?</h3>
        <ul className="text-sm space-y-1 text-left">
          <li>• Create program listings from your synced scripts</li>
          <li>• Set up your Stripe account to receive payments</li>
          <li>• Start selling your Pine Scripts!</li>
        </ul>
      </div>
      <Button onClick={onComplete} className="w-full">
        Go to Dashboard
      </Button>
    </div>
  );
};

export default CompleteStep;
