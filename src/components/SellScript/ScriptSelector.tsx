import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, AlertCircle, Check, ExternalLink } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface TradingViewScript {
  id: string;
  title: string;
  pine_id: string | null;
  publication_url: string;
  image_url: string | null;
}

interface ScriptSelectorProps {
  selectedScripts: string[];
  onSelectionChange: (selectedIds: string[]) => void;
}

const ScriptSelector: React.FC<ScriptSelectorProps> = ({
  selectedScripts,
  onSelectionChange,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [scripts, setScripts] = useState<TradingViewScript[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchScripts = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tradingview_scripts')
        .select('id, title, pine_id, publication_url, image_url')
        .eq('user_id', user.id)
        .order('title');

      if (error) throw error;
      setScripts(data || []);
    } catch (error: any) {
      console.error('Failed to fetch scripts:', error);
      toast({
        title: 'Failed to load scripts',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScripts();
  }, [user]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('tradingview-service', {
        body: { action: 'syncUserScripts' },
      });

      if (error) throw error;

      toast({
        title: 'Sync complete',
        description: `Found ${data.scripts?.length || 0} published scripts`,
      });

      await fetchScripts();
    } catch (error: any) {
      console.error('Sync failed:', error);
      toast({
        title: 'Sync failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };

  const toggleScript = (scriptId: string) => {
    if (selectedScripts.includes(scriptId)) {
      onSelectionChange(selectedScripts.filter(id => id !== scriptId));
    } else {
      onSelectionChange([...selectedScripts, scriptId]);
    }
  };

  const selectAll = () => {
    onSelectionChange(scripts.map(s => s.id));
  };

  const deselectAll = () => {
    onSelectionChange([]);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Label>Select Scripts to Include *</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <Label className="text-base">Select Scripts to Include *</Label>
          <p className="text-sm text-muted-foreground">
            Choose one or more scripts from your synced TradingView account
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={syncing}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync with TradingView'}
        </Button>
      </div>

      {scripts.length === 0 ? (
        <Card className="p-6 text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">No scripts found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Sync your TradingView account to see your published scripts
          </p>
          <Button
            type="button"
            onClick={handleSync}
            disabled={syncing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            Sync Now
          </Button>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Badge variant={selectedScripts.length > 0 ? "default" : "secondary"}>
                {selectedScripts.length} selected
              </Badge>
              {scripts.length > 1 && (
                <div className="flex gap-2 text-sm">
                  <button
                    type="button"
                    onClick={selectAll}
                    className="text-primary hover:underline"
                  >
                    Select all
                  </button>
                  <span className="text-muted-foreground">|</span>
                  <button
                    type="button"
                    onClick={deselectAll}
                    className="text-primary hover:underline"
                  >
                    Deselect all
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {scripts.map(script => {
              const isSelected = selectedScripts.includes(script.id);
              return (
                <Card
                  key={script.id}
                  className={`relative cursor-pointer transition-all hover:shadow-md ${
                    isSelected
                      ? 'ring-2 ring-primary bg-primary/5'
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={(e) => {
                    // Prevent double-toggle when clicking checkbox directly
                    if ((e.target as HTMLElement).closest('button[role="checkbox"]')) {
                      return;
                    }
                    toggleScript(script.id);
                  }}
                >
                  <div className="p-4">
                    {script.image_url && (
                      <div className="aspect-video mb-3 rounded-md overflow-hidden bg-muted">
                        <img
                          src={script.image_url}
                          alt={script.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleScript(script.id)}
                        className="mt-1"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm line-clamp-2">
                          {script.title}
                        </h4>
                        {script.pine_id && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {script.pine_id.replace('PUB;', '').slice(0, 12)}...
                          </p>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                        <Check className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {selectedScripts.length === 0 && scripts.length > 0 && (
        <p className="text-sm text-destructive">
          Please select at least one script
        </p>
      )}
    </div>
  );
};

export default ScriptSelector;
