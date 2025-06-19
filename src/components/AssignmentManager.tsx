
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  RefreshCw, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  User, 
  ExternalLink,
  Send,
  FileText,
  Activity
} from 'lucide-react';

interface AssignmentLog {
  id: string;
  log_level: 'info' | 'warning' | 'error';
  message: string;
  details: any;
  created_at: string;
}

interface ScriptAssignment {
  id: string;
  purchase_id: string;
  buyer_id: string;
  program_id: string;
  tradingview_script_id: string;
  pine_id: string;
  tradingview_username: string;
  status: 'pending' | 'assigned' | 'failed' | 'expired';
  assignment_attempts: number;
  last_attempt_at: string | null;
  assigned_at: string | null;
  error_message: string | null;
  created_at: string;
  purchases: {
    amount: number;
    programs: {
      title: string;
    };
  };
  profiles: {
    display_name: string;
    username: string;
  };
}

interface AssignmentManagerProps {
  assignmentId: string;
  onClose: () => void;
}

const AssignmentManager: React.FC<AssignmentManagerProps> = ({ assignmentId, onClose }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [assignment, setAssignment] = useState<ScriptAssignment | null>(null);
  const [logs, setLogs] = useState<AssignmentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [manualUsername, setManualUsername] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  const fetchAssignmentDetails = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Fetch assignment details
      const { data: assignmentData, error: assignmentError } = await supabase
        .from('script_assignments')
        .select(`
          *,
          purchases!inner(
            amount,
            programs!inner(title)
          ),
          profiles!buyer_id(display_name, username)
        `)
        .eq('id', assignmentId)
        .eq('seller_id', user.id)
        .single();

      if (assignmentError) throw assignmentError;
      setAssignment(assignmentData);
      setManualUsername(assignmentData.tradingview_username || '');

      // Fetch assignment logs
      const { data: logsData, error: logsError } = await supabase
        .from('assignment_logs')
        .select('*')
        .eq('assignment_id', assignmentId)
        .order('created_at', { ascending: false });

      if (logsError) throw logsError;
      setLogs(logsData || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignmentDetails();
  }, [assignmentId, user]);

  const handleManualAssignment = async () => {
    if (!assignment || !manualUsername.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a TradingView username',
        variant: 'destructive',
      });
      return;
    }

    setProcessing(true);
    try {
      // Update assignment with new username if changed
      if (manualUsername.trim() !== assignment.tradingview_username) {
        const { error: updateError } = await supabase
          .from('script_assignments')
          .update({ 
            tradingview_username: manualUsername.trim(),
            status: 'pending'
          })
          .eq('id', assignmentId);

        if (updateError) throw updateError;
      }

      // Trigger assignment
      const { data, error } = await supabase.functions.invoke('tradingview-service', {
        body: {
          action: 'assign-script-access',
          pine_id: assignment.pine_id,
          tradingview_username: manualUsername.trim(),
          assignment_id: assignmentId,
        },
      });

      if (error || data.error) {
        throw new Error(error?.message || data.error);
      }

      toast({
        title: 'Assignment Triggered',
        description: 'The script assignment has been queued for processing.',
      });

      // Add manual assignment log
      await supabase
        .from('assignment_logs')
        .insert({
          assignment_id: assignmentId,
          purchase_id: assignment.purchase_id,
          log_level: 'info',
          message: 'Manual assignment triggered by seller',
          details: { 
            username: manualUsername.trim(),
            notes: manualNotes.trim() || null,
            triggered_by: user.id
          }
        });

      await fetchAssignmentDetails();
    } catch (error: any) {
      toast({
        title: 'Assignment Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const getLogIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'info':
        return <CheckCircle className="w-4 h-4 text-blue-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      'assigned': 'default',
      'failed': 'destructive',
      'expired': 'destructive',
      'pending': 'secondary'
    } as const;
    
    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  if (loading) {
    return <div className="text-center py-8">Loading assignment details...</div>;
  }

  if (!assignment) {
    return <div className="text-center py-8">Assignment not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Assignment Manager</h2>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{assignment.purchases.programs.title}</span>
            {getStatusBadge(assignment.status)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium">Buyer:</span>
              <div>{assignment.profiles.display_name || assignment.profiles.username}</div>
            </div>
            <div>
              <span className="font-medium">TradingView Username:</span>
              <div className="flex items-center gap-1">
                {assignment.tradingview_username}
                <ExternalLink 
                  className="w-3 h-3 text-blue-500 cursor-pointer" 
                  onClick={() => window.open(`https://www.tradingview.com/u/${assignment.tradingview_username}/`, '_blank')}
                />
              </div>
            </div>
            <div>
              <span className="font-medium">Attempts:</span>
              <div>{assignment.assignment_attempts}</div>
            </div>
          </div>

          {assignment.error_message && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {assignment.error_message}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="manual" className="space-y-4">
        <TabsList>
          <TabsTrigger value="manual">Manual Assignment</TabsTrigger>
          <TabsTrigger value="logs">Activity Logs ({logs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="manual" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="w-5 h-5" />
                Manual Script Assignment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">TradingView Username</Label>
                <Input
                  id="username"
                  value={manualUsername}
                  onChange={(e) => setManualUsername(e.target.value)}
                  placeholder="Enter TradingView username"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  placeholder="Add any notes about this manual assignment..."
                  rows={3}
                />
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This will trigger a manual script assignment. Make sure the TradingView username is correct.
                </AlertDescription>
              </Alert>

              <Button 
                onClick={handleManualAssignment}
                disabled={processing || !manualUsername.trim()}
                className="w-full"
              >
                {processing ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Trigger Manual Assignment
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <div className="space-y-3">
            {logs.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8 text-muted-foreground">
                  No activity logs available for this assignment.
                </CardContent>
              </Card>
            ) : (
              logs.map((log) => (
                <Card key={log.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {getLogIcon(log.log_level)}
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-medium">{log.message}</p>
                          <span className="text-xs text-muted-foreground">
                            {new Date(log.created_at).toLocaleString()}
                          </span>
                        </div>
                        {log.details && Object.keys(log.details).length > 0 && (
                          <details className="mt-2">
                            <summary className="text-sm text-muted-foreground cursor-pointer">
                              View Details
                            </summary>
                            <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AssignmentManager;
