
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AssignmentDetails from './AssignmentDetails';
import ManualAssignmentForm from './ManualAssignmentForm';
import AssignmentLogViewer from './AssignmentLogViewer';
import { ScriptAssignment } from '@/types/assignment';
import { useAssignmentLogs } from '@/hooks/useAssignmentLogs';

interface AssignmentManagerProps {
  assignmentId: string;
  onClose: () => void;
}

const AssignmentManager: React.FC<AssignmentManagerProps> = ({ assignmentId, onClose }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [assignment, setAssignment] = useState<ScriptAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const { addLog } = useAssignmentLogs(assignmentId);

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

    } catch (error: any) {
      console.error('Failed to fetch assignment:', error);
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
      // Log the manual assignment attempt
      await addLog(
        assignment.purchase_id,
        'info',
        'Manual assignment initiated by seller',
        { 
          username: manualUsername.trim(),
          notes: manualNotes.trim() || null,
          triggered_by: user.id
        }
      );

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

      // Log successful trigger
      await addLog(
        assignment.purchase_id,
        'success',
        'TradingView service invoked successfully',
        { service_response: data }
      );

      await fetchAssignmentDetails();
    } catch (error: any) {
      console.error('Assignment failed:', error);
      
      // Log the failure
      await addLog(
        assignment.purchase_id,
        'error',
        `Manual assignment failed: ${error.message}`,
        { error: error.message, stack: error.stack }
      );

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
          <TabsTrigger value="logs">Activity Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="manual" className="space-y-4">
          <ManualAssignmentForm
            initialUsername={assignment.tradingview_username || ''}
            onSubmit={handleManualAssignment}
            processing={processing}
          />
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <AssignmentLogViewer assignmentId={assignmentId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AssignmentManager;
