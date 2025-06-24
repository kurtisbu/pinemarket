
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, ExternalLink, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

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

interface UserPurchasesProps {
  userId: string;
}

const UserPurchases: React.FC<UserPurchasesProps> = ({ userId }) => {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchPurchases();
  }, [userId]);

  const fetchPurchases = async () => {
    try {
      const { data, error } = await supabase
        .from('purchases')
        .select(`
          id,
          amount,
          status,
          purchased_at,
          tradingview_username,
          programs (
            id,
            title,
            description,
            category,
            image_urls
          ),
          script_assignments (
            status,
            assigned_at,
            error_message
          )
        `)
        .eq('buyer_id', userId)
        .order('purchased_at', { ascending: false });

      if (error) throw error;
      setPurchases(data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to fetch purchases',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
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

  const getAssignmentStatus = (assignments: any[]) => {
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

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Purchases</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-muted rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (purchases.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Purchases</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>You haven't purchased any scripts yet.</p>
            <Button asChild className="mt-4">
              <a href="/browse">Browse Scripts</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Purchases ({purchases.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {purchases.map((purchase) => (
          <div key={purchase.id} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{purchase.programs.title}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {purchase.programs.description}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline">{purchase.programs.category}</Badge>
                  {getStatusBadge(purchase.status)}
                  {getAssignmentStatus(purchase.script_assignments)}
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
        ))}
      </CardContent>
    </Card>
  );
};

export default UserPurchases;
