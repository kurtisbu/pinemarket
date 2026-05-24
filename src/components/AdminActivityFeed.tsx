import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UserPlus, CheckCircle2, Rocket, Activity, RefreshCw } from 'lucide-react';

interface ActivityEvent {
  event_type: 'signup' | 'seller_onboarded' | 'first_program_published';
  event_at: string;
  user_id: string;
  username: string | null;
  display_name: string | null;
  resource_id: string | null;
  resource_title: string | null;
  metadata: Record<string, any> | null;
}

type FilterType = 'all' | ActivityEvent['event_type'];

const EVENT_META: Record<ActivityEvent['event_type'], { label: string; icon: React.ComponentType<any>; color: string }> = {
  signup: { label: 'New Signup', icon: UserPlus, color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  seller_onboarded: { label: 'Seller Onboarded', icon: CheckCircle2, color: 'bg-green-500/10 text-green-600 dark:text-green-400' },
  first_program_published: { label: 'First Program Published', icon: Rocket, color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
};

const formatRelative = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
};

const AdminActivityFeed: React.FC = () => {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');

  const fetchEvents = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_admin_activity_feed', { p_limit: 200 });
    if (!error && data) setEvents(data as ActivityEvent[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const filtered = filter === 'all' ? events : events.filter((e) => e.event_type === filter);

  const counts = {
    signup: events.filter((e) => e.event_type === 'signup').length,
    seller_onboarded: events.filter((e) => e.event_type === 'seller_onboarded').length,
    first_program_published: events.filter((e) => e.event_type === 'first_program_published').length,
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {(Object.keys(EVENT_META) as ActivityEvent['event_type'][]).map((type) => {
          const meta = EVENT_META[type];
          const Icon = meta.icon;
          return (
            <Card key={type}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{meta.label}</p>
                    <p className="text-3xl font-bold">{counts[type]}</p>
                  </div>
                  <div className={`p-3 rounded-full ${meta.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Activity Feed
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              {(['all', 'signup', 'seller_onboarded', 'first_program_published'] as FilterType[]).map((f) => (
                <Button
                  key={f}
                  variant={filter === f ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter(f)}
                >
                  {f === 'all' ? 'All' : EVENT_META[f].label}
                </Button>
              ))}
              <Button variant="outline" size="sm" onClick={fetchEvents} disabled={loading}>
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading activity...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No activity to show.</div>
          ) : (
            <div className="space-y-2">
              {filtered.map((e, idx) => {
                const meta = EVENT_META[e.event_type];
                const Icon = meta.icon;
                const name = e.display_name || e.username || 'Anonymous User';
                return (
                  <div
                    key={`${e.event_type}-${e.user_id}-${e.event_at}-${idx}`}
                    className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className={`p-2 rounded-full ${meta.color} shrink-0`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary">{meta.label}</Badge>
                        <span className="font-medium truncate">{name}</span>
                        {e.username && (
                          <span className="text-sm text-muted-foreground">@{e.username}</span>
                        )}
                      </div>
                      {e.resource_title && (
                        <p className="text-sm text-muted-foreground mt-1 truncate">
                          {e.resource_title}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatRelative(e.event_at)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminActivityFeed;