import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, DollarSign, AlertCircle, CheckCircle, PlayCircle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SellerBalance {
  seller_id: string;
  available_balance: number;
  pending_balance: number;
  total_earned: number;
  last_payout_at: string | null;
  profiles: {
    display_name: string;
    username: string;
  };
  seller_payout_info: {
    is_verified: boolean;
    payout_method: string;
  }[];
}

interface Payout {
  id: string;
  seller_id: string;
  amount: number;
  status: string;
  payout_method: string;
  initiated_at: string;
  completed_at: string | null;
  failure_reason: string | null;
  profiles: {
    display_name: string;
    username: string;
  };
}

const AdminPayoutDashboard: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [triggeringPayout, setTriggeringPayout] = useState(false);
  const [settlingBalances, setSettlingBalances] = useState(false);
  const [eligibleSellers, setEligibleSellers] = useState<SellerBalance[]>([]);
  const [recentPayouts, setRecentPayouts] = useState<Payout[]>([]);
  const [failedPayouts, setFailedPayouts] = useState<Payout[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch sellers eligible for payout (>$50 available balance, verified)
      const { data: sellers, error: sellersError } = await supabase
        .from('seller_balances')
        .select('seller_id, available_balance, pending_balance, total_earned, last_payout_at')
        .gte('available_balance', 50);

      if (sellersError) throw sellersError;
      
      // Fetch profile and payout info for each seller
      const enrichedSellers: SellerBalance[] = [];
      for (const seller of sellers || []) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, username')
          .eq('id', seller.seller_id)
          .single();

        const { data: payoutInfo } = await supabase
          .from('seller_payout_info')
          .select('is_verified, payout_method')
          .eq('user_id', seller.seller_id)
          .single();

        if (payoutInfo?.is_verified) {
          enrichedSellers.push({
            ...seller,
            profiles: profile || { display_name: '', username: '' },
            seller_payout_info: [payoutInfo]
          });
        }
      }
      
      setEligibleSellers(enrichedSellers);

      // Fetch recent payouts (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: recent, error: recentError } = await supabase
        .from('payouts')
        .select('id, seller_id, amount, status, payout_method, initiated_at, completed_at, failure_reason')
        .gte('initiated_at', thirtyDaysAgo.toISOString())
        .order('initiated_at', { ascending: false })
        .limit(20);

      if (recentError) throw recentError;
      
      // Enrich with profile data
      const enrichedRecent: Payout[] = [];
      for (const payout of recent || []) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, username')
          .eq('id', payout.seller_id)
          .single();

        enrichedRecent.push({
          ...payout,
          profiles: profile || { display_name: '', username: '' }
        });
      }
      setRecentPayouts(enrichedRecent);

      // Fetch failed payouts
      const { data: failed, error: failedError } = await supabase
        .from('payouts')
        .select('id, seller_id, amount, status, payout_method, initiated_at, completed_at, failure_reason')
        .eq('status', 'failed')
        .order('initiated_at', { ascending: false })
        .limit(10);

      if (failedError) throw failedError;
      
      // Enrich with profile data
      const enrichedFailed: Payout[] = [];
      for (const payout of failed || []) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, username')
          .eq('id', payout.seller_id)
          .single();

        enrichedFailed.push({
          ...payout,
          profiles: profile || { display_name: '', username: '' }
        });
      }
      setFailedPayouts(enrichedFailed);

    } catch (error: any) {
      console.error('Error fetching payout data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load payout data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const triggerManualPayout = async () => {
    try {
      setTriggeringPayout(true);
      
      const { data, error } = await supabase.functions.invoke('process-payouts');
      
      if (error) throw error;

      toast({
        title: 'Payouts Triggered',
        description: `Processed ${data.processed || 0} payouts successfully`,
      });

      // Refresh data
      await fetchData();
    } catch (error: any) {
      console.error('Error triggering payouts:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to trigger payouts',
        variant: 'destructive',
      });
    } finally {
      setTriggeringPayout(false);
    }
  };

  const settleBalances = async () => {
    try {
      setSettlingBalances(true);
      
      const { data, error } = await supabase.functions.invoke('settle-balances');
      
      if (error) throw error;

      toast({
        title: 'Balances Settled',
        description: `Settled balances for ${data.settled || 0} sellers`,
      });

      // Refresh data
      await fetchData();
    } catch (error: any) {
      console.error('Error settling balances:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to settle balances',
        variant: 'destructive',
      });
    } finally {
      setSettlingBalances(false);
    }
  };

  const retryFailedPayout = async (payoutId: string) => {
    try {
      setProcessing(true);

      // Mark as processing again
      const { error } = await supabase
        .from('payouts')
        .update({ status: 'processing', failure_reason: null })
        .eq('id', payoutId);

      if (error) throw error;

      toast({
        title: 'Payout Queued',
        description: 'Payout has been queued for retry',
      });

      await fetchData();
    } catch (error: any) {
      console.error('Error retrying payout:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to retry payout',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'processing':
        return <Badge className="bg-blue-500"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Processing</Badge>;
      case 'failed':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action Buttons */}
      <div className="flex gap-4">
        <Button 
          onClick={triggerManualPayout}
          disabled={triggeringPayout || eligibleSellers.length === 0}
          className="flex-1"
        >
          {triggeringPayout ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing Payouts...
            </>
          ) : (
            <>
              <PlayCircle className="w-4 h-4 mr-2" />
              Trigger Manual Payout ({eligibleSellers.length})
            </>
          )}
        </Button>
        
        <Button 
          onClick={settleBalances}
          disabled={settlingBalances}
          variant="outline"
          className="flex-1"
        >
          {settlingBalances ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Settling...
            </>
          ) : (
            <>
              <DollarSign className="w-4 h-4 mr-2" />
              Settle Pending Balances
            </>
          )}
        </Button>
      </div>

      {/* Eligible Sellers */}
      <Card>
        <CardHeader>
          <CardTitle>Eligible for Payout</CardTitle>
          <CardDescription>
            Sellers with $50+ available balance and verified payout info
          </CardDescription>
        </CardHeader>
        <CardContent>
          {eligibleSellers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sellers eligible for payout</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Seller</TableHead>
                  <TableHead>Available</TableHead>
                  <TableHead>Pending</TableHead>
                  <TableHead>Total Earned</TableHead>
                  <TableHead>Last Payout</TableHead>
                  <TableHead>Method</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eligibleSellers.map((seller) => {
                  const profile = Array.isArray(seller.profiles) ? seller.profiles[0] : seller.profiles;
                  const payoutInfo = Array.isArray(seller.seller_payout_info) 
                    ? seller.seller_payout_info[0] 
                    : seller.seller_payout_info;
                  
                  return (
                    <TableRow key={seller.seller_id}>
                      <TableCell className="font-medium">
                        {profile?.display_name || profile?.username || 'Unknown'}
                      </TableCell>
                      <TableCell className="text-green-600 font-semibold">
                        ${seller.available_balance.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-yellow-600">
                        ${seller.pending_balance.toFixed(2)}
                      </TableCell>
                      <TableCell>${seller.total_earned.toFixed(2)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {seller.last_payout_at 
                          ? new Date(seller.last_payout_at).toLocaleDateString()
                          : 'Never'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{payoutInfo?.payout_method || 'N/A'}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Failed Payouts */}
      {failedPayouts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              Failed Payouts
            </CardTitle>
            <CardDescription>Payouts that require attention</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Seller</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Failed At</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {failedPayouts.map((payout) => {
                  const profile = Array.isArray(payout.profiles) ? payout.profiles[0] : payout.profiles;
                  
                  return (
                    <TableRow key={payout.id}>
                      <TableCell className="font-medium">
                        {profile?.display_name || profile?.username || 'Unknown'}
                      </TableCell>
                      <TableCell className="font-semibold">
                        ${payout.amount.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{payout.payout_method}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(payout.initiated_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <p className="text-xs text-red-600 truncate" title={payout.failure_reason || 'Unknown error'}>
                          {payout.failure_reason || 'Unknown error'}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => retryFailedPayout(payout.id)}
                          disabled={processing}
                        >
                          Retry
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Recent Payouts */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Payouts (Last 30 Days)</CardTitle>
          <CardDescription>History of processed payouts</CardDescription>
        </CardHeader>
        <CardContent>
          {recentPayouts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent payouts</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Seller</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Initiated</TableHead>
                  <TableHead>Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentPayouts.map((payout) => {
                  const profile = Array.isArray(payout.profiles) ? payout.profiles[0] : payout.profiles;
                  
                  return (
                    <TableRow key={payout.id}>
                      <TableCell className="font-medium">
                        {profile?.display_name || profile?.username || 'Unknown'}
                      </TableCell>
                      <TableCell className="font-semibold">
                        ${payout.amount.toFixed(2)}
                      </TableCell>
                      <TableCell>{getStatusBadge(payout.status)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{payout.payout_method}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(payout.initiated_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {payout.completed_at 
                          ? new Date(payout.completed_at).toLocaleDateString()
                          : '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Info Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Automated Schedule:</strong> Balances settle daily at 2 AM UTC. Payouts process weekly on Mondays at 3 AM UTC. 
          Trials are cleaned up hourly. Use manual triggers only when needed.
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default AdminPayoutDashboard;
