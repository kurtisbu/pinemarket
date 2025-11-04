import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, DollarSign, Calendar, CheckCircle2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const SellerPayoutSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [balance, setBalance] = useState<any>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [payoutInfo, setPayoutInfo] = useState({
    payout_method: 'bank_transfer',
    bank_account_holder_name: '',
    bank_account_number: '',
    bank_routing_number: '',
    bank_name: '',
    paypal_email: '',
    country: 'US',
    currency: 'USD'
  });

  useEffect(() => {
    if (user) {
      fetchPayoutInfo();
      fetchBalance();
    }
  }, [user]);

  const fetchPayoutInfo = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('seller_payout_info')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setPayoutInfo({
          payout_method: data.payout_method,
          bank_account_holder_name: data.bank_account_holder_name || '',
          bank_account_number: data.bank_account_number || '',
          bank_routing_number: data.bank_routing_number || '',
          bank_name: data.bank_name || '',
          paypal_email: data.paypal_email || '',
          country: data.country,
          currency: data.currency
        });
        setIsVerified(data.is_verified || false);
      }
    } catch (error: any) {
      console.error('Error fetching payout info:', error);
      toast({
        title: 'Error',
        description: 'Failed to load payout information',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchBalance = async () => {
    try {
      const { data, error } = await supabase
        .from('seller_balances')
        .select('*')
        .eq('seller_id', user?.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      setBalance(data);
    } catch (error: any) {
      console.error('Error fetching balance:', error);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('seller_payout_info')
        .upsert({
          user_id: user.id,
          ...payoutInfo,
          is_verified: false // Requires admin verification
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Payout information saved. Awaiting admin verification.'
      });

      fetchPayoutInfo();
    } catch (error: any) {
      console.error('Error saving payout info:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save payout information',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Balance Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Your Balance
          </CardTitle>
          <CardDescription>
            Earnings from your program sales
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Available Balance</p>
              <p className="text-3xl font-bold text-primary">
                ${balance?.available_balance?.toFixed(2) || '0.00'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Ready for payout</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending Balance</p>
              <p className="text-3xl font-bold">
                ${balance?.pending_balance?.toFixed(2) || '0.00'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Clearing (7 days)</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Earned</p>
              <p className="text-3xl font-bold text-accent">
                ${balance?.total_earned?.toFixed(2) || '0.00'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">All time</p>
            </div>
          </div>
          
          {balance?.last_payout_at && (
            <div className="mt-4 pt-4 border-t flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              Last payout: {new Date(balance.last_payout_at).toLocaleDateString()}
            </div>
          )}

          <Alert className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Payouts are processed weekly on Fridays. Minimum payout amount is $50. 
              Sales clear after 7 days before becoming available for payout.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Payout Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Payout Information</span>
            {isVerified ? (
              <div className="flex items-center gap-2 text-green-600 text-sm font-normal">
                <CheckCircle2 className="h-4 w-4" />
                Verified
              </div>
            ) : (
              <div className="flex items-center gap-2 text-yellow-600 text-sm font-normal">
                <AlertCircle className="h-4 w-4" />
                Pending Verification
              </div>
            )}
          </CardTitle>
          <CardDescription>
            Configure how you receive payments
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isVerified && (
            <Alert variant="default" className="border-yellow-500 bg-yellow-50">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                Your bank account information is pending admin verification. Payouts cannot be processed until your account is verified.
              </AlertDescription>
            </Alert>
          )}
          
          {isVerified && (
            <Alert variant="default" className="border-green-500 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Your bank account has been verified. You're eligible to receive payouts.
              </AlertDescription>
            </Alert>
          )}

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Payouts are processed weekly on Fridays. Minimum payout amount is $50. 
              Sales clear after 7 days before becoming available for payout.
            </AlertDescription>
          </Alert>
          <div className="space-y-2">
            <Label htmlFor="payout_method">Payout Method</Label>
            <Select 
              value={payoutInfo.payout_method} 
              onValueChange={(value) => setPayoutInfo({ ...payoutInfo, payout_method: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank_transfer">Bank Transfer (ACH)</SelectItem>
                <SelectItem value="paypal">PayPal (Coming Soon)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {payoutInfo.payout_method === 'bank_transfer' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="bank_account_holder_name">Account Holder Name</Label>
                <Input
                  id="bank_account_holder_name"
                  value={payoutInfo.bank_account_holder_name}
                  onChange={(e) => setPayoutInfo({ ...payoutInfo, bank_account_holder_name: e.target.value })}
                  placeholder="John Doe"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bank_name">Bank Name</Label>
                <Input
                  id="bank_name"
                  value={payoutInfo.bank_name}
                  onChange={(e) => setPayoutInfo({ ...payoutInfo, bank_name: e.target.value })}
                  placeholder="Chase Bank"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bank_routing_number">Routing Number</Label>
                  <Input
                    id="bank_routing_number"
                    value={payoutInfo.bank_routing_number}
                    onChange={(e) => setPayoutInfo({ ...payoutInfo, bank_routing_number: e.target.value })}
                    placeholder="123456789"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bank_account_number">Account Number</Label>
                  <Input
                    id="bank_account_number"
                    type="password"
                    value={payoutInfo.bank_account_number}
                    onChange={(e) => setPayoutInfo({ ...payoutInfo, bank_account_number: e.target.value })}
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </>
          )}

          {payoutInfo.payout_method === 'paypal' && (
            <div className="space-y-2">
              <Label htmlFor="paypal_email">PayPal Email</Label>
              <Input
                id="paypal_email"
                type="email"
                value={payoutInfo.paypal_email}
                onChange={(e) => setPayoutInfo({ ...payoutInfo, paypal_email: e.target.value })}
                placeholder="seller@example.com"
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Select 
                value={payoutInfo.country} 
                onValueChange={(value) => setPayoutInfo({ ...payoutInfo, country: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="US">United States</SelectItem>
                  <SelectItem value="CA">Canada</SelectItem>
                  <SelectItem value="GB">United Kingdom</SelectItem>
                  <SelectItem value="AU">Australia</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select 
                value={payoutInfo.currency} 
                onValueChange={(value) => setPayoutInfo({ ...payoutInfo, currency: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="CAD">CAD (C$)</SelectItem>
                  <SelectItem value="GBP">GBP (£)</SelectItem>
                  <SelectItem value="AUD">AUD (A$)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button 
            onClick={handleSave} 
            disabled={saving}
            className="w-full"
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Payout Information
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};