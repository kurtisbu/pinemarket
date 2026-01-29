import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, AlertCircle, Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface BankAccount {
  id: string;
  user_id: string;
  payout_method: string;
  bank_account_holder_name: string;
  bank_account_number: string;
  bank_routing_number: string;
  bank_name: string;
  country: string;
  currency: string;
  is_verified: boolean;
  created_at: string;
  profiles: {
    display_name: string;
    username: string;
  };
}

export function AdminBankVerification() {
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [pendingAccounts, setPendingAccounts] = useState<BankAccount[]>([]);
  const [verifiedAccounts, setVerifiedAccounts] = useState<BankAccount[]>([]);
  const { toast } = useToast();

  const fetchAccounts = async () => {
    try {
      setLoading(true);

      // Fetch pending accounts
      const { data: pending, error: pendingError } = await supabase
        .from('seller_payout_info')
        .select('*')
        .eq('is_verified', false)
        .eq('payout_method', 'bank_transfer')
        .order('created_at', { ascending: false });

      if (pendingError) throw pendingError;

      // Fetch verified accounts
      const { data: verified, error: verifiedError } = await supabase
        .from('seller_payout_info')
        .select('*')
        .eq('is_verified', true)
        .eq('payout_method', 'bank_transfer')
        .order('created_at', { ascending: false })
        .limit(20);

      if (verifiedError) throw verifiedError;

      // Enrich with profile data
      const enrichWithProfiles = async (accounts: any[]) => {
        return Promise.all(
          accounts.map(async (account) => {
            const { data: profile } = await supabase
              .from('profiles')
              .select('display_name, username')
              .eq('id', account.user_id)
              .single();

            return {
              ...account,
              profiles: profile || { display_name: 'Unknown', username: 'unknown' }
            };
          })
        );
      };

      const enrichedPending = await enrichWithProfiles(pending || []);
      const enrichedVerified = await enrichWithProfiles(verified || []);

      setPendingAccounts(enrichedPending);
      setVerifiedAccounts(enrichedVerified);
    } catch (error: any) {
      console.error('Error fetching accounts:', error);
      toast({
        title: "Error",
        description: "Failed to load bank accounts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const verifyAccount = async (userId: string, approve: boolean) => {
    try {
      setVerifying(userId);

      if (approve) {
        const { error } = await supabase.rpc('verify_seller_bank_account', {
          p_user_id: userId
        });

        if (error) throw error;

        toast({
          title: "Success",
          description: "Bank account verified successfully",
        });
      } else {
        // Reject by deleting the account info
        const { error } = await supabase
          .from('seller_payout_info')
          .delete()
          .eq('user_id', userId);

        if (error) throw error;

        toast({
          title: "Rejected",
          description: "Bank account information has been rejected",
        });
      }

      await fetchAccounts();
    } catch (error: any) {
      console.error('Error verifying account:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to verify account",
        variant: "destructive",
      });
    } finally {
      setVerifying(null);
    }
  };

  const maskAccountNumber = (accountNumber: string) => {
    if (!accountNumber || accountNumber.length < 4) return '****';
    return '****' + accountNumber.slice(-4);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pending Verifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            Pending Bank Account Verifications
          </CardTitle>
          <CardDescription>
            Review and verify seller bank account information before enabling payouts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingAccounts.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No pending verifications
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Seller</TableHead>
                  <TableHead>Account Holder</TableHead>
                  <TableHead>Bank Name</TableHead>
                  <TableHead>Account Number</TableHead>
                  <TableHead>Routing Number</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingAccounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{account.profiles.display_name}</div>
                        <div className="text-sm text-muted-foreground">@{account.profiles.username}</div>
                      </div>
                    </TableCell>
                    <TableCell>{account.bank_account_holder_name}</TableCell>
                    <TableCell>{account.bank_name || 'N/A'}</TableCell>
                    <TableCell className="font-mono">
                      {maskAccountNumber(account.bank_account_number)}
                    </TableCell>
                    <TableCell className="font-mono">{account.bank_routing_number}</TableCell>
                    <TableCell>{account.country}</TableCell>
                    <TableCell>{account.currency}</TableCell>
                    <TableCell>
                      {new Date(account.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => verifyAccount(account.user_id, true)}
                          disabled={verifying === account.user_id}
                        >
                          {verifying === account.user_id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Approve
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => verifyAccount(account.user_id, false)}
                          disabled={verifying === account.user_id}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Verified Accounts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Verified Bank Accounts
          </CardTitle>
          <CardDescription>
            Recently verified bank accounts (last 20)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {verifiedAccounts.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No verified accounts yet
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Seller</TableHead>
                  <TableHead>Account Holder</TableHead>
                  <TableHead>Bank Name</TableHead>
                  <TableHead>Account Number</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Verified Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {verifiedAccounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{account.profiles.display_name}</div>
                        <div className="text-sm text-muted-foreground">@{account.profiles.username}</div>
                      </div>
                    </TableCell>
                    <TableCell>{account.bank_account_holder_name}</TableCell>
                    <TableCell>{account.bank_name || 'N/A'}</TableCell>
                    <TableCell className="font-mono">
                      {maskAccountNumber(account.bank_account_number)}
                    </TableCell>
                    <TableCell>{account.country}</TableCell>
                    <TableCell>
                      <Badge variant="default" className="bg-green-500">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Verified
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(account.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
