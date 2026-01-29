
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock } from 'lucide-react';

interface PurchaseStatusBadgeProps {
  status: string;
}

const PurchaseStatusBadge: React.FC<PurchaseStatusBadgeProps> = ({ status }) => {
  const statusConfig = {
    completed: { variant: 'default' as const, icon: CheckCircle, color: 'text-green-600' },
    pending: { variant: 'secondary' as const, icon: Clock, color: 'text-yellow-600' },
    failed: { variant: 'destructive' as const, icon: XCircle, color: 'text-red-600' },
    refunded: { variant: 'outline' as const, icon: XCircle, color: 'text-gray-600' },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="flex items-center gap-1">
      <Icon className={`w-3 h-3 ${config.color}`} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
};

export default PurchaseStatusBadge;
