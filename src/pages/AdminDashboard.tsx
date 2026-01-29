
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Header from '@/components/Header';
import { Shield, Users, FileText, BarChart3, AlertTriangle, Clock, Star, DollarSign } from 'lucide-react';
import AdminScriptAssignments from '@/components/AdminScriptAssignments';
import SecurityAuditDashboard from '@/components/SecurityAuditDashboard';
import AdminTrialManagement from '@/components/AdminTrialManagement';
import AdminAccessCodes from '@/components/AdminAccessCodes';
import AdminFeaturedCreators from '@/components/AdminFeaturedCreators';
import { AdminPayoutManagement } from '@/components/AdminPayoutManagement';
import AdminPayoutDashboard from '@/components/AdminPayoutDashboard';
import { AdminBankVerification } from '@/components/AdminBankVerification';

const AdminDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  useEffect(() => {
    console.log('AdminDashboard - user state:', user);
    if (!user) {
      console.log('AdminDashboard - No user, redirecting to auth');
      navigate('/auth');
      return;
    }
    checkAdminAccess();
  }, [user, navigate]);

  const checkAdminAccess = async () => {
    if (!user) return;
    
    console.log('AdminDashboard - Checking admin access for user:', user.id);
    
    try {
      // Use secure server-side admin check
      const { data: isAdmin, error } = await supabase
        .rpc('is_current_user_admin');

      console.log('AdminDashboard - Admin check result:', { isAdmin, error });
      
      const debugData = {
        userId: user.id,
        userEmail: user.email,
        isAdmin: isAdmin,
        error: error?.message,
        timestamp: new Date().toISOString()
      };
      
      setDebugInfo(debugData);
      console.log('AdminDashboard - Debug info:', debugData);

      if (error) {
        console.error('AdminDashboard - Error checking admin status:', error);
        toast({
          title: 'Error',
          description: `Failed to verify admin access: ${error.message}`,
          variant: 'destructive',
        });
        // Don't redirect immediately, show debug info
        setLoading(false);
        return;
      }
      
      console.log('AdminDashboard - User is admin:', isAdmin);
      
      if (!isAdmin) {
        console.log('AdminDashboard - User is not admin');
        toast({
          title: 'Access Denied',
          description: 'You do not have admin privileges.',
          variant: 'destructive',
        });
        // Add a small delay before redirecting to let user see the message
        setTimeout(() => navigate('/'), 2000);
        setLoading(false);
        return;
      }
      
      console.log('AdminDashboard - Admin access granted');
      setIsAdmin(true);
    } catch (error: any) {
      console.error('AdminDashboard - Unexpected error:', error);
      toast({
        title: 'Error',
        description: 'Failed to verify admin access',
        variant: 'destructive',
      });
      setTimeout(() => navigate('/'), 2000);
    } finally {
      setLoading(false);
    }
  };

  // Force refresh profile data
  const refreshAdminCheck = async () => {
    setLoading(true);
    setIsAdmin(false);
    await checkAdminAccess();
  };

  if (!user) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-6xl mx-auto">
            <div className="animate-pulse">
              <div className="h-8 bg-muted rounded w-1/3 mb-6"></div>
              <div className="h-32 bg-muted rounded mb-6"></div>
            </div>
            <p className="text-center text-muted-foreground">Checking admin access...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto space-y-6">
            <Alert>
              <Shield className="w-4 h-4" />
              <AlertDescription>
                Admin access required to view this page.
              </AlertDescription>
            </Alert>
            
            {debugInfo && (
              <div className="bg-muted p-4 rounded-lg">
                <h3 className="font-semibold mb-2">Debug Information:</h3>
                <pre className="text-sm overflow-auto">
                  {JSON.stringify(debugInfo, null, 2)}
                </pre>
                <button
                  onClick={refreshAdminCheck}
                  className="mt-2 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
                >
                  Retry Admin Check
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Shield className="w-8 h-8" />
              Admin Dashboard
            </h1>
            <p className="text-muted-foreground">
              System administration and monitoring tools
            </p>
          </div>

          <Tabs defaultValue="assignments" className="space-y-6">
            <TabsList className="grid w-full grid-cols-7">
              <TabsTrigger value="assignments" className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Assignments
              </TabsTrigger>
              <TabsTrigger value="trials" className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Trials
              </TabsTrigger>
              <TabsTrigger value="security" className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Security
              </TabsTrigger>
              <TabsTrigger value="users" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Access Codes
              </TabsTrigger>
              <TabsTrigger value="featured-creators" className="flex items-center gap-2">
                <Star className="w-4 h-4" />
                Featured
              </TabsTrigger>
              <TabsTrigger value="payout-mgmt" className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Payouts
              </TabsTrigger>
              <TabsTrigger value="bank-verification" className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Bank Verification
              </TabsTrigger>
            </TabsList>

            <TabsContent value="assignments" className="space-y-6">
              <AdminScriptAssignments />
            </TabsContent>

            <TabsContent value="trials" className="space-y-6">
              <AdminTrialManagement />
            </TabsContent>

            <TabsContent value="security" className="space-y-6">
              <SecurityAuditDashboard />
            </TabsContent>

            <TabsContent value="users" className="space-y-6">
              <AdminAccessCodes />
            </TabsContent>

            <TabsContent value="featured-creators" className="space-y-6">
              <AdminFeaturedCreators />
            </TabsContent>

            <TabsContent value="payout-mgmt" className="space-y-6">
              <AdminPayoutDashboard />
            </TabsContent>

            <TabsContent value="bank-verification" className="space-y-6">
              <AdminBankVerification />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
