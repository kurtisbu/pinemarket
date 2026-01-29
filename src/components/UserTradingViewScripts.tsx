
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { RefreshCw, ExternalLink, Pencil, Check, X } from 'lucide-react';

interface TradingViewScript {
  id: string;
  title: string;
  publication_url: string;
  image_url: string | null;
  likes: number;
  reviews_count: number;
  last_synced_at: string;
  pine_id: string | null;
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [saving, setSaving] = useState(false);

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

  const startEditing = (script: TradingViewScript) => {
    setEditingId(script.id);
    setEditTitle(script.title);
    setEditUrl(script.publication_url);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditTitle('');
    setEditUrl('');
  };

  const saveEdit = async () => {
    if (!editingId) return;
    
    // Validate URL format
    if (editUrl && !editUrl.startsWith('https://www.tradingview.com/script/')) {
      toast({ 
        title: 'Invalid URL', 
        description: 'URL must start with https://www.tradingview.com/script/', 
        variant: 'destructive' 
      });
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from('tradingview_scripts')
      .update({ 
        title: editTitle.trim() || 'Untitled Script',
        publication_url: editUrl.trim() || `https://www.tradingview.com/u/${profileId}/#published-scripts`
      })
      .eq('id', editingId)
      .eq('user_id', profileId);

    if (error) {
      toast({ title: 'Error saving', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Saved', description: 'Script details updated successfully.' });
      await fetchScripts();
      cancelEditing();
    }
    setSaving(false);
  };

  const isFallbackUrl = (url: string) => url.includes('#published-scripts');
  const isFallbackTitle = (title: string) => title.startsWith('Script ') && title.length < 20;

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
            <Card key={script.id} className={editingId === script.id ? 'ring-2 ring-primary' : ''}>
              <CardHeader className="p-0">
                {script.image_url && <img src={script.image_url} alt={script.title} className="w-full h-32 object-cover rounded-t-lg" />}
              </CardHeader>
              <CardContent className="p-4">
                {editingId === script.id ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Title</label>
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Script title"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Publication URL</label>
                      <Input
                        value={editUrl}
                        onChange={(e) => setEditUrl(e.target.value)}
                        placeholder="https://www.tradingview.com/script/..."
                        className="mt-1"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveEdit} disabled={saving}>
                        <Check className="w-4 h-4 mr-1" />
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={cancelEditing} disabled={saving}>
                        <X className="w-4 h-4 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <a 
                        href={script.publication_url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className={`font-semibold hover:underline flex items-center ${isFallbackUrl(script.publication_url) || isFallbackTitle(script.title) ? 'text-warning' : ''}`}
                      >
                        {script.title} <ExternalLink className="w-3 h-3 ml-1 flex-shrink-0" />
                      </a>
                      {isOwner && (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => startEditing(script)}
                          className="flex-shrink-0"
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                    
                    {(isFallbackUrl(script.publication_url) || isFallbackTitle(script.title)) && isOwner && (
                      <p className="text-xs text-warning mt-1">
                        Click edit to set the correct title/URL
                      </p>
                    )}
                    
                    <div className="flex justify-between items-center text-sm text-muted-foreground mt-2">
                      <span>Likes: {script.likes}</span>
                      <span>Comments: {script.reviews_count}</span>
                    </div>
                    
                    {script.pine_id && (
                      <p className="text-xs text-muted-foreground mt-2 font-mono truncate" title={script.pine_id}>
                        ID: {script.pine_id.slice(0, 20)}...
                      </p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserTradingViewScripts;
