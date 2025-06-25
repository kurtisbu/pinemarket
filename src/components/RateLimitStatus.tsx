
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock, Shield, AlertTriangle } from 'lucide-react';
import { useRateLimit } from '@/hooks/useRateLimit';

interface RateLimitStatusProps {
  endpoint: string;
  showDetails?: boolean;
  compact?: boolean;
}

const RateLimitStatus: React.FC<RateLimitStatusProps> = ({ 
  endpoint, 
  showDetails = false,
  compact = false 
}) => {
  const { checkRateLimit, configs } = useRateLimit();
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const loadStatus = async () => {
    setLoading(true);
    const result = await checkRateLimit(endpoint);
    setStatus(result);
    setLoading(false);
  };

  useEffect(() => {
    if (showDetails) {
      loadStatus();
    }
  }, [endpoint, showDetails]);

  const config = configs.find(c => c.endpoint === endpoint);
  
  if (!showDetails && !status) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Shield className="w-4 h-4 animate-spin" />
        <span>Checking rate limit...</span>
      </div>
    );
  }

  if (!status) {
    return null;
  }

  const usagePercentage = (status.current_count / status.limit) * 100;
  const isNearLimit = usagePercentage > 80;
  const isAtLimit = !status.allowed;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant={isAtLimit ? "destructive" : isNearLimit ? "secondary" : "default"}>
          {status.remaining}/{status.limit}
        </Badge>
        {isAtLimit && (
          <span className="text-xs text-red-600">Rate Limited</span>
        )}
      </div>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Shield className="w-4 h-4" />
          Rate Limit Status - {endpoint}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isAtLimit && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Rate limit exceeded. Please wait before making more requests.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Usage</span>
            <span>{status.current_count}/{status.limit} requests</span>
          </div>
          <Progress 
            value={usagePercentage} 
            className={`h-2 ${isAtLimit ? 'bg-red-100' : isNearLimit ? 'bg-yellow-100' : 'bg-green-100'}`}
          />
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <div className="text-muted-foreground">Remaining</div>
            <div className="font-medium">{status.remaining}</div>
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground">Reset Time</div>
            <div className="font-medium flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(status.reset_time).toLocaleTimeString()}
            </div>
          </div>
        </div>

        {config && (
          <div className="pt-2 border-t">
            <div className="text-xs text-muted-foreground space-y-1">
              <div>Hourly Limit: {config.requests_per_hour}</div>
              <div>Per Minute: {config.requests_per_minute}</div>
              <div>Burst Limit: {config.burst_limit}</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RateLimitStatus;
