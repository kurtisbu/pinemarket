
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Header from '@/components/Header';
import { Shield, Users, BarChart3, AlertTriangle, Clock, Star, DollarSign, FlaskConical } from 'lucide-react';
import AdminScriptAssignments from '@/components/AdminScriptAssignments';
import SecurityAuditDashboard from '@/components/SecurityAuditDashboard';
import AdminTrialManagement from '@/components/AdminTrialManagement';
import AdminAccessCodes from '@/components/AdminAccessCodes';
import AdminFeaturedCreators from '@/components/AdminFeaturedCreators';
import AdminPayoutDashboard from '@/components/AdminPayoutDashboard';
import AdminTestData from '@/components/AdminTestData';

const AdminDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    checkAdminAccess();
  }, [user, navigate]);

  const checkAdminAccess = async () => {
    if (!user) return;
    
    try {
      const { data: isAdmin, error } = await supabase
        .rpc('is_current_user_admin');

      if (error) {
        toast({
          title: 'Error',
          description: `Failed to verify admin access: ${error.message}`,
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }
      
      if (!isAdmin) {
        toast({
          title: 'Access Denied',
          description: 'You do not have admin privileges.',
          variant: 'destructive',
        });
        setTimeout(() => navigate('/'), 2000);
        setLoading(false);
        return;
      }
      
      setIsAdmin(true);
    } catch (error: any) {
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
          <div className="max-w-4xl mx-auto">
            <Alert>
              <Shield className="w-4 h-4" />
              <AlertDescription>
                Admin access required to view this page.
              </AlertDescription>
            </Alert>
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
              <TabsTrigger value="test-data" className="flex items-center gap-2">
                <FlaskConical className="w-4 h-4" />
                Test Data
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

            <TabsContent value="test-data" className="space-y-6">
              <AdminTestData />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
