import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FlaskConical, Trash2, Loader2, Copy, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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
