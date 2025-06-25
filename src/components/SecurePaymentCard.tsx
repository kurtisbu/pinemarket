
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShoppingCart, Loader2, Shield, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { usePaymentSecurity } from '@/hooks/usePaymentSecurity';
import { useRateLimitedAction } from '@/hooks/useRateLimitedAction';
import PaymentSecurityValidator from './PaymentSecurityValidator';
import RateLimitStatus from './RateLimitStatus';
import RateLimitGuard from './RateLimitGuard';

interface SecurePaymentCardProps {
  price: number;
  programId: string;
  sellerId: string;
}

const SecurePaymentCard: React.FC<SecurePaymentCardProps> = ({ price, programId, sellerId }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { validatePayment, metrics } = usePaymentSecurity();
  const [loading, setLoading] = useState(false);
  const [tradingviewUsername, setTradingviewUsername] = useState('');
  const [securityValidation, setSecurityValidation] = useState<{
    isValid: boolean;
    checks: any[];
  }>({ isValid: false, checks: [] });

  // Rate limiting for payment actions
  const { executeAction: executePayment, loading: rateLimitLoading } = useRateLimitedAction({
    endpoint: 'payment',
    onRateLimited: () => {
      toast({
        title: 'Payment rate limit exceeded',
        description: 'You have made too many payment attempts. Please wait before trying again.',
        variant: 'destructive',
      });
    }
  });

  // Calculate fees for display
  const serviceFee = Math.round(price * 0.05 * 100) / 100; // 5% service fee
  const totalPrice = price + serviceFee;

  const handleSecurityValidation = (isValid: boolean, checks: any[]) => {
    setSecurityValidation({ isValid, checks });
  };

  const performSecurePurchase = async () => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please log in to purchase this script.',
        variant: 'destructive',
      });
      navigate('/auth');
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

    // Run security validation
    const validationResult = await validatePayment(price, sellerId, programId);
    
    if (!validationResult.isValid) {
      toast({
        title: 'Payment blocked',
        description: validationResult.blockedReasons.join(', '),
        variant: 'destructive',
      });
      return;
    }

    if (validationResult.warnings.length > 0) {
      const confirmed = confirm(
        `Security Warning:\n${validationResult.warnings.join('\n')}\n\nDo you want to continue?`
      );
      if (!confirmed) return;
    }

    setLoading(true);
    try {
      console.log('Creating secure payment intent...', { 
        programId, 
        price, 
        totalPrice,
        riskScore: validationResult.riskScore 
      });
      
      // Create payment intent with enhanced security
      const { data, error } = await supabase.functions.invoke('stripe-connect', {
        body: {
          action: 'create-payment-intent',
          program_id: programId,
          amount: price,
          tradingview_username: tradingviewUsername.trim(),
          security_validation: {
            risk_score: validationResult.riskScore,
            warnings: validationResult.warnings,
            user_metrics: metrics
          }
        },
      });

      if (error) {
        console.error('Secure payment intent creation error:', error);
        throw error;
      }

      console.log('Secure payment intent created:', data);

      // Enhanced confirmation with security details
      const confirmPayment = confirm(
        `Secure Purchase Confirmation:\n\n` +
        `Script Price: $${price.toFixed(2)}\n` +
        `Service Fee (5%): $${serviceFee.toFixed(2)}\n` +
        `Total Amount: $${totalPrice.toFixed(2)}\n\n` +
        `TradingView Username: ${tradingviewUsername}\n` +
        `Security Risk Score: ${validationResult.riskScore}/100\n\n` +
        `Your payment will be processed securely through Stripe.\n` +
        `Click OK to proceed with secure payment.`
      );

      if (confirmPayment) {
        console.log('Confirming secure purchase...', data.payment_intent_id);
        
        // Simulate successful payment with security logging
        const { data: confirmData, error: confirmError } = await supabase.functions.invoke('stripe-connect', {
          body: {
            action: 'confirm-purchase',
            payment_intent_id: data.payment_intent_id,
            program_id: programId,
            tradingview_username: tradingviewUsername.trim(),
            security_context: {
              risk_score: validationResult.riskScore,
              validation_checks: securityValidation.checks,
              user_agent: navigator.userAgent,
              timestamp: new Date().toISOString()
            }
          },
        });

        if (confirmError) {
          console.error('Secure purchase confirmation error:', confirmError);
          throw confirmError;
        }

        console.log('Secure purchase confirmed:', confirmData);

        toast({
          title: 'Secure purchase successful!',
          description: 'Your payment has been processed securely. Script access is being set up.',
        });

        // Clear the form
        setTradingviewUsername('');
        
        // Refresh the page after successful purchase
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } catch (error: any) {
      console.error('Secure purchase error:', error);
      toast({
        title: 'Secure purchase failed',
        description: error.message || 'An unexpected error occurred during secure payment processing.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSecurePurchase = () => {
    executePayment(performSecurePurchase);
  };

  return (
    <div className="space-y-6">
      {/* Rate Limit Guard */}
      <RateLimitGuard endpoint="payment">
        {/* Security Validation */}
        {user && (
          <PaymentSecurityValidator
            amount={price}
            buyerId={user.id}
            sellerId={sellerId}
            programId={programId}
            onValidationComplete={handleSecurityValidation}
          />
        )}

        {/* Rate Limit Status */}
        <RateLimitStatus endpoint="payment" showDetails compact />

        {/* Payment Card */}
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
                <p className="text-xs">One-time secure purchase</p>
              </div>
            </div>

            {/* Security Status */}
            {user && (
              <div className="mb-4 p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4" />
                  <span className="text-sm font-medium">Security Status</span>
                </div>
                {securityValidation.isValid ? (
                  <div className="text-xs text-green-600">
                    ✓ Payment security validation passed
                  </div>
                ) : (
                  <div className="text-xs text-red-600">
                    ⚠ Security validation required before purchase
                  </div>
                )}
              </div>
            )}
            
            <div className="space-y-4 mb-6">
              <div>
                <Label htmlFor="tradingview-username">TradingView Username</Label>
                <Input
                  id="tradingview-username"
                  placeholder="Enter your TradingView username"
                  value={tradingviewUsername}
                  onChange={(e) => setTradingviewUsername(e.target.value)}
                  disabled={loading || rateLimitLoading}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Required to grant you secure access to the script
                </p>
              </div>
            </div>
            
            <Button 
              className="w-full mb-4 bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600"
              onClick={handleSecurePurchase}
              disabled={loading || rateLimitLoading || !tradingviewUsername.trim() || !securityValidation.isValid}
            >
              {loading || rateLimitLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <>
                  <Shield className="w-4 h-4 mr-2" />
                  <ShoppingCart className="w-4 h-4 mr-2" />
                </>
              )}
              {loading || rateLimitLoading ? 'Processing Securely...' : `Secure Purchase - $${totalPrice.toFixed(2)}`}
            </Button>
            
            <div className="text-xs text-muted-foreground text-center">
              <p className="flex items-center justify-center gap-1">
                <Shield className="w-3 h-3" />
                Enhanced security protection powered by Stripe
              </p>
              <p className="mt-1">Advanced fraud detection and payment validation</p>
              <p className="mt-1">Rate limiting enabled for secure transactions</p>
            </div>
          </CardContent>
        </Card>
      </RateLimitGuard>
    </div>
  );
};

export default SecurePaymentCard;
