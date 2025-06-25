
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface SecurityEvent {
  action: string;
  resource_type: string;
  resource_id?: string;
  details?: Record<string, any>;
  risk_level?: 'low' | 'medium' | 'high' | 'critical';
}

export const useSecurityAudit = () => {
  const { user } = useAuth();
  const [logging, setLogging] = useState(false);

  const logSecurityEvent = async (event: SecurityEvent) => {
    if (!user) return null;

    setLogging(true);
    try {
      const { data, error } = await supabase.rpc('log_security_event', {
        p_action: event.action,
        p_resource_type: event.resource_type,
        p_resource_id: event.resource_id || null,
        p_details: event.details ? JSON.stringify(event.details) : null,
        p_risk_level: event.risk_level || 'low'
      });

      if (error) {
        console.error('Failed to log security event:', error);
        return null;
      }

      console.log('Security event logged:', event.action, data);
      return data;
    } catch (error) {
      console.error('Security logging error:', error);
      return null;
    } finally {
      setLogging(false);
    }
  };

  const logFileUploadAttempt = (fileName: string, fileSize: number, result: 'success' | 'failed', error?: string) => {
    return logSecurityEvent({
      action: 'file_upload_attempt',
      resource_type: 'file',
      resource_id: fileName,
      details: {
        file_size: fileSize,
        result,
        error,
        timestamp: new Date().toISOString()
      },
      risk_level: result === 'failed' ? 'medium' : 'low'
    });
  };

  const logPaymentAttempt = (programId: string, amount: number, result: 'success' | 'failed', error?: string) => {
    return logSecurityEvent({
      action: 'payment_attempt',
      resource_type: 'purchase',
      resource_id: programId,
      details: {
        amount,
        result,
        error,
        timestamp: new Date().toISOString()
      },
      risk_level: result === 'failed' ? 'high' : 'low'
    });
  };

  const logScriptDownload = (programId: string, scriptPath: string) => {
    return logSecurityEvent({
      action: 'script_download',
      resource_type: 'program',
      resource_id: programId,
      details: {
        script_path: scriptPath,
        timestamp: new Date().toISOString()
      },
      risk_level: 'low'
    });
  };

  const logSuspiciousActivity = (activity: string, details: Record<string, any>) => {
    return logSecurityEvent({
      action: 'suspicious_activity',
      resource_type: 'security',
      details: {
        activity,
        ...details,
        timestamp: new Date().toISOString()
      },
      risk_level: 'high'
    });
  };

  return {
    logSecurityEvent,
    logFileUploadAttempt,
    logPaymentAttempt,
    logScriptDownload,
    logSuspiciousActivity,
    logging
  };
};
