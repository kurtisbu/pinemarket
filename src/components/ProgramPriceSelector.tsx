import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';

const BUYER_FEE_PERCENT = 5; // Must mirror BUYER_FEE_PERCENT in supabase/functions/create-checkout/stripeEnsure.ts

interface PriceOption {
  id: string;
  price_type: 'one_time' | 'recurring';
  amount: number;
  interval?: string;
  display_name: string;
  description?: string;
}

interface ProgramPriceSelectorProps {
  programId: string;
  onPurchase?: () => void;
  trialPeriodDays?: number;
}

export const ProgramPriceSelector = ({ programId, onPurchase, trialPeriodDays }: ProgramPriceSelectorProps) => {
  const [prices, setPrices] = useState<PriceOption[]>([]);
  const [selectedPriceId, setSelectedPriceId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchPrices();
  }, [programId]);

  const fetchPrices = async () => {
    try {
      const { data, error } = await supabase
        .from('program_prices')
        .select('*')
        .eq('program_id', programId)
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;

      const formattedPrices = (data || []).map(p => ({
        id: p.id,
        price_type: p.price_type as 'one_time' | 'recurring',
        amount: p.amount,
        interval: p.interval,
        display_name: p.display_name,
        description: p.description,
      }));

      setPrices(formattedPrices);
      if (formattedPrices.length > 0) {
        setSelectedPriceId(formattedPrices[0].id);
      }
    } catch (error: any) {
      console.error('Error fetching prices:', error);
      toast({
        title: 'Error loading prices',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!selectedPriceId) {
      toast({ title: 'Please select a pricing option', variant: 'destructive' });
      return;
    }

    setPurchasing(true);

    try {
      const successUrl = `${window.location.origin}/my-purchases?success=true`;
      const cancelUrl = `${window.location.origin}/program/${programId}`;

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId: selectedPriceId, successUrl, cancelUrl },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      const errorMessage = error.message || 'An unexpected error occurred';
      const isTradingViewError = errorMessage.toLowerCase().includes('tradingview username');

      toast({
        title: isTradingViewError ? 'Profile Setup Required' : 'Checkout failed',
        description: isTradingViewError
          ? 'Please add your TradingView username to your profile before purchasing. Go to Profile Settings to update it.'
          : errorMessage,
        variant: 'destructive',
      });
      setPurchasing(false);
    }
  };

  const getIntervalLabel = (interval?: string) => {
    switch (interval) {
      case 'month': return '/month';
      case '3_months': return '/3 months';
      case 'year': return '/year';
      default: return '';
    }
  };

  const selectedPrice = prices.find(p => p.id === selectedPriceId);
  const showTrialOnButton = trialPeriodDays && selectedPrice?.price_type === 'recurring';

  const buyerFee = selectedPrice ? Math.round(selectedPrice.amount * BUYER_FEE_PERCENT) / 100 : 0;
  const totalDue = selectedPrice ? Math.round((selectedPrice.amount + buyerFee) * 100) / 100 : 0;

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      </Card>
    );
  }

  if (prices.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-center text-muted-foreground">No pricing options available</p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Select Your Plan</h3>

        <RadioGroup value={selectedPriceId} onValueChange={setSelectedPriceId}>
          {prices.map((price) => (
            <div
              key={price.id}
              className="flex items-center space-x-3 p-4 border rounded-lg hover:border-primary cursor-pointer"
              onClick={() => setSelectedPriceId(price.id)}
            >
              <RadioGroupItem value={price.id} id={price.id} />
              <Label htmlFor={price.id} className="flex-1 cursor-pointer">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{price.display_name}</p>
                    {price.description && (
                      <p className="text-sm text-muted-foreground">{price.description}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">
                      ${price.amount}
                      {price.price_type === 'recurring' && (
                        <span className="text-sm font-normal text-muted-foreground">
                          {getIntervalLabel(price.interval)}
                        </span>
                      )}
                    </p>
                    <div className="flex items-center gap-1 justify-end mt-1">
                      <Badge variant={price.price_type === 'recurring' ? 'default' : 'secondary'}>
                        {price.price_type === 'recurring' ? 'Subscription' : 'One-time'}
                      </Badge>
                      {trialPeriodDays && price.price_type === 'recurring' && (
                        <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50">
                          {trialPeriodDays}-day free trial
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </Label>
            </div>
          ))}
        </RadioGroup>

        {selectedPrice && (
          <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>${selectedPrice.amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Platform fee ({BUYER_FEE_PERCENT}%)</span>
              <span>${buyerFee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-semibold pt-1 border-t">
              <span>Total due today{showTrialOnButton ? ' after trial' : ''}</span>
              <span>
                ${totalDue.toFixed(2)}
                {selectedPrice.price_type === 'recurring' && (
                  <span className="text-xs font-normal text-muted-foreground ml-1">
                    {getIntervalLabel(selectedPrice.interval)}
                  </span>
                )}
              </span>
            </div>
          </div>
        )}

        <Button
          onClick={handlePurchase}
          disabled={purchasing || !selectedPriceId}
          className="w-full"
          size="lg"
        >
          {purchasing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : showTrialOnButton ? (
            `Start ${trialPeriodDays}-Day Free Trial`
          ) : (
            'Continue to Checkout'
          )}
        </Button>
      </div>
    </Card>
  );
};
