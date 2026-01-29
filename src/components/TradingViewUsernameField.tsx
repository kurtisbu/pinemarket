
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface TradingViewUsernameFieldProps {
  value: string;
  onChange: (field: string, value: string) => void;
}

const TradingViewUsernameField: React.FC<TradingViewUsernameFieldProps> = ({
  value,
  onChange,
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>TradingView Username</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Label htmlFor="tradingview_username">TradingView Username</Label>
          <Input
            id="tradingview_username"
            value={value}
            onChange={(e) => onChange('tradingview_username', e.target.value)}
            placeholder="Your TradingView username"
          />
          <p className="text-sm text-muted-foreground">
            Set your TradingView username to automatically populate it when purchasing scripts.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default TradingViewUsernameField;
