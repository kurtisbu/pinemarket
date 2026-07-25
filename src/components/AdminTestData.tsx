import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FlaskConical, Trash2, Loader2, Copy, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useQuery } from '@tanstack/react-query';

const TestAccountsPanel = () => {
  const { toast } = useToast();
  const [userId, setUserId] = useState('');
  const [busy, setBusy] = useState<'on' | 'off' | null>(null);

  const { data: testAccounts, refetch, isLoading } = useQuery({
    queryKey: ['admin-test-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_test_accounts');
      if (error) throw error;
      return data || [];
    },
  });

  const setFlag = async (isTest: boolean) => {
    if (!userId.trim()) return;
    setBusy(isTest ? 'on' : 'off');
    try {
      const { error } = await supabase.rpc('admin_set_test_account', {
        _user_id: userId.trim(),
        _is_test: isTest,
      });
      if (error) throw error;
      toast({ title: isTest ? 'Marked as test account' : 'Removed test flag', description: 'Programs for this user were also updated.' });
      setUserId('');
      refetch();
    } catch (err: any) {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="w-5 h-5" />
          Test Accounts
        </CardTitle>
        <CardDescription>
          Toggle an existing account into test mode. Test accounts route through Stripe sandbox and are isolated from live listings, purchases, and payouts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input placeholder="User ID (uuid)" value={userId} onChange={(e) => setUserId(e.target.value)} className="font-mono text-sm" />
          <Button onClick={() => setFlag(true)} disabled={!userId.trim() || busy !== null}>
            {busy === 'on' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Mark test'}
          </Button>
          <Button variant="outline" onClick={() => setFlag(false)} disabled={!userId.trim() || busy !== null}>
            {busy === 'off' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Unmark'}
          </Button>
        </div>

        <Alert>
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>
            Marking an account as test clears its Stripe Connect fields so the user re-onboards in sandbox mode next time.
          </AlertDescription>
        </Alert>

        <div>
          <h3 className="font-semibold mb-2">Current test accounts {isLoading ? '' : `(${testAccounts?.length || 0})`}</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Display Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Stripe</TableHead>
                <TableHead>TradingView</TableHead>
                <TableHead>User ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(testAccounts || []).map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell>{a.username}</TableCell>
                  <TableCell>{a.display_name}</TableCell>
                  <TableCell className="font-mono text-xs">{a.email}</TableCell>
                  <TableCell>{a.stripe_charges_enabled ? <Badge>Ready</Badge> : <Badge variant="outline">Pending</Badge>}</TableCell>
                  <TableCell>{a.is_tradingview_connected ? <Badge>Connected</Badge> : <Badge variant="outline">No</Badge>}</TableCell>
                  <TableCell className="font-mono text-xs">{a.id}</TableCell>
                </TableRow>
              ))}
              {(!testAccounts || testAccounts.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground text-sm py-4">
                    No test accounts yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

const AdminTestData = () => {
  const { toast } = useToast();
  const [seeding, setSeeding] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [seedResult, setSeedResult] = useState<any>(null);
  const [cleanResult, setCleanResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSeed = async () => {
    setSeeding(true);
    setError(null);
    setSeedResult(null);
    setCleanResult(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('seed-test-data', {
        body: { action: 'seed' },
      });

      if (fnError) throw fnError;
      if (data?.error) {
        setError(data.error);
        if (data.existingEmails) {
          setError(`${data.error} (${data.existingEmails.join(', ')})`);
        }
        return;
      }

      setSeedResult(data);
      toast({ title: 'Test data seeded successfully', description: `Created ${data.summary.sellersCreated} sellers, ${data.summary.buyersCreated} buyers, ${data.summary.programsCreated} programs.` });
    } catch (err: any) {
      setError(err.message || 'Failed to seed test data');
      toast({ title: 'Seed failed', description: err.message, variant: 'destructive' });
    } finally {
      setSeeding(false);
    }
  };

  const handleCleanup = async () => {
    setCleaning(true);
    setError(null);
    setSeedResult(null);
    setCleanResult(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('seed-test-data', {
        body: { action: 'cleanup' },
      });

      if (fnError) throw fnError;
      if (data?.error) {
        setError(data.error);
        return;
      }

      setCleanResult(data);
      toast({ title: 'Cleanup complete', description: data.message });
    } catch (err: any) {
      setError(err.message || 'Failed to clean up test data');
      toast({ title: 'Cleanup failed', description: err.message, variant: 'destructive' });
    } finally {
      setCleaning(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard' });
  };

  return (
    <div className="space-y-6">
      <TestAccountsPanel />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5" />
            Test Data Management
          </CardTitle>
          <CardDescription>
            Seed the marketplace with test sellers, buyers, and programs using your real TradingView credentials and script portfolio. All test accounts use the password <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">TestPass123!</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Button onClick={handleSeed} disabled={seeding || cleaning}>
              {seeding ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FlaskConical className="w-4 h-4 mr-2" />}
              Seed Test Data
            </Button>
            <Button variant="destructive" onClick={handleCleanup} disabled={seeding || cleaning}>
              {cleaning ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Cleanup Test Data
            </Button>
          </div>

          <Alert>
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              Programs are created in <Badge variant="secondary">draft</Badge> status. To test purchases, manually publish them via the admin SQL editor or update their status. Test sellers share your TradingView cookies for real script assignment testing.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {seedResult && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                Seed Results
              </CardTitle>
              <CardDescription>
                {seedResult.summary.sellersCreated} sellers, {seedResult.summary.buyersCreated} buyers, {seedResult.summary.programsCreated} programs created
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">Test Accounts</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Role</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Display Name</TableHead>
                      <TableHead>Password</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {seedResult.sellers.map((s: any) => (
                      <TableRow key={s.id}>
                        <TableCell><Badge>Seller</Badge></TableCell>
                        <TableCell className="font-mono text-sm">{s.email}</TableCell>
                        <TableCell>{s.displayName}</TableCell>
                        <TableCell className="font-mono text-sm">{seedResult.credentials.password}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => copyToClipboard(s.email)}>
                            <Copy className="w-3 h-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {seedResult.buyers.map((b: any) => (
                      <TableRow key={b.id}>
                        <TableCell><Badge variant="outline">Buyer</Badge></TableCell>
                        <TableCell className="font-mono text-sm">{b.email}</TableCell>
                        <TableCell>{b.displayName}</TableCell>
                        <TableCell className="font-mono text-sm">{seedResult.credentials.password}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => copyToClipboard(b.email)}>
                            <Copy className="w-3 h-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Created Programs</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Seller</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Pricing</TableHead>
                      <TableHead>Trial</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {seedResult.programs.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.title}</TableCell>
                        <TableCell>{p.seller}</TableCell>
                        <TableCell><Badge variant="secondary">{p.category}</Badge></TableCell>
                        <TableCell className="text-sm">
                          {p.price > 0 && <div>${p.price} one-time</div>}
                          {p.monthlyPrice && <div>${p.monthlyPrice}/mo</div>}
                          {p.yearlyPrice && <div>${p.yearlyPrice}/yr</div>}
                        </TableCell>
                        <TableCell>
                          {p.trialDays > 0 ? <Badge variant="outline">{p.trialDays}-day</Badge> : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {cleanResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              Cleanup Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold">{cleanResult.counts.deletedUsers || 0}</div>
                <div className="text-sm text-muted-foreground">Users Deleted</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold">{cleanResult.counts.deletedPrograms || 0}</div>
                <div className="text-sm text-muted-foreground">Programs Deleted</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold">{cleanResult.counts.deletedPrices || 0}</div>
                <div className="text-sm text-muted-foreground">Prices Deleted</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold">{cleanResult.counts.deletedScriptLinks || 0}</div>
                <div className="text-sm text-muted-foreground">Script Links Deleted</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminTestData;
