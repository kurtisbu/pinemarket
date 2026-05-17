import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { ArrowLeft, Send } from 'lucide-react';
import { CATEGORY_OPTIONS } from '@/components/support/supportConstants';

const schema = z.object({
  email: z.string().trim().email('Enter a valid email').max(255),
  display_name: z.string().trim().max(100).optional().or(z.literal('')),
  subject: z.string().trim().min(3, 'Subject is too short').max(200),
  category: z.string(),
  body: z.string().trim().min(10, 'Please describe the issue (10+ chars)').max(5000),
});

const SupportNew: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('other');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const relatedPurchaseId = params.get('purchase') || undefined;
  const relatedProgramId = params.get('program') || undefined;

  useEffect(() => {
    if (authLoading || !user) return;
    setEmail(user.email || '');
    supabase
      .from('profiles')
      .select('display_name, username')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) setDisplayName(data.display_name || data.username || '');
      });
  }, [user, authLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, display_name: displayName, subject, category, body });
    if (!parsed.success) {
      toast({
        title: 'Please fix the form',
        description: parsed.error.errors[0].message,
        variant: 'destructive',
      });
      return;
    }
    setSubmitting(true);
    try {
      const { data: ticket, error: tErr } = await supabase
        .from('support_tickets')
        .insert({
          user_id: user?.id ?? null,
          email: parsed.data.email,
          display_name: parsed.data.display_name || null,
          subject: parsed.data.subject,
          category: parsed.data.category as any,
          related_purchase_id: relatedPurchaseId || null,
          related_program_id: relatedProgramId || null,
        })
        .select('id')
        .single();
      if (tErr || !ticket) throw tErr || new Error('Failed to create ticket');

      const { error: mErr } = await supabase.from('support_ticket_messages').insert({
        ticket_id: ticket.id,
        author_id: user?.id ?? null,
        author_type: 'user',
        author_name: parsed.data.display_name || parsed.data.email,
        body: parsed.data.body,
      });
      if (mErr) throw mErr;

      // Fire-and-forget admin notification email
      supabase.functions
        .invoke('send-support-notification', {
          body: {
            ticketId: ticket.id,
            kind: 'new_ticket',
          },
        })
        .catch(() => {});

      toast({
        title: 'Ticket submitted',
        description: "We'll get back to you by email as soon as possible.",
      });
      if (user) {
        navigate(`/support/${ticket.id}`);
      } else {
        navigate('/support/new?sent=1');
        setSubject('');
        setBody('');
      }
    } catch (err: any) {
      toast({
        title: 'Could not submit ticket',
        description: err?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-2xl">
        {user && (
          <Button asChild variant="ghost" size="sm" className="mb-4">
            <Link to="/support"><ArrowLeft className="w-4 h-4 mr-1" /> All tickets</Link>
          </Button>
        )}
        <Card>
          <CardHeader>
            <CardTitle>Contact support</CardTitle>
            <p className="text-sm text-muted-foreground">
              Tell us what's going on and we'll reply by email.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!user && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="email">Your email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      maxLength={255}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Your name</Label>
                    <Input
                      id="name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      maxLength={100}
                    />
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">Subject *</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                  maxLength={200}
                  placeholder="Short summary of your issue"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="body">Message *</Label>
                <Textarea
                  id="body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  required
                  rows={8}
                  maxLength={5000}
                  placeholder="Describe what happened, what you expected, and any steps to reproduce."
                />
              </div>
              <Button type="submit" disabled={submitting} className="w-full">
                <Send className="w-4 h-4 mr-1" />
                {submitting ? 'Sending…' : 'Submit ticket'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default SupportNew;