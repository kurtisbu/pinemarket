
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface DiagnosticCheck {
  name: string;
  status: 'pass' | 'warning' | 'error';
  message: string;
  details?: string;
}

const SupabaseDiagnostics: React.FC = () => {
  const { user } = useAuth();
  const [checks, setChecks] = useState<DiagnosticCheck[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdminAccess();
  }, [user]);

  const checkAdminAccess = async () => {
    if (!user) return;
    
    try {
      // Use secure server-side admin check
      const { data: isAdmin, error } = await supabase
        .rpc('is_current_user_admin');

      if (!error && isAdmin) {
        setIsAdmin(true);
        runDiagnostics();
      }
    } catch (error) {
      console.error('Error checking admin access:', error);
    }
  };

  const runDiagnostics = async () => {
    setLoading(true);
    const diagnosticResults: DiagnosticCheck[] = [];

    try {
      // Check 1: Rate limit configs access
      try {
        const { data: rateLimitConfigs, error: rateLimitError } = await supabase
          .from('rate_limit_configs')
          .select('*')
          .limit(1);

        if (rateLimitError) {
          diagnosticResults.push({
            name: 'Rate Limit Config Access',
            status: 'error',
            message: 'Cannot access rate limit configurations',
            details: rateLimitError.message
          });
        } else {
          diagnosticResults.push({
            name: 'Rate Limit Config Access',
            status: 'pass',
            message: 'Admin can access rate limit configurations'
          });
        }
      } catch (error: any) {
        diagnosticResults.push({
          name: 'Rate Limit Config Access',
          status: 'error',
          message: 'Rate limit config check failed',
          details: error.message
        });
      }

      // Check 2: Security audit logs
      try {
        const { data: auditLogs, error: auditError } = await supabase
          .from('security_audit_logs')
          .select('count')
          .limit(1);

        if (auditError) {
          diagnosticResults.push({
            name: 'Security Audit Logs',
            status: 'warning',
            message: 'Cannot access security audit logs',
            details: auditError.message
          });
        } else {
          diagnosticResults.push({
            name: 'Security Audit Logs',
            status: 'pass',
            message: 'Security audit logging is functional'
          });
        }
      } catch (error: any) {
        diagnosticResults.push({
          name: 'Security Audit Logs',
          status: 'warning',
          message: 'Audit log check failed',
          details: error.message
        });
      }

      // Check 3: Storage bucket access
      try {
        const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();

        if (bucketError) {
          diagnosticResults.push({
            name: 'Storage Buckets',
            status: 'warning',
            message: 'Cannot list storage buckets',
            details: bucketError.message
          });
        } else {
          const hasPineScripts = buckets.some(bucket => bucket.name === 'pine-scripts');
          const hasProgramMedia = buckets.some(bucket => bucket.name === 'program-media');
          
          if (hasPineScripts && hasProgramMedia) {
            diagnosticResults.push({
              name: 'Storage Buckets',
              status: 'pass',
              message: 'Required storage buckets exist'
            });
          } else {
            diagnosticResults.push({
              name: 'Storage Buckets',
              status: 'warning',
              message: 'Missing required storage buckets',
              details: `Missing: ${!hasPineScripts ? 'pine-scripts ' : ''}${!hasProgramMedia ? 'program-media' : ''}`
            });
          }
        }
      } catch (error: any) {
        diagnosticResults.push({
          name: 'Storage Buckets',
          status: 'error',
          message: 'Storage bucket check failed',
          details: error.message
        });
      }

      // Check 4: Database functions
      try {
        const { data: functionTest, error: functionError } = await supabase.rpc('validate_tradingview_url', {
          url: 'https://www.tradingview.com/script/test/'
        });

        if (functionError) {
          diagnosticResults.push({
            name: 'Database Functions',
            status: 'error',
            message: 'Security validation functions not working',
            details: functionError.message
          });
        } else {
          diagnosticResults.push({
            name: 'Database Functions',
            status: 'pass',
            message: 'Security validation functions are operational'
          });
        }
      } catch (error: any) {
        diagnosticResults.push({
          name: 'Database Functions',
          status: 'error',
          message: 'Function test failed',
          details: error.message
        });
      }

      // Check 5: RLS Policies
      try {
        const { data: programTest, error: programError } = await supabase
          .from('programs')
          .select('id')
          .limit(1);

        if (programError && programError.code === 'PGRST116') {
          diagnosticResults.push({
            name: 'Row Level Security',
            status: 'warning',
            message: 'RLS policies may be too restrictive',
            details: 'Programs table access restricted'
          });
        } else {
          diagnosticResults.push({
            name: 'Row Level Security',
            status: 'pass',
            message: 'RLS policies are functioning correctly'
          });
        }
      } catch (error: any) {
        diagnosticResults.push({
          name: 'Row Level Security',
          status: 'warning',
          message: 'RLS policy check failed',
          details: error.message
        });
      }

    } catch (error) {
      console.error('Diagnostics error:', error);
    } finally {
      setChecks(diagnosticResults);
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pass':
        return 'default';
      case 'warning':
        return 'secondary';
      case 'error':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  if (!user) {
    return (
      <Alert>
        <AlertTriangle className="w-4 h-4" />
        <AlertDescription>
          Please log in to access Supabase diagnostics.
        </AlertDescription>
      </Alert>
    );
  }

  if (!isAdmin) {
    return (
      <Alert>
        <AlertTriangle className="w-4 h-4" />
        <AlertDescription>
          Admin access required to view Supabase diagnostics.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Supabase Diagnostics
          <Button 
            onClick={runDiagnostics} 
            disabled={loading}
            variant="outline" 
            size="sm"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {loading ? 'Running...' : 'Run Diagnostics'}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {checks.length === 0 && !loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Click "Run Diagnostics" to check for Supabase issues
          </div>
        ) : (
          <div className="space-y-4">
            {checks.map((check, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(check.status)}
                    <span className="font-medium">{check.name}</span>
                    <Badge variant={getStatusColor(check.status) as any}>
                      {check.status.toUpperCase()}
                    </Badge>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  {check.message}
                </p>
                {check.details && (
                  <div className="text-xs bg-muted p-2 rounded">
                    <strong>Details:</strong> {check.details}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SupabaseDiagnostics;
