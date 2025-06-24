
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

  const assignment = assignments[0];
  const statusConfig = {
    assigned: { variant: 'default' as const, text: 'Script Delivered', color: 'text-green-600' },
    pending: { variant: 'secondary' as const, text: 'Delivery Pending', color: 'text-yellow-600' },
    failed: { variant: 'destructive' as const, text: 'Delivery Failed', color: 'text-red-600' },
    expired: { variant: 'outline' as const, text: 'Assignment Expired', color: 'text-gray-600' },
  };

  const config = statusConfig[assignment.status as keyof typeof statusConfig] || statusConfig.pending;

  return (
    <Badge variant={config.variant}>
      {config.text}
    </Badge>
  );
};

export default AssignmentStatusBadge;
