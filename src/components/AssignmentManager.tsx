
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AssignmentDetails from './AssignmentDetails';
import ManualAssignmentForm from './ManualAssignmentForm';
import AssignmentLogs from './AssignmentLogs';
import { ScriptAssignment, AssignmentLog } from '@/types/assignment';

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

      // Fetch assignment logs - using any to bypass type issues temporarily
      try {
        const { data: logsData, error: logsError } = await (supabase as any)
          .from('assignment_logs')
          .select('*')
          .eq('assignment_id', assignmentId)
          .order('created_at', { ascending: false });

        if (logsError) {
          console.warn('Could not fetch logs:', logsError.message);
          setLogs([]);
        } else {
          setLogs(logsData || []);
        }
      } catch (logError) {
        console.warn('Logs table may not exist yet:', logError);
        setLogs([]);
      }
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

  const handleManualAssignment = async (manualUsername: string, manualNotes: string) => {
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

      // Add manual assignment log - using any to bypass type issues temporarily
      try {
        await (supabase as any)
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
      } catch (logError) {
        console.warn('Could not insert log:', logError);
      }

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

  useEffect(() => {
    fetchAssignmentDetails();
  }, [assignmentId, user]);

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

      <AssignmentDetails assignment={assignment} />

      <Tabs defaultValue="manual" className="space-y-4">
        <TabsList>
          <TabsTrigger value="manual">Manual Assignment</TabsTrigger>
          <TabsTrigger value="logs">Activity Logs ({logs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="manual" className="space-y-4">
          <ManualAssignmentForm
            initialUsername={assignment.tradingview_username || ''}
            onSubmit={handleManualAssignment}
            processing={processing}
          />
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <AssignmentLogs logs={logs} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AssignmentManager;
