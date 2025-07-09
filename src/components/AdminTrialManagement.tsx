
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, Users, TrendingUp, AlertTriangle, Calendar, RefreshCw, Shield, BarChart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface SystemTrialStats {
  total_active_trials: number;
  total_expired_trials: number;
  total_trials_all_time: number;
  avg_trial_duration: number;
  trials_by_program: { program_title: string; count: number }[];
}

const AdminTrialManagement: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState<SystemTrialStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const checkAdminAccess = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!error && data?.role === 'admin') {
        setIsAdmin(true);
      }
    } catch (error) {
      console.error('Error checking admin access:', error);
    }
  };

  const fetchSystemTrialStats = async () => {
    if (!user || !isAdmin) return;

    try {
      // Fetch all trial assignments
      const { data: assignments, error: assignmentsError } = await supabase
        .from('script_assignments')
        .select(`
          *,
          purchases!inner(
            programs!inner(title)
          )
        `)
        .eq('is_trial', true);

      if (assignmentsError) throw assignmentsError;

      const now = new Date();
      const activeTrials = assignments?.filter(a => 
        a.status === 'assigned' && 
        (!a.expires_at || new Date(a.expires_at) > now)
      ).length || 0;

      const expiredTrials = assignments?.filter(a => 
        a.status === 'expired' || 
        (a.expires_at && new Date(a.expires_at) <= now)
      ).length || 0;

      const totalTrials = assignments?.length || 0;

      // Calculate average trial duration
      const completedTrials = assignments?.filter(a => a.assigned_at && a.expires_at) || [];
      const avgDuration = completedTrials.length > 0 
        ? completedTrials.reduce((sum, trial) => {
            const start = new Date(trial.assigned_at!);
            const end = new Date(trial.expires_at!);
            return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24); // days
          }, 0) / completedTrials.length
        : 0;

      // Group trials by program
      const programCounts = assignments?.reduce((acc, assignment) => {
        const title = assignment.purchases.programs.title;
        acc[title] = (acc[title] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const trialsByProgram = Object.entries(programCounts)
        .map(([program_title, count]) => ({ program_title, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10); // Top 10 programs

      setStats({
        total_active_trials: activeTrials,
        total_expired_trials: expiredTrials,
        total_trials_all_time: totalTrials,
        avg_trial_duration: avgDuration,
        trials_by_program: trialsByProgram
      });

    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to fetch system trial data',
        variant: 'destructive',
      });
      console.error('Error fetching system trial stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const runSystemTrialCleanup = async () => {
    setCleanupLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('trial-cleanup');
      
      if (error) throw error;

      toast({
        title: 'System Cleanup Complete',
        description: `Processed ${data.processed} expired trials system-wide${data.errors > 0 ? ` (${data.errors} errors)` : ''}`,
      });

      // Refresh data
      await fetchSystemTrialStats();
    } catch (error: any) {
      toast({
        title: 'Cleanup Failed',
        description: error.message || 'Failed to run system trial cleanup',
        variant: 'destructive',
      });
    } finally {
      setCleanupLoading(false);
    }
  };

  useEffect(() => {
    checkAdminAccess();
  }, [user]);

  useEffect(() => {
    if (isAdmin) {
      fetchSystemTrialStats();
    }
  }, [isAdmin]);

  if (!user) {
    return (
      <Alert>
        <Shield className="w-4 h-4" />
        <AlertDescription>
          Please log in to access the admin trial management dashboard.
        </AlertDescription>
      </Alert>
    );
  }

  if (!isAdmin) {
    return (
      <Alert>
        <Shield className="w-4 h-4" />
        <AlertDescription>
          Admin access required to view system trial management.
        </AlertDescription>
      </Alert>
    );
  }

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
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6" />
            Admin Trial Management
          </h2>
          <p className="text-muted-foreground">System-wide trial monitoring and management</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={fetchSystemTrialStats} 
            variant="outline"
            size="sm"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button 
            onClick={runSystemTrialCleanup} 
            disabled={cleanupLoading}
            variant="outline"
          >
            {cleanupLoading ? 'Running...' : 'Run Cleanup'}
          </Button>
        </div>
      </div>

      {/* System-wide Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Trials</p>
                <p className="text-2xl font-bold text-green-600">{stats?.total_active_trials || 0}</p>
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
                <p className="text-2xl font-bold text-red-600">{stats?.total_expired_trials || 0}</p>
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
                <p className="text-2xl font-bold">{stats?.total_trials_all_time || 0}</p>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Duration</p>
                <p className="text-2xl font-bold text-purple-600">{stats?.avg_trial_duration.toFixed(1) || 0}d</p>
              </div>
              <Calendar className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Popular Programs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart className="w-5 h-5" />
            Most Trialed Programs
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.trials_by_program.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No trial data available yet.
            </div>
          ) : (
            <div className="space-y-3">
              {stats?.trials_by_program.map((program, index) => (
                <div key={program.program_title} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">{index + 1}</Badge>
                    <span className="font-medium">{program.program_title}</span>
                  </div>
                  <Badge>{program.count} trials</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminTrialManagement;
