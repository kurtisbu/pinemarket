
import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, RefreshCw } from 'lucide-react';
import { useRateLimit } from '@/hooks/useRateLimit';

interface RateLimitGuardProps {
  endpoint: string;
  children: React.ReactNode;
  onRateLimited?: () => void;
  showRetryButton?: boolean;
}

const RateLimitGuard: React.FC<RateLimitGuardProps> = ({
  endpoint,
  children,
  onRateLimited,
  showRetryButton = true
}) => {
  const { checkRateLimit } = useRateLimit();
  const [rateLimitStatus, setRateLimitStatus] = useState<any>(null);
  const [checking, setChecking] = useState(false);

  const checkLimit = async () => {
    setChecking(true);
    const result = await checkRateLimit(endpoint);
    setRateLimitStatus(result);
    
    if (result && !result.allowed && onRateLimited) {
      onRateLimited();
    }
    
    setChecking(false);
  };

  const handleRetry = () => {
    checkLimit();
  };

  useEffect(() => {
    checkLimit();
  }, [endpoint]);

  if (checking) {
    return (
      <div className="flex items-center justify-center p-4">
        <RefreshCw className="w-4 h-4 animate-spin mr-2" />
        <span>Checking rate limit...</span>
      </div>
    );
  }

  if (rateLimitStatus && !rateLimitStatus.allowed) {
    const resetTime = new Date(rateLimitStatus.reset_time);
    const timeUntilReset = Math.ceil((resetTime.getTime() - Date.now()) / 1000 / 60);

    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="space-y-3">
          <div>
            <strong>Rate limit exceeded for {endpoint}</strong>
          </div>
          <div className="text-sm">
            You have made {rateLimitStatus.current_count} requests out of {rateLimitStatus.limit} allowed.
            Rate limit resets in approximately {timeUntilReset} minutes.
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            Reset time: {resetTime.toLocaleTimeString()}
          </div>
          {showRetryButton && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRetry}
              className="mt-2"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Check Again
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  return <>{children}</>;
};

export default RateLimitGuard;
