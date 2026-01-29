
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Settings, Activity, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useRateLimit } from '@/hooks/useRateLimit';

interface SecurityMetrics {
  total_events: number;
  high_risk_events: number;
  rate_limit_violations: number;
  validation_failures: number;
}

const AdminSecurityDashboard: React.FC = () => {
  const { user } = useAuth();
  const { configs, isAdmin, refreshConfigs } = useRateLimit();
  const [metrics, setMetrics] = useState<SecurityMetrics>({
    total_events: 0,
    high_risk_events: 0,
    rate_limit_violations: 0,
    validation_failures: 0
  });
  const [loading, setLoading] = useState(true);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);

  useEffect(() => {
    if (isAdmin) {
      fetchSecurityMetrics();
      fetchRecentEvents();
    }
  }, [isAdmin]);

  const fetchSecurityMetrics = async () => {
    try {
      // Get total events count
      const { count: totalCount } = await supabase
        .from('security_audit_logs')
        .select('*', { count: 'exact', head: true });

      // Get high risk events
      const { count: highRiskCount } = await supabase
        .from('security_audit_logs')
        .select('*', { count: 'exact', head: true })
        .in('risk_level', ['high', 'critical']);

      // Get rate limit violations
      const { count: rateLimitCount } = await supabase
        .from('security_audit_logs')
        .select('*', { count: 'exact', head: true })
        .eq('action', 'rate_limit_exceeded');

      // Get validation failures
      const { count: validationCount } = await supabase
        .from('security_audit_logs')
        .select('*', { count: 'exact', head: true })
        .in('action', ['invalid_url_attempt', 'suspicious_content_detected']);

      setMetrics({
        total_events: totalCount || 0,
        high_risk_events: highRiskCount || 0,
        rate_limit_violations: rateLimitCount || 0,
        validation_failures: validationCount || 0
      });
    } catch (error) {
      console.error('Error fetching security metrics:', error);
    }
  };

  const fetchRecentEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('security_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setRecentEvents(data || []);
    } catch (error) {
      console.error('Error fetching recent events:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };

  if (!user || !isAdmin) {
    return (
      <Alert>
        <Shield className="w-4 h-4" />
        <AlertDescription>
          Admin access required to view security dashboard.
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
            Admin Security Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="rate-limits">Rate Limits</TabsTrigger>
              <TabsTrigger value="events">Recent Events</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <Activity className="w-4 h-4 text-blue-500" />
                      <div>
                        <p className="text-sm font-medium">Total Events</p>
                        <p className="text-2xl font-bold">{metrics.total_events}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      <div>
                        <p className="text-sm font-medium">High Risk</p>
                        <p className="text-2xl font-bold">{metrics.high_risk_events}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <Shield className="w-4 h-4 text-orange-500" />
                      <div>
                        <p className="text-sm font-medium">Rate Limits</p>
                        <p className="text-2xl font-bold">{metrics.rate_limit_violations}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <Settings className="w-4 h-4 text-purple-500" />
                      <div>
                        <p className="text-sm font-medium">Validation Fails</p>
                        <p className="text-2xl font-bold">{metrics.validation_failures}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="rate-limits" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Rate Limit Configuration</h3>
                <Button onClick={refreshConfigs} variant="outline" size="sm">
                  Refresh
                </Button>
              </div>
              
              <div className="grid gap-4">
                {configs.map((config) => (
                  <Card key={config.endpoint}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium capitalize">{config.endpoint}</h4>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <div>Per Hour: {config.requests_per_hour}</div>
                            <div>Per Minute: {config.requests_per_minute}</div>
                            <div>Burst Limit: {config.burst_limit}</div>
                          </div>
                        </div>
                        <Badge variant={config.enabled ? "default" : "secondary"}>
                          {config.enabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="events" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Recent Security Events</h3>
                <Button onClick={fetchRecentEvents} variant="outline" size="sm">
                  Refresh
                </Button>
              </div>

              {loading ? (
                <div className="text-center py-8">Loading events...</div>
              ) : recentEvents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No recent security events.
                </div>
              ) : (
                <div className="space-y-3">
                  {recentEvents.map((event) => (
                    <Card key={event.id}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{event.action}</span>
                              <Badge variant={getRiskColor(event.risk_level || 'low')}>
                                {(event.risk_level || 'low').toUpperCase()}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Resource: {event.resource_type}
                              {event.resource_id && ` (${event.resource_id})`}
                            </div>
                            {event.details && (
                              <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-w-md">
                                {JSON.stringify(event.details, null, 2)}
                              </pre>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(event.created_at).toLocaleString()}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSecurityDashboard;
