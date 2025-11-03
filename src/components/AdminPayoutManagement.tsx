import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, DollarSign, Play, RefreshCw, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const AdminPayoutManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [settling, setSettling] = useState(false);
  const [balances, setBalances] = useState<any[]>([]);
  const [recentPayouts, setRecentPayouts] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch seller balances
      const { data: balanceData, error: balanceError } = await supabase
        .from('seller_balances')
        .select(`
          *,
          profiles!seller_balances_seller_id_fkey (
            display_name,
            username
          ),
          seller_payout_info!seller_payout_info_user_id_fkey (
            payout_method,
            is_verified
          )
        `)
        .order('available_balance', { ascending: false });

      if (balanceError) throw balanceError;
      setBalances(balanceData || []);

      // Fetch recent payouts
      const { data: payoutData, error: payoutError } = await supabase
        .from('payouts')
        .select(`
          *,
          profiles!payouts_seller_id_fkey (
            display_name,
            username
          )
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      if (payoutError) throw payoutError;
      setRecentPayouts(payoutData || []);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load payout data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleManualPayout = async () => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-payouts');
      
      if (error) throw error;

      toast({
        title: 'Success',
        description: `Processed ${data.processed} payouts`
      });

      fetchData();
    } catch (error: any) {
      console.error('Error processing payouts:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to process payouts',
        variant: 'destructive'
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleManualSettle = async () => {
    setSettling(true);
    try {
      const { data, error } = await supabase.functions.invoke('settle-balances');
      
      if (error) throw error;

      toast({
        title: 'Success',
        description: `Settled ${data.settled} seller balances`
      });

      fetchData();
    } catch (error: any) {
      console.error('Error settling balances:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to settle balances',
        variant: 'destructive'
      });
    } finally {
      setSettling(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; icon: any }> = {
      completed: { variant: 'default', icon: CheckCircle2 },
      processing: { variant: 'secondary', icon: Clock },
      failed: { variant: 'destructive', icon: XCircle }
    };
    
    const config = variants[status] || variants.processing;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
    );
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

  const totalAvailable = balances.reduce((sum, b) => sum + (b.available_balance || 0), 0);
  const totalPending = balances.reduce((sum, b) => sum + (b.pending_balance || 0), 0);
  const eligibleForPayout = balances.filter(b => b.available_balance >= 50).length;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Available</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">${totalAvailable.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Ready for payout</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalPending.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Clearing period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Eligible Sellers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent">{eligibleForPayout}</div>
            <p className="text-xs text-muted-foreground mt-1">Above $50 threshold</p>
          </CardContent>
        </Card>
      </div>

      {/* Manual Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Manual Processing</CardTitle>
          <CardDescription>
            Manually trigger payout processing and balance settlement for testing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              <strong>Note:</strong> Automated jobs run daily (9 AM UTC for settlement) and weekly (Fridays 10 AM UTC for payouts).
              Use these controls for testing or emergency processing.
            </AlertDescription>
          </Alert>

          <div className="flex gap-4">
            <Button onClick={handleManualSettle} disabled={settling}>
              {settling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Settle Pending Balances
            </Button>

            <Button onClick={handleManualPayout} disabled={processing} variant="secondary">
              {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              Process Payouts Now
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Seller Balances */}
      <Card>
        <CardHeader>
          <CardTitle>Seller Balances</CardTitle>
          <CardDescription>Current balance status for all sellers</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Seller</TableHead>
                <TableHead className="text-right">Available</TableHead>
                <TableHead className="text-right">Pending</TableHead>
                <TableHead className="text-right">Total Earned</TableHead>
                <TableHead>Payout Method</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {balances.map((balance) => {
                const profile = Array.isArray(balance.profiles) ? balance.profiles[0] : balance.profiles;
                const payoutInfo = Array.isArray(balance.seller_payout_info) 
                  ? balance.seller_payout_info[0] 
                  : balance.seller_payout_info;

                return (
                  <TableRow key={balance.seller_id}>
                    <TableCell className="font-medium">
                      {profile?.display_name || profile?.username || 'Unknown'}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      ${balance.available_balance?.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      ${balance.pending_balance?.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      ${balance.total_earned?.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {payoutInfo?.payout_method || 'Not set'}
                    </TableCell>
                    <TableCell>
                      {payoutInfo?.is_verified ? (
                        <Badge variant="default">Verified</Badge>
                      ) : (
                        <Badge variant="secondary">Unverified</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recent Payouts */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Payouts</CardTitle>
          <CardDescription>Latest 20 payout transactions</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Seller</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Transfer ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentPayouts.map((payout) => {
                const profile = Array.isArray(payout.profiles) ? payout.profiles[0] : payout.profiles;
                
                return (
                  <TableRow key={payout.id}>
                    <TableCell>
                      {new Date(payout.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="font-medium">
                      {profile?.display_name || profile?.username || 'Unknown'}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      ${payout.amount?.toFixed(2)}
                    </TableCell>
                    <TableCell>{payout.payout_method}</TableCell>
                    <TableCell>{getStatusBadge(payout.status)}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {payout.stripe_transfer_id || '-'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
