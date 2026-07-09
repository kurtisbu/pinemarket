import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Mail, Send } from 'lucide-react';

const AdminFoundingSellerInvite: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    recipientEmail: '',
    firstName: '',
    accessCode: '',
  });

  const update = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.recipientEmail.trim()) {
      toast({ title: 'Recipient email required', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-founding-seller-invite', {
        body: form,
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: 'Invite sent', description: `Delivered to ${form.recipientEmail}` });
      setForm({ recipientEmail: '', firstName: '', accessCode: '' });
    } catch (err: any) {
      toast({
        title: 'Failed to send invite',
        description: err.message || 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="w-5 h-5" />
          Founding Seller Invite
        </CardTitle>
        <CardDescription>
          Send a branded invite email offering 0% platform fees for 6 months. Include an
          access code from the Access Codes tab so the recipient can complete seller onboarding.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSend} className="space-y-4 max-w-md">
          <div>
            <Label htmlFor="recipientEmail">Recipient email</Label>
            <Input
              id="recipientEmail"
              type="email"
              value={form.recipientEmail}
              onChange={(e) => update('recipientEmail', e.target.value)}
              placeholder="trader@example.com"
              required
            />
          </div>
          <div>
            <Label htmlFor="firstName">First name (optional)</Label>
            <Input
              id="firstName"
              value={form.firstName}
              onChange={(e) => update('firstName', e.target.value)}
              placeholder="Alex"
            />
          </div>
          <div>
            <Label htmlFor="accessCode">Access code (optional)</Label>
            <Input
              id="accessCode"
              value={form.accessCode}
              onChange={(e) => update('accessCode', e.target.value)}
              placeholder="FOUNDER-XXXX"
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            <Send className="w-4 h-4 mr-2" />
            {loading ? 'Sending...' : 'Send invite'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default AdminFoundingSellerInvite;