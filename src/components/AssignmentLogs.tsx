import React from 'react';
import AssignmentLogViewer from './AssignmentLogViewer';
import { AssignmentLog } from '@/types/assignment';

interface AssignmentLogsProps {
  logs: AssignmentLog[];
}

const AssignmentLogs: React.FC<AssignmentLogsProps> = ({ logs }) => {
  // This component is being replaced by AssignmentLogViewer
  // Keep for backwards compatibility but recommend using AssignmentLogViewer
  return (
    <div className="space-y-4">
      <div className="text-muted-foreground text-sm">
        Note: This view shows cached logs. For real-time logs, use the Assignment Log Viewer.
      </div>
      {logs.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No assignment logs available.
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <div key={log.id} className="p-3 border rounded-lg">
              <div className="flex justify-between items-start mb-2">
                <span className="text-sm font-medium">{log.log_level}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(log.created_at).toLocaleString()}
                </span>
              </div>
              <p className="text-sm">{log.message}</p>
              {log.details && (
                <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-x-auto">
                  {JSON.stringify(log.details, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AssignmentLogs;
