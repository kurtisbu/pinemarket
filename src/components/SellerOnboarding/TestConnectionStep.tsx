
import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowRight } from 'lucide-react';

interface TestConnectionStepProps {
  username: string;
  loading: boolean;
  onTestConnection: () => void;
  onBack: () => void;
}

const TestConnectionStep: React.FC<TestConnectionStepProps> = ({
  username,
  loading,
  onTestConnection,
  onBack
}) => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold mb-2">Test & Sync</h2>
        <p className="text-muted-foreground">
          Let's verify your connection and sync your scripts.
        </p>
      </div>

      <div className="bg-muted/50 p-4 rounded-lg">
        <h3 className="font-semibold mb-2">Connection Details:</h3>
        <div className="space-y-1 text-sm">
          <div>Username: <span className="font-mono">{username}</span></div>
          <div>Session Cookie: <span className="text-green-600">✓ Provided</span></div>
          <div>Signed Cookie: <span className="text-green-600">✓ Provided</span></div>
        </div>
      </div>

      <Button 
        onClick={onTestConnection}
        disabled={loading}
        className="w-full"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Testing Connection...
          </>
        ) : (
          <>
            Test Connection & Sync Scripts
            <ArrowRight className="w-4 h-4 ml-2" />
          </>
        )}
      </Button>

      <div className="flex">
        <Button 
          variant="outline" 
          onClick={onBack}
          disabled={loading}
          className="flex-1"
        >
          Back
        </Button>
      </div>
    </div>
  );
};

export default TestConnectionStep;
