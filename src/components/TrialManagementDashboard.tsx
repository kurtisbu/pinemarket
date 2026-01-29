
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, Users, TrendingUp, AlertTriangle, Calendar, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface TrialStats {
  active_trials: number;
  expired_trials: number;
  total_trials: number;
  conversion_rate: number;
}

interface TrialUsageData {
  id: string;
  user_id: string;
  program_id: string;
  used_at: string;
  program_title: string;
  user_display_name: string;
  user_username: string;
  status: string;
  expires_at: string | null;
  assigned_at: string | null;
}

const TrialManagementDashboard: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState<TrialStats | null>(null);
  const [trialUsage, setTrialUsage] = useState<TrialUsageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [cleanupLoading, setCleanupLoading] = useState(false);

  const fetchTrialStats = async () => {
    if (!user) return;

    try {
      // Fetch trial statistics
      const { data: assignments, error: assignmentsError } = await supabase
        .from('script_assignments')
        .select(`
          *,
          purchases!inner(
            programs!inner(seller_id, title)
          )
        `)
        .eq('is_trial', true)
        .eq('purchases.programs.seller_id', user.id);

      if (assignmentsError) throw assignmentsError;

      const activeTrials = assignments?.filter(a => a.status === 'assigned' && (!a.expires_at || new Date(a.expires_at) > new Date())).length || 0;
      const expiredTrials = assignments?.filter(a => a.status === 'expired' || (a.expires_at && new Date(a.expires_at) <= new Date())).length || 0;
      const totalTrials = assignments?.length || 0;

      // Calculate conversion rate (trials that became purchases)
      const { data: purchases, error: purchasesError } = await supabase
        .from('purchases')
        .select('*')
        .eq('seller_id', user.id)
        .gt('amount', 0);

      if (purchasesError) throw purchasesError;

      const trialUserIds = new Set((assignments || []).map(a => a.buyer_id));
      const purchaseUserIds = new Set((purchases || []).map(p => p.buyer_id));
      const conversions = [...trialUserIds].filter(id => purchaseUserIds.has(id)).length;
      const conversionRate = totalTrials > 0 ? (conversions / totalTrials) * 100 : 0;

      setStats({
        active_trials: activeTrials,
        expired_trials: expiredTrials,
        total_trials: totalTrials,
        conversion_rate: conversionRate
      });

      // Fetch detailed trial usage
      const { data: detailedTrials, error: detailedError } = await supabase
        .from('script_assignments')
        .select(`
          *,
          profiles!buyer_id(display_name, username),
          purchases!inner(
            programs!inner(title, seller_id)
          )
        `)
        .eq('is_trial', true)
        .eq('purchases.programs.seller_id', user.id)
        .order('created_at', { ascending: false });

      if (detailedError) throw detailedError;

      const formattedTrials = detailedTrials?.map(trial => ({
        id: trial.id,
        user_id: trial.buyer_id,
        program_id: trial.program_id,
        used_at: trial.created_at,
        program_title: trial.purchases.programs.title,
        user_display_name: trial.profiles.display_name || 'Unknown',
        user_username: trial.profiles.username || 'Unknown',
        status: trial.status,
        expires_at: trial.expires_at,
        assigned_at: trial.assigned_at
      })) || [];

      setTrialUsage(formattedTrials);

    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to fetch trial data',
        variant: 'destructive',
      });
      console.error('Error fetching trial stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const runTrialCleanup = async () => {
    setCleanupLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('trial-cleanup');
      
      if (error) throw error;

      toast({
        title: 'Cleanup Complete',
        description: `Processed ${data.processed} expired trials${data.errors > 0 ? ` (${data.errors} errors)` : ''}`,
      });

      // Refresh data
      await fetchTrialStats();
    } catch (error: any) {
      toast({
        title: 'Cleanup Failed',
        description: error.message || 'Failed to run trial cleanup',
        variant: 'destructive',
      });
    } finally {
      setCleanupLoading(false);
    }
  };

  useEffect(() => {
    fetchTrialStats();
  }, [user]);

  const getStatusBadge = (status: string, expiresAt: string | null) => {
    if (status === 'expired' || (expiresAt && new Date(expiresAt) <= new Date())) {
      return <Badge variant="destructive">Expired</Badge>;
    }
    if (status === 'assigned') {
      return <Badge variant="default">Active</Badge>;
    }
    if (status === 'pending') {
      return <Badge variant="secondary">Pending</Badge>;
    }
    return <Badge variant="destructive">Failed</Badge>;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Trial Management</h2>
        <Button 
          onClick={runTrialCleanup} 
          disabled={cleanupLoading}
          variant="outline"
        >
          {cleanupLoading ? 'Running Cleanup...' : 'Run Trial Cleanup'}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Trials</p>
                <p className="text-2xl font-bold text-green-600">{stats?.active_trials || 0}</p>
              </div>
              <Clock className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Expired Trials</p>
                <p className="text-2xl font-bold text-red-600">{stats?.expired_trials || 0}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Trials</p>
                <p className="text-2xl font-bold">{stats?.total_trials || 0}</p>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Conversion Rate</p>
                <p className="text-2xl font-bold text-purple-600">{stats?.conversion_rate.toFixed(1) || 0}%</p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trial Usage Table */}
      <Card>
        <CardHeader>
          <CardTitle>Trial Usage Details</CardTitle>
        </CardHeader>
        <CardContent>
          {trialUsage.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No trial usage data found.
            </div>
          ) : (
            <div className="space-y-4">
              {trialUsage.map((trial) => (
                <div key={trial.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium">{trial.program_title}</h4>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="w-4 h-4" />
                        {trial.user_display_name} (@{trial.user_username})
                      </div>
                    </div>
                    {getStatusBadge(trial.status, trial.expires_at)}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Started:</span>
                      <div>{new Date(trial.used_at).toLocaleDateString()}</div>
                    </div>
                    
                    {trial.assigned_at && (
                      <div>
                        <span className="font-medium">Assigned:</span>
                        <div>{new Date(trial.assigned_at).toLocaleDateString()}</div>
                      </div>
                    )}
                    
                    {trial.expires_at && (
                      <div>
                        <span className="font-medium">Expires:</span>
                        <div className={new Date(trial.expires_at) <= new Date() ? 'text-red-600 font-medium' : ''}>
                          {new Date(trial.expires_at).toLocaleDateString()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TrialManagementDashboard;
