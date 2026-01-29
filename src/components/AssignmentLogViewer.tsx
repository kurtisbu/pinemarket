
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, Info, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAssignmentLogs, AssignmentLog } from '@/hooks/useAssignmentLogs';

interface AssignmentLogViewerProps {
  assignmentId: string;
}

const AssignmentLogViewer: React.FC<AssignmentLogViewerProps> = ({ assignmentId }) => {
  const { logs, loading, error, refetch } = useAssignmentLogs(assignmentId);

  const getLogIcon = (level: AssignmentLog['log_level']) => {
    switch (level) {
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      default:
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getLogBadgeVariant = (level: AssignmentLog['log_level']) => {
    switch (level) {
      case 'error':
        return 'destructive';
      case 'warning':
        return 'secondary';
      case 'success':
        return 'default';
      default:
        return 'outline';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading logs...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-500">Error loading logs: {error}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">Assignment Activity Logs</CardTitle>
          <Button variant="outline" size="sm" onClick={refetch}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No activity logs found for this assignment.
          </div>
        ) : (
          <ScrollArea className="h-96">
            <div className="space-y-4">
              {logs.map((log) => (
                <div key={log.id} className="flex gap-3 p-3 border rounded-lg">
                  <div className="flex-shrink-0 mt-0.5">
                    {getLogIcon(log.log_level)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={getLogBadgeVariant(log.log_level) as any}>
                        {log.log_level.toUpperCase()}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-foreground mb-2">{log.message}</p>
                    {log.details && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                          View details
                        </summary>
                        <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default AssignmentLogViewer;
