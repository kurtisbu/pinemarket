import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, MessageSquare, LifeBuoy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { formatDistanceToNow } from 'date-fns';
import { STATUS_LABEL, STATUS_VARIANT, CATEGORY_LABEL } from '@/components/support/supportConstants';

interface Ticket {
  id: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  last_message_at: string;
  created_at: string;
}

const SupportList: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/support/new');
      return;
    }
    const load = async () => {
      const { data } = await supabase
        .from('support_tickets')
        .select('id, subject, category, status, priority, last_message_at, created_at')
        .order('last_message_at', { ascending: false });
      setTickets((data as Ticket[]) || []);
      setLoading(false);
    };
    load();
  }, [user, authLoading, navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <LifeBuoy className="w-7 h-7" />
              Support
            </h1>
            <p className="text-muted-foreground mt-1">
              Your support requests and conversations with the PineMarket team.
            </p>
          </div>
          <Button asChild>
            <Link to="/support/new">
              <Plus className="w-4 h-4 mr-1" /> New ticket
            </Link>
          </Button>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : tickets.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <MessageSquare className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              <h2 className="font-semibold mb-1">No tickets yet</h2>
              <p className="text-muted-foreground mb-4">
                Questions are welcome — open one whenever you need help.
              </p>
              <Button asChild>
                <Link to="/support/new">Open your first ticket</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {tickets.map((t) => (
              <Link key={t.id} to={`/support/${t.id}`}>
                <Card className="hover:border-primary transition-colors">
                  <CardContent className="py-4 flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={STATUS_VARIANT[t.status] || 'secondary'}>
                          {STATUS_LABEL[t.status] || t.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {CATEGORY_LABEL[t.category] || t.category}
                        </span>
                      </div>
                      <p className="font-medium truncate">{t.subject}</p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(t.last_message_at), { addSuffix: true })}
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default SupportList;