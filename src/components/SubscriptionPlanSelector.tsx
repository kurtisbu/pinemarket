
import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface SubscriptionPlanSelectorProps {
  monthlyPrice: string;
  onMonthlyPriceChange: (price: string) => void;
  yearlyPrice: string;
  onYearlyPriceChange: (price: string) => void;
  interval: string;
  onIntervalChange: (interval: string) => void;
  trialPeriodDays: number;
  onTrialPeriodChange: (days: number) => void;
}

const SubscriptionPlanSelector: React.FC<SubscriptionPlanSelectorProps> = ({
  monthlyPrice,
  onMonthlyPriceChange,
  yearlyPrice,
  onYearlyPriceChange,
  interval,
  onIntervalChange,
  trialPeriodDays,
  onTrialPeriodChange,
}) => {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="billing-interval">Billing Interval *</Label>
        <Select value={interval} onValueChange={onIntervalChange} required>
          <SelectTrigger>
            <SelectValue placeholder="Select billing interval" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="month">Monthly</SelectItem>
            <SelectItem value="year">Yearly</SelectItem>
            <SelectItem value="both">Both Monthly and Yearly</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(interval === 'month' || interval === 'both') && (
        <div className="space-y-2">
          <Label htmlFor="monthly-price">Monthly Price (USD) *</Label>
          <Input
            id="monthly-price"
            type="number"
            step="0.01"
            min="0"
            value={monthlyPrice}
            onChange={(e) => onMonthlyPriceChange(e.target.value)}
            placeholder="9.99"
            required
          />
        </div>
      )}

      {(interval === 'year' || interval === 'both') && (
        <div className="space-y-2">
          <Label htmlFor="yearly-price">Yearly Price (USD) *</Label>
          <Input
            id="yearly-price"
            type="number"
            step="0.01"
            min="0"
            value={yearlyPrice}
            onChange={(e) => onYearlyPriceChange(e.target.value)}
            placeholder="99.99"
            required
          />
          {interval === 'both' && monthlyPrice && (
            <p className="text-sm text-muted-foreground">
              Monthly equivalent: ${(parseFloat(yearlyPrice) / 12).toFixed(2)}/month
              {parseFloat(yearlyPrice) < parseFloat(monthlyPrice) * 12 && 
                ` (Save ${(parseFloat(monthlyPrice) * 12 - parseFloat(yearlyPrice)).toFixed(2)} per year)`
              }
            </p>
          )}
        </div>
      )}

      {interval && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Subscription Summary</CardTitle>
            <CardDescription>Your subscription pricing options</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(interval === 'month' || interval === 'both') && monthlyPrice && (
                <div className="flex justify-between">
                  <span>Monthly:</span>
                  <span className="font-medium">${monthlyPrice}/month</span>
                </div>
              )}
              {(interval === 'year' || interval === 'both') && yearlyPrice && (
                <div className="flex justify-between">
                  <span>Yearly:</span>
                  <span className="font-medium">${yearlyPrice}/year</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        <Label htmlFor="trial-period">Free Trial Period (days)</Label>
        <Input
          id="trial-period"
          type="number"
          min="0"
          max="30"
          value={trialPeriodDays}
          onChange={(e) => onTrialPeriodChange(parseInt(e.target.value) || 0)}
          placeholder="0"
        />
        <p className="text-sm text-muted-foreground">
          Set to 0 for no free trial. Maximum 30 days.
        </p>
      </div>
    </div>
  );
};

export default SubscriptionPlanSelector;
