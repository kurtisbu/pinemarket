
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, ExternalLink, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ScriptAssignment {
  id: string;
  purchase_id: string;
  buyer_id: string;
  seller_id: string;
  program_id: string;
  tradingview_script_id: string;
  pine_id: string;
  tradingview_username: string;
  status: 'pending' | 'assigned' | 'failed' | 'expired';
  assignment_attempts: number;
  last_attempt_at: string | null;
  assigned_at: string | null;
  error_message: string | null;
  assignment_details: any;
  created_at: string;
  purchases: {
    amount: number;
    programs: {
      title: string;
    };
  };
  profiles?: {
    display_name?: string | null;
    username?: string | null;
  } | null;
}

const AdminScriptAssignments: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<ScriptAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'assigned' | 'failed' | 'expired'>('all');

  const fetchAssignments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('script_assignments')
      .select(`
        *,
        purchases!inner(
          amount,
          programs!inner(title)
        ),
        profiles!buyer_id(display_name, username)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Error fetching assignments', description: error.message, variant: 'destructive' });
    } else {
      setAssignments(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

  const handleRetryAssignment = async (assignment: ScriptAssignment) => {
    if (!assignment.pine_id || !assignment.tradingview_username) {
      toast({ 
        title: 'Cannot retry assignment', 
        description: 'Missing pine_id or TradingView username', 
        variant: 'destructive' 
      });
      return;
    }

    setRetrying(assignment.id);
    
    const { data, error } = await supabase.functions.invoke('tradingview-service', {
      body: {
        action: 'assign-script-access',
        pine_id: assignment.pine_id,
        tradingview_username: assignment.tradingview_username,
        assignment_id: assignment.id,
      },
    });

    if (error || data.error) {
      toast({ 
        title: 'Retry Failed', 
        description: error?.message || data.error, 
        variant: 'destructive' 
      });
    } else {
      toast({ title: 'Assignment Retried', description: 'The assignment has been queued for retry.' });
      await fetchAssignments();
    }
    
    setRetrying(null);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'assigned':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'expired':
        return <AlertCircle className="w-4 h-4 text-orange-500" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    let variant: 'default' | 'destructive' | 'secondary' = 'secondary';
    
    if (status === 'assigned') {
      variant = 'default';
    } else if (status === 'failed' || status === 'expired') {
      variant = 'destructive';
    }
    
    return (
      <Badge variant={variant} className="flex items-center gap-1">
        {getStatusIcon(status)}
        {status.toUpperCase()}
      </Badge>
    );
  };

  const filteredAssignments = assignments.filter(assignment => 
    filter === 'all' || assignment.status === filter
  );

  const stats = {
    total: assignments.length,
    pending: assignments.filter(a => a.status === 'pending').length,
    assigned: assignments.filter(a => a.status === 'assigned').length,
    failed: assignments.filter(a => a.status === 'failed').length,
    expired: assignments.filter(a => a.status === 'expired').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Script Assignment Management</h2>
        <Button onClick={fetchAssignments} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-500">{stats.pending}</div>
            <div className="text-sm text-muted-foreground">Pending</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-500">{stats.assigned}</div>
            <div className="text-sm text-muted-foreground">Assigned</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-500">{stats.failed}</div>
            <div className="text-sm text-muted-foreground">Failed</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-500">{stats.expired}</div>
            <div className="text-sm text-muted-foreground">Expired</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <Tabs value={filter} onValueChange={(value) => setFilter(value as any)}>
        <TabsList>
          <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({stats.pending})</TabsTrigger>
          <TabsTrigger value="assigned">Assigned ({stats.assigned})</TabsTrigger>
          <TabsTrigger value="failed">Failed ({stats.failed})</TabsTrigger>
          <TabsTrigger value="expired">Expired ({stats.expired})</TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="space-y-4">
          {loading ? (
            <div className="text-center py-8">Loading assignments...</div>
          ) : filteredAssignments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No assignments found for the selected filter.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAssignments.map(assignment => (
                <Card key={assignment.id}>
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">
                          {assignment.purchases.programs.title}
                        </CardTitle>
                        <div className="text-sm text-muted-foreground">
                          Buyer: {assignment.profiles?.display_name || assignment.profiles?.username || 'Unknown buyer'}
                        </div>
                      </div>
                      {getStatusBadge(assignment.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="font-medium">TradingView Username:</span>
                        <div>{assignment.tradingview_username}</div>
                      </div>
                      <div>
                        <span className="font-medium">Pine ID:</span>
                        <div className="font-mono text-xs">{assignment.pine_id || 'N/A'}</div>
                      </div>
                      <div>
                        <span className="font-medium">Attempts:</span>
                        <div>{assignment.assignment_attempts}</div>
                      </div>
                    </div>

                    {assignment.last_attempt_at && (
                      <div className="text-sm">
                        <span className="font-medium">Last Attempt:</span>
                        <div>{new Date(assignment.last_attempt_at).toLocaleString()}</div>
                      </div>
                    )}

                    {assignment.assigned_at && (
                      <div className="text-sm">
                        <span className="font-medium">Assigned At:</span>
                        <div>{new Date(assignment.assigned_at).toLocaleString()}</div>
                      </div>
                    )}

                    {assignment.error_message && (
                      <div className="text-sm">
                        <span className="font-medium text-red-600">Error:</span>
                        <div className="text-red-600 bg-red-50 p-2 rounded mt-1">
                          {assignment.error_message}
                        </div>
                      </div>
                    )}

                    {assignment.assignment_details && (
                      <div className="text-sm">
                        <span className="font-medium">Details:</span>
                        <pre className="bg-gray-50 p-2 rounded mt-1 text-xs overflow-x-auto">
                          {JSON.stringify(assignment.assignment_details, null, 2)}
                        </pre>
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-2">
                      <div className="text-sm text-muted-foreground">
                        Created: {new Date(assignment.created_at).toLocaleString()}
                      </div>
                      <div className="flex gap-2">
                        {(assignment.status === 'failed' || assignment.status === 'expired') && (
                          <Button
                            size="sm"
                            onClick={() => handleRetryAssignment(assignment)}
                            disabled={retrying === assignment.id}
                          >
                            {retrying === assignment.id ? (
                              <>
                                <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                                Retrying...
                              </>
                            ) : (
                              'Retry Assignment'
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminScriptAssignments;
