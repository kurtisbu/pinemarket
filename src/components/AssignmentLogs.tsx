
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, CheckCircle, Activity } from 'lucide-react';
import { AssignmentLog } from '@/types/assignment';

interface AssignmentLogsProps {
  logs: AssignmentLog[];
}

const AssignmentLogs: React.FC<AssignmentLogsProps> = ({ logs }) => {
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

  if (logs.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8 text-muted-foreground">
          No activity logs available for this assignment.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {logs.map((log) => (
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
      ))}
    </div>
  );
};

export default AssignmentLogs;
