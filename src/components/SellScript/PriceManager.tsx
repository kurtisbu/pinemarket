import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { X, Plus } from 'lucide-react';

export interface PriceObject {
  id: string;
  price_type: 'one_time' | 'recurring';
  amount: string;
  interval?: 'month' | '3_months' | 'year';
  display_name: string;
  description?: string;
}

interface PriceManagerProps {
  prices: PriceObject[];
  onPricesChange: (prices: PriceObject[]) => void;
}

export const PriceManager = ({ prices, onPricesChange }: PriceManagerProps) => {
  const addPrice = () => {
    const newPrice: PriceObject = {
      id: crypto.randomUUID(),
      price_type: 'one_time',
      amount: '',
      display_name: '',
    };
    onPricesChange([...prices, newPrice]);
  };

  const removePrice = (id: string) => {
    onPricesChange(prices.filter(p => p.id !== id));
  };

  const updatePrice = (id: string, updates: Partial<PriceObject>) => {
    onPricesChange(
      prices.map(p => 
        p.id === id ? { ...p, ...updates } : p
      )
    );
  };

  const getIntervalLabel = (interval?: string) => {
    switch (interval) {
      case 'month': return 'per month';
      case '3_months': return 'per 3 months';
      case 'year': return 'per year';
      default: return '';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-lg">Pricing Options</Label>
        <Button type="button" onClick={addPrice} variant="outline" size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Price Option
        </Button>
      </div>

      {prices.length === 0 && (
        <Card className="p-6 text-center text-muted-foreground">
          No pricing options added yet. Click "Add Price Option" to create one.
        </Card>
      )}

      {prices.map((price, index) => (
        <Card key={price.id} className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Price Option {index + 1}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removePrice(price.id)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Display Name *</Label>
              <Input
                placeholder="e.g., Monthly Access, Lifetime Access"
                value={price.display_name}
                onChange={(e) => updatePrice(price.id, { display_name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Price Type *</Label>
              <Select
                value={price.price_type}
                onValueChange={(value: 'one_time' | 'recurring') => {
                  const updates: Partial<PriceObject> = { price_type: value };
                  if (value === 'one_time') {
                    updates.interval = undefined;
                  } else if (!price.interval) {
                    updates.interval = 'month';
                  }
                  updatePrice(price.id, updates);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="one_time">One-time Payment</SelectItem>
                  <SelectItem value="recurring">Recurring Payment</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {price.price_type === 'recurring' && (
              <div className="space-y-2">
                <Label>Billing Interval *</Label>
                <Select
                  value={price.interval}
                  onValueChange={(value: 'month' | '3_months' | 'year') =>
                    updatePrice(price.id, { interval: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">Monthly</SelectItem>
                    <SelectItem value="3_months">Every 3 Months</SelectItem>
                    <SelectItem value="year">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Price ($) *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={price.amount}
                onChange={(e) => updatePrice(price.id, { amount: e.target.value })}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Description (optional)</Label>
              <Input
                placeholder="Additional details about this pricing option"
                value={price.description || ''}
                onChange={(e) => updatePrice(price.id, { description: e.target.value })}
              />
            </div>
          </div>

          {price.display_name && price.amount && (
            <div className="pt-2 border-t text-sm text-muted-foreground">
              Preview: <span className="font-medium">{price.display_name}</span> - 
              <span className="font-semibold text-foreground"> ${price.amount}</span>
              {price.price_type === 'recurring' && price.interval && (
                <span> {getIntervalLabel(price.interval)}</span>
              )}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
};
