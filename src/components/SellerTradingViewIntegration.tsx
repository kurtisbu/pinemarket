
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

interface SellerTradingViewIntegrationProps {
  formData: {
    tradingview_session_cookie: string;
    tradingview_signed_session_cookie: string;
    is_tradingview_connected: boolean;
  };
  onInputChange: (field: string, value: string) => void;
  onTestConnection: () => void;
  loading: boolean;
  testingConnection: boolean;
}

const SellerTradingViewIntegration: React.FC<SellerTradingViewIntegrationProps> = ({
  formData,
  onInputChange,
  onTestConnection,
  loading,
  testingConnection,
}) => {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>TradingView Integration (Sellers Only)</CardTitle>
          <Badge variant={formData.is_tradingview_connected ? 'default' : 'destructive'}>
            {formData.is_tradingview_connected ? 'Connected' : 'Not Connected'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Connect your TradingView account to automate script assignments for your buyers.
          Your credentials will be securely stored. This is only required for sellers.
        </p>
        <div className="space-y-2">
          <Label htmlFor="session_cookie">Session Cookie (sessionid)</Label>
          <Input
            id="session_cookie"
            type="password"
            value={formData.tradingview_session_cookie}
            onChange={(e) => onInputChange('tradingview_session_cookie', e.target.value)}
            placeholder="Value is hidden for security"
            disabled={loading}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="signed_session_cookie">Signed Session Cookie (sessionid_sign)</Label>
          <Input
            id="signed_session_cookie"
            type="password"
            value={formData.tradingview_signed_session_cookie}
            onChange={(e) => onInputChange('tradingview_signed_session_cookie', e.target.value)}
            placeholder="Value is hidden for security"
            disabled={loading}
          />
        </div>
        <Button type="button" onClick={onTestConnection} variant="outline" disabled={loading || testingConnection}>
          {testingConnection ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {testingConnection ? 'Testing...' : 'Test & Save Connection'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default SellerTradingViewIntegration;
