
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, ExternalLink } from 'lucide-react';
import { ScriptAssignment } from '@/types/assignment';

interface AssignmentDetailsProps {
  assignment: ScriptAssignment;
}

const AssignmentDetails: React.FC<AssignmentDetailsProps> = ({ assignment }) => {
  const getStatusBadge = (status: string) => {
    const variants = {
      'assigned': 'default',
      'failed': 'destructive',
      'expired': 'destructive',
      'pending': 'secondary'
    } as const;
    
    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{assignment.purchases.programs.title}</span>
          {getStatusBadge(assignment.status)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="font-medium">Buyer:</span>
            <div>{assignment.profiles.display_name || assignment.profiles.username}</div>
          </div>
          <div>
            <span className="font-medium">TradingView Username:</span>
            <div className="flex items-center gap-1">
              {assignment.tradingview_username}
              <ExternalLink 
                className="w-3 h-3 text-blue-500 cursor-pointer" 
                onClick={() => window.open(`https://www.tradingview.com/u/${assignment.tradingview_username}/`, '_blank')}
              />
            </div>
          </div>
          <div>
            <span className="font-medium">Attempts:</span>
            <div>{assignment.assignment_attempts}</div>
          </div>
        </div>

        {assignment.error_message && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {assignment.error_message}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default AssignmentDetails;
