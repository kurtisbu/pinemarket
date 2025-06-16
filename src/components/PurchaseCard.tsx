
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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

    setLoading(true);
    try {
      // Create payment intent
      const { data, error } = await supabase.functions.invoke('stripe-connect', {
        body: {
          action: 'create-payment-intent',
          program_id: programId,
          amount: price,
        },
      });

      if (error) throw error;

      // In a real implementation, you would integrate with Stripe Elements
      // For now, we'll simulate the payment process
      const confirmPayment = confirm(
        `This will charge $${price} to your payment method. Continue?`
      );

      if (confirmPayment) {
        // Simulate successful payment
        const { data: confirmData, error: confirmError } = await supabase.functions.invoke('stripe-connect', {
          body: {
            action: 'confirm-purchase',
            payment_intent_id: data.payment_intent_id,
            program_id: programId,
          },
        });

        if (confirmError) throw confirmError;

        toast({
          title: 'Purchase successful!',
          description: 'Your script access has been granted. Check your email for details.',
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
          <p className="text-sm text-muted-foreground">One-time purchase</p>
        </div>
        
        <Button 
          className="w-full mb-4 bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600"
          onClick={handlePurchase}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <ShoppingCart className="w-4 h-4 mr-2" />
          )}
          {loading ? 'Processing...' : 'Buy Now'}
        </Button>
        
        <Button variant="outline" className="w-full" disabled={loading}>
          Add to Cart
        </Button>
      </CardContent>
    </Card>
  );
};

export default PurchaseCard;
