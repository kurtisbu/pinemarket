
import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, ExternalLink, Settings, Loader2 } from 'lucide-react';
import PurchaseStatusBadge from './PurchaseStatusBadge';
import AssignmentStatusBadge from './AssignmentStatusBadge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface Purchase {
  id: string;
  amount: number;
  status: string;
  purchased_at: string;
  tradingview_username: string;
  stripe_subscription_id?: string | null;
  programs: {
    id: string;
    title: string;
    description: string;
    category: string;
    image_urls: string[];
  };
  script_assignments?: Array<{
    status: string;
    assigned_at: string | null;
    error_message: string | null;
  }>;
}

interface PurchaseItemProps {
  purchase: Purchase;
}

const PurchaseItem: React.FC<PurchaseItemProps> = ({ purchase }) => {
  const [managingSubscription, setManagingSubscription] = useState(false);
  const { toast } = useToast();

  const handleManageSubscription = async () => {
    setManagingSubscription(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-subscription', {
        body: { returnUrl: window.location.href },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to open subscription management',
        variant: 'destructive',
      });
    } finally {
      setManagingSubscription(false);
    }
  };

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
        <div className="flex items-center gap-2">
          {purchase.stripe_subscription_id && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleManageSubscription}
              disabled={managingSubscription}
            >
              {managingSubscription ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Settings className="w-4 h-4 mr-1" />
                  Manage Subscription
                </>
              )}
            </Button>
          )}
          <Button variant="outline" size="sm" asChild>
            <a href={`/program/${purchase.programs.id}`}>
              <ExternalLink className="w-4 h-4 mr-1" />
              View Program
            </a>
          </Button>
        </div>
      </div>

      {purchase.script_assignments?.some(a => a.error_message) && (
        <div className="bg-red-50 border border-red-200 rounded p-3 mt-2">
          {purchase.script_assignments.filter(a => a.error_message).map((a, idx) => (
            <p key={idx} className="text-sm text-red-700">
              <strong>Delivery Error:</strong> {a.error_message}
            </p>
          ))}
        </div>
      )}
    </div>
  );
};

export default PurchaseItem;
