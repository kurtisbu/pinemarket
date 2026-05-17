import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  STATUS_LABEL,
  STATUS_VARIANT,
  CATEGORY_LABEL,
  PRIORITY_LABEL,
} from '@/components/support/supportConstants';
import { format, formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Send, Lock } from 'lucide-react';

interface Ticket {
  id: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  email: string;
  display_name: string | null;
  user_id: string | null;
  last_message_at: string;
  created_at: string;
}

interface Message {
  id: string;
  ticket_id: string;
  author_id: string | null;
  author_type: string;
  author_name: string | null;
  body: string;
  is_internal_note: boolean;
  created_at: string;
}

const STATUS_FILTERS = ['all', 'open', 'in_progress', 'waiting_user', 'resolved', 'closed'];

const AdminSupportTickets: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadTickets = async () => {
    const { data } = await supabase
      .from('support_tickets')
      .select('*')
      .order('last_message_at', { ascending: false })
      .limit(200);
    setTickets((data as Ticket[]) || []);
  };

  const loadMessages = async (ticketId: string) => {
    const { data } = await supabase
      .from('support_ticket_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });
    setMessages((data as Message[]) || []);
  };

  useEffect(() => {
    loadTickets();
  }, []);

  useEffect(() => {
    if (selectedId) loadMessages(selectedId);
  }, [selectedId]);

  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (
          !t.subject.toLowerCase().includes(s) &&
          !t.email.toLowerCase().includes(s) &&
          !(t.display_name || '').toLowerCase().includes(s)
        )
          return false;
      }
      return true;
    });
  }, [tickets, statusFilter, search]);

  const selected = tickets.find((t) => t.id === selectedId) || null;

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !user || !reply.trim()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('support_ticket_messages').insert({
        ticket_id: selected.id,
        author_id: user.id,
        author_type: 'admin',
        author_name: 'PineMarket Support',
        body: reply.trim(),
        is_internal_note: isInternal,
      });
      if (error) throw error;
      setReply('');
      if (!isInternal) {
        supabase.functions
          .invoke('send-support-notification', {
            body: { ticketId: selected.id, kind: 'admin_reply' },
          })
          .catch(() => {});
      }
      await Promise.all([loadMessages(selected.id), loadTickets()]);
    } catch (err: any) {
      toast({ title: 'Reply failed', description: err?.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const updateTicket = async (patch: Partial<Ticket>) => {
    if (!selected) return;
    const { error } = await supabase
      .from('support_tickets')
      .update(patch as any)
      .eq('id', selected.id);
    if (error) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
      return;
    }
    await loadTickets();
  };

  if (selected) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to tickets
        </Button>
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Badge variant={STATUS_VARIANT[selected.status] || 'secondary'}>
                    {STATUS_LABEL[selected.status]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {CATEGORY_LABEL[selected.category]}
                  </span>
                </div>
                <CardTitle className="text-xl">{selected.subject}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  From: {selected.display_name ? `${selected.display_name} ` : ''}
                  &lt;{selected.email}&gt; · Opened {format(new Date(selected.created_at), 'PPp')}
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Select value={selected.status} onValueChange={(v) => updateTicket({ status: v })}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABEL).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selected.priority} onValueChange={(v) => updateTicket({ priority: v })}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_LABEL).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="space-y-3">
          {messages.map((m) => {
            const isAdmin = m.author_type === 'admin';
            return (
              <Card
                key={m.id}
                className={
                  m.is_internal_note
                    ? 'border-amber-500/50 bg-amber-500/5'
                    : isAdmin
                    ? 'border-primary/40 bg-primary/5'
                    : ''
                }
              >
                <CardContent className="py-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium flex items-center gap-1">
                      {m.is_internal_note && <Lock className="w-3 h-3" />}
                      {isAdmin ? 'PineMarket Support' : m.author_name || selected.email}
                      {m.is_internal_note && (
                        <span className="text-xs text-muted-foreground ml-1">(internal note)</span>
                      )}
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

        <Card>
          <CardContent className="py-4">
            <form onSubmit={handleReply} className="space-y-3">
              <Textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={5}
                maxLength={5000}
                placeholder={isInternal ? 'Private note (only admins see this)…' : 'Write a reply…'}
              />
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="internal"
                    checked={isInternal}
                    onCheckedChange={(v) => setIsInternal(v === true)}
                  />
                  <Label htmlFor="internal" className="text-sm cursor-pointer">
                    Internal note (not visible to user)
                  </Label>
                </div>
                <Button type="submit" disabled={submitting || !reply.trim()}>
                  <Send className="w-4 h-4 mr-1" />
                  {submitting ? 'Sending…' : isInternal ? 'Save note' : 'Send reply'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((s) => (
              <SelectItem key={s} value={s}>
                {s === 'all' ? 'All statuses' : STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Search subject or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <span className="text-sm text-muted-foreground ml-auto">
          {filtered.length} ticket{filtered.length === 1 ? '' : 's'}
        </span>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No tickets match these filters.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => (
            <Card
              key={t.id}
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => setSelectedId(t.id)}
            >
              <CardContent className="py-3 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge variant={STATUS_VARIANT[t.status] || 'secondary'}>
                      {STATUS_LABEL[t.status]}
                    </Badge>
                    {t.priority !== 'normal' && (
                      <Badge variant="outline">{PRIORITY_LABEL[t.priority]}</Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {CATEGORY_LABEL[t.category]}
                    </span>
                  </div>
                  <p className="font-medium truncate">{t.subject}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {t.display_name ? `${t.display_name} · ` : ''}{t.email}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDistanceToNow(new Date(t.last_message_at), { addSuffix: true })}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminSupportTickets;