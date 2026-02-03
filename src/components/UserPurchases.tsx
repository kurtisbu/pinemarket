import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import PurchaseItem from './PurchaseItem';

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
  script_assignments?: Array<{
    status: string;
    assigned_at: string | null;
    error_message: string | null;
  }>;
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
          <PurchaseItem key={purchase.id} purchase={purchase} />
        ))}
      </CardContent>
    </Card>
  );
};

export default UserPurchases;
