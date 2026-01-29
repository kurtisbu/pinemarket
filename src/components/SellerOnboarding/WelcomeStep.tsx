
import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

interface WelcomeStepProps {
  onNext: () => void;
}

const WelcomeStep: React.FC<WelcomeStepProps> = ({ onNext }) => {
  return (
    <div className="text-center space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Welcome to PineMarket!</h2>
        <p className="text-muted-foreground">
          Your access has been verified. Let's get you set up to start selling your TradingView Pine Scripts.
        </p>
      </div>
      <div className="bg-muted/50 p-4 rounded-lg text-left">
        <h3 className="font-semibold mb-2">What you'll need:</h3>
        <ul className="space-y-2 text-sm">
          <li>• Your TradingView username</li>
          <li>• Access to your TradingView session cookies</li>
          <li>• Published Pine Scripts on TradingView</li>
        </ul>
      </div>
      <Button onClick={onNext} className="w-full">
        Get Started <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
    </div>
  );
};

export default WelcomeStep;
