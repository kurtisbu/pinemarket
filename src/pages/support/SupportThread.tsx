import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { ArrowLeft, CheckCircle2, Send } from 'lucide-react';
import {
  STATUS_LABEL,
  STATUS_VARIANT,
  CATEGORY_LABEL,
} from '@/components/support/supportConstants';
import { format } from 'date-fns';

interface Ticket {
  id: string;
  subject: string;
  category: string;
  status: string;
  email: string;
  display_name: string | null;
  user_id: string | null;
  created_at: string;
}

interface Message {
  id: string;
  author_type: string;
  author_name: string | null;
  body: string;
  created_at: string;
  is_internal_note: boolean;
}

const SupportThread: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    if (!id) return;
    const [{ data: t }, { data: m }] = await Promise.all([
      supabase.from('support_tickets').select('*').eq('id', id).single(),
      supabase
        .from('support_ticket_messages')
        .select('*')
        .eq('ticket_id', id)
        .order('created_at', { ascending: true }),
    ]);
    setTicket((t as Ticket) || null);
    setMessages((m as Message[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user]);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim() || !user || !ticket) return;
    if (reply.length > 5000) {
      toast({ title: 'Reply too long', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('support_ticket_messages').insert({
        ticket_id: ticket.id,
        author_id: user.id,
        author_type: 'user',
        author_name: ticket.display_name || user.email,
        body: reply.trim(),
      });
      if (error) throw error;
      setReply('');
      await load();
      supabase.functions
        .invoke('send-support-notification', {
          body: { ticketId: ticket.id, kind: 'user_reply' },
        })
        .catch(() => {});
    } catch (err: any) {
      toast({ title: 'Could not send reply', description: err?.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const markResolved = async () => {
    if (!ticket) return;
    const { error } = await supabase
      .from('support_tickets')
      .update({ status: 'resolved' })
      .eq('id', ticket.id);
    if (error) {
      toast({ title: 'Could not update', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Marked as resolved' });
    load();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8">Loading…</main>
        <Footer />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8">
          <p>Ticket not found.</p>
          <Button asChild variant="link"><Link to="/support">Back to support</Link></Button>
        </main>
        <Footer />
      </div>
    );
  }

  const visibleMessages = messages.filter((m) => !m.is_internal_note);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-3xl">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link to="/support"><ArrowLeft className="w-4 h-4 mr-1" /> All tickets</Link>
        </Button>

        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={STATUS_VARIANT[ticket.status] || 'secondary'}>
                    {STATUS_LABEL[ticket.status] || ticket.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {CATEGORY_LABEL[ticket.category] || ticket.category}
                  </span>
                </div>
                <h1 className="text-2xl font-bold">{ticket.subject}</h1>
                <p className="text-xs text-muted-foreground mt-1">
                  Opened {format(new Date(ticket.created_at), 'PPp')}
                </p>
              </div>
              {ticket.status !== 'resolved' && ticket.status !== 'closed' && (
                <Button variant="outline" size="sm" onClick={markResolved}>
                  <CheckCircle2 className="w-4 h-4 mr-1" /> Mark resolved
                </Button>
              )}
            </div>
          </CardHeader>
        </Card>

        <div className="space-y-4 mb-6">
          {visibleMessages.map((m) => {
            const isAdmin = m.author_type === 'admin';
            return (
              <Card key={m.id} className={isAdmin ? 'border-primary/40 bg-primary/5' : ''}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">
                      {isAdmin ? 'PineMarket Support' : m.author_name || 'You'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(m.created_at), 'PPp')}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{m.body}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {ticket.status !== 'closed' && (
          <Card>
            <CardContent className="py-4">
              <form onSubmit={handleReply} className="space-y-3">
                <Textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={5}
                  maxLength={5000}
                  placeholder="Write a reply…"
                />
                <div className="flex justify-end">
                  <Button type="submit" disabled={submitting || !reply.trim()}>
                    <Send className="w-4 h-4 mr-1" />
                    {submitting ? 'Sending…' : 'Send reply'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default SupportThread;