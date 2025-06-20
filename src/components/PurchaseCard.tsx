
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShoppingCart, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface PurchaseCardProps {
  price: number;
  programId: string;
  sellerId: string;
}

const PurchaseCard: React.FC<PurchaseCardProps> = ({ price, programId, sellerId }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [tradingviewUsername, setTradingviewUsername] = useState('');

  // Calculate fees for display
  const serviceFee = Math.round(price * 0.05 * 100) / 100; // 5% service fee
  const totalPrice = price + serviceFee;

  const handlePurchase = async () => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please log in to purchase this script.',
        variant: 'destructive',
      });
      navigate('/auth');
      return;
    }

    if (user.id === sellerId) {
      toast({
        title: 'Cannot purchase',
        description: 'You cannot purchase your own script.',
        variant: 'destructive',
      });
      return;
    }

    if (!tradingviewUsername.trim()) {
      toast({
        title: 'TradingView username required',
        description: 'Please enter your TradingView username to receive script access.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Create payment intent with TradingView username
      const { data, error } = await supabase.functions.invoke('stripe-connect', {
        body: {
          action: 'create-payment-intent',
          program_id: programId,
          amount: price, // Original price (before service fee)
          tradingview_username: tradingviewUsername.trim(),
        },
      });

      if (error) throw error;

      // In a real implementation, you would integrate with Stripe Elements
      // For now, we'll simulate the payment process
      const confirmPayment = confirm(
        `This will charge $${totalPrice.toFixed(2)} (including $${serviceFee.toFixed(2)} service fee) to your payment method and grant access to TradingView username "${tradingviewUsername}". Continue?`
      );

      if (confirmPayment) {
        // Simulate successful payment
        const { data: confirmData, error: confirmError } = await supabase.functions.invoke('stripe-connect', {
          body: {
            action: 'confirm-purchase',
            payment_intent_id: data.payment_intent_id,
            program_id: programId,
            tradingview_username: tradingviewUsername.trim(),
          },
        });

        if (confirmError) throw confirmError;

        toast({
          title: 'Purchase successful!',
          description: 'Your script access is being processed. You will receive TradingView access shortly.',
        });

        // Refresh the page or redirect to purchases
        window.location.reload();
      }
    } catch (error: any) {
      toast({
        title: 'Purchase failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="text-center mb-6">
          <div className="text-3xl font-bold text-green-600 mb-2">
            ${price}
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <div>Script Price: ${price.toFixed(2)}</div>
            <div>Service Fee (5%): ${serviceFee.toFixed(2)}</div>
            <div className="border-t pt-1 font-semibold">
              Total: ${totalPrice.toFixed(2)}
            </div>
            <p className="text-xs">One-time purchase</p>
          </div>
        </div>
        
        <div className="space-y-4 mb-6">
          <div>
            <Label htmlFor="tradingview-username">TradingView Username</Label>
            <Input
              id="tradingview-username"
              placeholder="Enter your TradingView username"
              value={tradingviewUsername}
              onChange={(e) => setTradingviewUsername(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Required to grant you access to the script
            </p>
          </div>
        </div>
        
        <Button 
          className="w-full mb-4 bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600"
          onClick={handlePurchase}
          disabled={loading || !tradingviewUsername.trim()}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <ShoppingCart className="w-4 h-4 mr-2" />
          )}
          {loading ? 'Processing...' : `Buy Now - $${totalPrice.toFixed(2)}`}
        </Button>
        
        <Button variant="outline" className="w-full" disabled={loading}>
          Add to Cart
        </Button>
      </CardContent>
    </Card>
  );
};

export default PurchaseCard;
