
import React from 'react';
import { Badge } from '@/components/ui/badge';

interface Assignment {
  status: string;
  assigned_at: string | null;
  error_message: string | null;
}

interface AssignmentStatusBadgeProps {
  assignments?: Assignment[];
}

const AssignmentStatusBadge: React.FC<AssignmentStatusBadgeProps> = ({ assignments }) => {
  if (!assignments || assignments.length === 0) {
    return <Badge variant="secondary">No Assignment</Badge>;
  }

  const statusConfig = {
    assigned: { variant: 'default' as const, text: 'Script Delivered', color: 'text-green-600', priority: 4 },
    pending: { variant: 'secondary' as const, text: 'Delivery Pending', color: 'text-yellow-600', priority: 2 },
    failed: { variant: 'destructive' as const, text: 'Delivery Failed', color: 'text-red-600', priority: 1 },
    expired: { variant: 'outline' as const, text: 'Assignment Expired', color: 'text-gray-600', priority: 3 },
  };

  // For multiple assignments, show the most important status
  // Priority: failed (show first) > pending > expired > assigned
  const sortedAssignments = [...assignments].sort((a, b) => {
    const priorityA = statusConfig[a.status as keyof typeof statusConfig]?.priority || 0;
    const priorityB = statusConfig[b.status as keyof typeof statusConfig]?.priority || 0;
    return priorityA - priorityB;
  });

  const primaryAssignment = sortedAssignments[0];
  const config = statusConfig[primaryAssignment.status as keyof typeof statusConfig] || statusConfig.pending;

  // If there are multiple assignments, show count
  if (assignments.length > 1) {
    const allAssigned = assignments.every(a => a.status === 'assigned');
    const anyFailed = assignments.some(a => a.status === 'failed');
    const anyPending = assignments.some(a => a.status === 'pending');

    if (allAssigned) {
      return <Badge variant="default">{assignments.length} Scripts Delivered</Badge>;
    } else if (anyFailed) {
      const failedCount = assignments.filter(a => a.status === 'failed').length;
      return <Badge variant="destructive">{failedCount}/{assignments.length} Failed</Badge>;
    } else if (anyPending) {
      const pendingCount = assignments.filter(a => a.status === 'pending').length;
      return <Badge variant="secondary">{pendingCount}/{assignments.length} Pending</Badge>;
    }
  }

  return (
    <Badge variant={config.variant}>
      {config.text}
    </Badge>
  );
};

export default AssignmentStatusBadge;
