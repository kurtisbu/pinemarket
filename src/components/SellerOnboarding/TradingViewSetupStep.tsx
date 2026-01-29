
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowRight } from 'lucide-react';

interface TradingViewSetupStepProps {
  username: string;
  onUsernameChange: (username: string) => void;
  onNext: () => void;
  onBack: () => void;
}

const TradingViewSetupStep: React.FC<TradingViewSetupStepProps> = ({
  username,
  onUsernameChange,
  onNext,
  onBack
}) => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold mb-2">TradingView Account Setup</h2>
        <p className="text-muted-foreground">
          First, let's get your TradingView username.
        </p>
      </div>
      <div className="space-y-4">
        <div>
          <Label htmlFor="username">TradingView Username</Label>
          <Input
            id="username"
            value={username}
            onChange={(e) => onUsernameChange(e.target.value)}
            placeholder="Enter your exact TradingView username"
          />
          <p className="text-xs text-muted-foreground mt-1">
            This must match exactly with your TradingView profile username
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button 
          variant="outline" 
          onClick={onBack}
          className="flex-1"
        >
          Back
        </Button>
        <Button 
          onClick={onNext}
          disabled={!username.trim()}
          className="flex-1"
        >
          Next <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
};

export default TradingViewSetupStep;
