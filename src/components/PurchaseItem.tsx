
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, ExternalLink, CheckCircle, XCircle, Clock } from 'lucide-react';
import PurchaseStatusBadge from './PurchaseStatusBadge';
import AssignmentStatusBadge from './AssignmentStatusBadge';

interface Purchase {
  id: string;
  amount: number;
  status: string;
  purchased_at: string;
  tradingview_username: string;
  programs: {
    id: string;
    title: string;
    description: string;
    category: string;
    image_urls: string[];
  };
  script_assignments?: {
    status: string;
    assigned_at: string | null;
    error_message: string | null;
  }[];
}

interface PurchaseItemProps {
  purchase: Purchase;
}

const PurchaseItem: React.FC<PurchaseItemProps> = ({ purchase }) => {
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-semibold text-lg">{purchase.programs.title}</h3>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {purchase.programs.description}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline">{purchase.programs.category}</Badge>
            <PurchaseStatusBadge status={purchase.status} />
            <AssignmentStatusBadge assignments={purchase.script_assignments} />
          </div>
        </div>
        {purchase.programs.image_urls && purchase.programs.image_urls[0] && (
          <img
            src={purchase.programs.image_urls[0]}
            alt={purchase.programs.title}
            className="w-16 h-16 object-cover rounded ml-4"
          />
        )}
      </div>
      
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            <span>
              {new Date(purchase.purchased_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              })}
            </span>
          </div>
          <div className="font-medium text-foreground">
            ${purchase.amount}
          </div>
          {purchase.tradingview_username && (
            <div className="text-xs">
              TradingView: {purchase.tradingview_username}
            </div>
          )}
        </div>
        <Button variant="outline" size="sm" asChild>
          <a href={`/program/${purchase.programs.id}`}>
            <ExternalLink className="w-4 h-4 mr-1" />
            View Program
          </a>
        </Button>
      </div>

      {purchase.script_assignments && purchase.script_assignments[0]?.error_message && (
        <div className="bg-red-50 border border-red-200 rounded p-3 mt-2">
          <p className="text-sm text-red-700">
            <strong>Delivery Error:</strong> {purchase.script_assignments[0].error_message}
          </p>
        </div>
      )}
    </div>
  );
};

export default PurchaseItem;
