
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, ExternalLink } from 'lucide-react';

interface TradingViewScript {
  id: string;
  title: string;
  publication_url: string;
  image_url: string | null;
  likes: number;
  reviews_count: number;
  last_synced_at: string;
}

interface UserTradingViewScriptsProps {
  profileId: string;
  isOwner: boolean;
}

const UserTradingViewScripts: React.FC<UserTradingViewScriptsProps> = ({ profileId, isOwner }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [scripts, setScripts] = useState<TradingViewScript[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchScripts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tradingview_scripts')
      .select('*')
      .eq('user_id', profileId)
      .order('last_synced_at', { ascending: false });

    if (error) {
      toast({ title: 'Error fetching scripts', description: error.message, variant: 'destructive' });
    } else {
      setScripts(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (profileId) {
      fetchScripts();
    }
  }, [profileId]);

  const handleSync = async () => {
    if (!user) return;
    setSyncing(true);
    toast({ title: 'Syncing with TradingView...', description: 'This may take a moment.' });
    
    const { data, error } = await supabase.functions.invoke('tradingview-service', {
      body: { action: 'sync-user-scripts', user_id: user.id },
    });

    if (error || data.error) {
      toast({ title: 'Sync Failed', description: error?.message || data.error, variant: 'destructive' });
    } else {
      toast({ title: 'Sync Successful', description: data.message });
      await fetchScripts();
    }
    setSyncing(false);
  };

  return (
    <div className="border-t pt-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">TradingView Publications</h3>
        {isOwner && (
          <Button onClick={handleSync} disabled={syncing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync with TradingView'}
          </Button>
        )}
      </div>

      {loading ? (
        <p>Loading scripts...</p>
      ) : scripts.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>No TradingView scripts found.</p>
          {isOwner && <p className="mt-2">Click the sync button to fetch your public scripts.</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {scripts.map(script => (
            <Card key={script.id}>
              <CardHeader className="p-0">
                {script.image_url && <img src={script.image_url} alt={script.title} className="w-full h-32 object-cover rounded-t-lg" />}
              </CardHeader>
              <CardContent className="p-4">
                <a href={script.publication_url} target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline flex items-center">
                  {script.title} <ExternalLink className="w-3 h-3 ml-1" />
                </a>
                <div className="flex justify-between items-center text-sm text-muted-foreground mt-2">
                  <span>Likes: {script.likes}</span>
                  <span>Comments: {script.reviews_count}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserTradingViewScripts;
