
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface AssignmentLog {
  id: string;
  assignment_id: string;
  purchase_id: string;
  log_level: 'info' | 'warning' | 'error' | 'success';
  message: string;
  details: any;
  created_at: string;
}

export const useAssignmentLogs = (assignmentId: string) => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AssignmentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    if (!user || !assignmentId) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('assignment_logs')
        .select('*')
        .eq('assignment_id', assignmentId)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching logs:', fetchError);
        setError(fetchError.message);
        return;
      }

      // Type-safe transformation of the data
      const typedLogs: AssignmentLog[] = (data || []).map(log => ({
        ...log,
        log_level: log.log_level as AssignmentLog['log_level']
      }));

      setLogs(typedLogs);
    } catch (err: any) {
      console.error('Failed to fetch assignment logs:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addLog = async (
    purchaseId: string,
    level: AssignmentLog['log_level'],
    message: string,
    details?: any
  ) => {
    try {
      const { error } = await supabase
        .from('assignment_logs')
        .insert({
          assignment_id: assignmentId,
          purchase_id: purchaseId,
          log_level: level,
          message,
          details: details || null
        });

      if (error) {
        console.error('Failed to add log:', error);
        return false;
      }

      // Refresh logs
      await fetchLogs();
      return true;
    } catch (err: any) {
      console.error('Failed to add assignment log:', err);
      return false;
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [assignmentId, user]);

  return {
    logs,
    loading,
    error,
    refetch: fetchLogs,
    addLog
  };
};
