
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface TradingViewConnectionStatusProps {
  isConnected: boolean;
  connectionStatus?: string;
  lastValidatedAt?: string;
  lastError?: string;
  showDetails?: boolean;
}

const TradingViewConnectionStatus: React.FC<TradingViewConnectionStatusProps> = ({
  isConnected,
  connectionStatus = 'active',
  lastValidatedAt,
  lastError,
  showDetails = false
}) => {
  const getStatusIcon = () => {
    if (!isConnected) return <XCircle className="w-4 h-4" />;
    
    switch (connectionStatus) {
      case 'active':
        return <CheckCircle className="w-4 h-4" />;
      case 'expired':
        return <AlertTriangle className="w-4 h-4" />;
      case 'error':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusVariant = () => {
    if (!isConnected) return 'destructive';
    
    switch (connectionStatus) {
      case 'active':
        return 'default';
      case 'expired':
        return 'destructive';
      case 'error':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getStatusText = () => {
    if (!isConnected) return 'Not Connected';
    
    switch (connectionStatus) {
      case 'active':
        return 'Connected';
      case 'expired':
        return 'Expired';
      case 'error':
        return 'Error';
      default:
        return 'Unknown Status';
    }
  };

  const getLastValidatedText = () => {
    if (!lastValidatedAt) return 'Never validated';
    
    const date = new Date(lastValidatedAt);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Validated recently';
    if (diffInHours < 24) return `Validated ${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `Validated ${diffInDays}d ago`;
  };

  const shouldShowWarning = () => {
    return connectionStatus === 'expired' || connectionStatus === 'error' || !isConnected;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {getStatusIcon()}
        <Badge variant={getStatusVariant()}>
          {getStatusText()}
        </Badge>
        {showDetails && (
          <span className="text-sm text-muted-foreground">
            {getLastValidatedText()}
          </span>
        )}
      </div>

      {shouldShowWarning() && showDetails && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {connectionStatus === 'expired' && (
              <>
                Your TradingView session has expired. Please update your cookies to re-enable script assignments.
                {lastError && <div className="mt-1 text-xs opacity-75">{lastError}</div>}
              </>
            )}
            {connectionStatus === 'error' && (
              <>
                There was an error with your TradingView connection. Please check your settings.
                {lastError && <div className="mt-1 text-xs opacity-75">{lastError}</div>}
              </>
            )}
            {!isConnected && (
              <>
                TradingView is not connected. Connect your account to enable automatic script assignments.
              </>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default TradingViewConnectionStatus;
