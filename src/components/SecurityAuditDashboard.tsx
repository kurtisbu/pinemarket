
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertTriangle, Eye, Activity } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface SecurityAuditLog {
  id: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  details?: Record<string, any>;
  created_at: string;
}

const SecurityAuditDashboard: React.FC = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<SecurityAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdminAccess();
    fetchSecurityLogs();
  }, [user]);

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

  const fetchSecurityLogs = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('security_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching security logs:', error);
        return;
      }

      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching security logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRiskBadgeColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };

  const getRiskIcon = (riskLevel: string) => {
    switch (riskLevel) {
      case 'critical':
      case 'high':
        return <AlertTriangle className="w-4 h-4" />;
      case 'medium':
        return <Eye className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  if (!user) {
    return (
      <Alert>
        <Shield className="w-4 h-4" />
        <AlertDescription>
          Please log in to access the security dashboard.
        </AlertDescription>
      </Alert>
    );
  }

  if (!isAdmin) {
    return (
      <Alert>
        <Shield className="w-4 h-4" />
        <AlertDescription>
          Admin access required to view security audit logs.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Security Audit Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              Monitoring security events and potential threats
            </p>
            <Button onClick={fetchSecurityLogs} variant="outline" size="sm">
              Refresh
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-8">Loading security logs...</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No security events recorded yet.
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="border rounded-lg p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getRiskIcon(log.risk_level)}
                      <span className="font-medium">{log.action}</span>
                      <Badge variant={getRiskBadgeColor(log.risk_level)}>
                        {log.risk_level.toUpperCase()}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </div>
                  
                  <div className="text-sm space-y-1">
                    <div>
                      <span className="font-medium">Resource:</span> {log.resource_type}
                      {log.resource_id && (
                        <span className="ml-2 text-muted-foreground">
                          ({log.resource_id})
                        </span>
                      )}
                    </div>
                    
                    {log.details && (
                      <div>
                        <span className="font-medium">Details:</span>
                        <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
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

export default SecurityAuditDashboard;
