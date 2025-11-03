import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';

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
}

export const ProgramPriceSelector = ({ programId, onPurchase }: ProgramPriceSelectorProps) => {
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
      toast({
        title: 'Please select a pricing option',
        variant: 'destructive',
      });
      return;
    }

    setPurchasing(true);

    try {
      const successUrl = `${window.location.origin}/my-purchases?success=true`;
      const cancelUrl = `${window.location.origin}/program/${programId}`;

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          priceId: selectedPriceId,
          successUrl,
          cancelUrl,
        },
      });

      if (error) throw error;

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast({
        title: 'Checkout failed',
        description: error.message,
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
        <p className="text-center text-muted-foreground">
          No pricing options available
        </p>
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
                    <Badge variant={price.price_type === 'recurring' ? 'default' : 'secondary'}>
                      {price.price_type === 'recurring' ? 'Subscription' : 'One-time'}
                    </Badge>
                  </div>
                </div>
              </Label>
            </div>
          ))}
        </RadioGroup>

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
          ) : (
            'Continue to Checkout'
          )}
        </Button>
      </div>
    </Card>
  );
};
