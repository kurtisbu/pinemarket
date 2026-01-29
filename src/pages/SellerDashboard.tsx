
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Header from '@/components/Header';
import { User, Settings, FileText, BarChart3, Clock } from 'lucide-react';
import SellerProfileView from '@/components/SellerProfileView';
import SellerProgramsView from '@/components/SellerProgramsView';
import SellerSettingsView from '@/components/SellerSettingsView';
import SellerScriptAssignments from '@/components/SellerScriptAssignments';
import TrialManagementDashboard from '@/components/TrialManagementDashboard';
import TradingViewConnectionStatus from '@/components/TradingViewConnectionStatus';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  bio: string;
  role: string;
  created_at: string;
  is_tradingview_connected: boolean;
  tradingview_connection_status?: string;
  tradingview_last_validated_at?: string;
  tradingview_last_error?: string;
}

const SellerDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('SellerDashboard - user state:', user);
    if (!user) {
      console.log('SellerDashboard - No user, redirecting to auth');
      navigate('/auth');
      return;
    }
    fetchProfile();
  }, [user, navigate]);

  const fetchProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          tradingview_connection_status,
          tradingview_last_validated_at,
          tradingview_last_error
        `)
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        throw error;
      }

      if (!data) {
        console.log('No profile found, redirecting to settings');
        navigate('/settings/profile');
        return;
      }
      
      // Redirect non-sellers to profile settings
      if (!data.is_tradingview_connected) {
        console.log('User not connected to TradingView, redirecting to settings');
        navigate('/settings/profile');
        return;
      }
      
      setProfile(data);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to fetch profile data',
        variant: 'destructive',
      });
      navigate('/settings/profile');
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="h-48 bg-muted rounded"></div>
                <div className="h-48 bg-muted rounded"></div>
                <div className="h-48 bg-muted rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const showConnectionWarning = () => {
    return profile?.tradingview_connection_status === 'expired' || 
           profile?.tradingview_connection_status === 'error' ||
           !profile?.is_tradingview_connected;
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Seller Dashboard</h1>
                <p className="text-muted-foreground">
                  Manage your profile, programs, and settings all in one place
                </p>
              </div>
              <TradingViewConnectionStatus
                isConnected={profile?.is_tradingview_connected || false}
                connectionStatus={profile?.tradingview_connection_status}
                lastValidatedAt={profile?.tradingview_last_validated_at}
                showDetails={false}
              />
            </div>
          </div>

          {showConnectionWarning() && (
            <Alert variant="destructive" className="mb-6">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Your TradingView connection needs attention. Some programs may be disabled until you reconnect.
                <Button 
                  variant="link" 
                  className="p-0 h-auto font-normal underline ml-1"
                  onClick={() => navigate('/seller-dashboard?tab=settings')}
                >
                  Fix connection
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="profile" className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Profile
              </TabsTrigger>
              <TabsTrigger value="programs" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Programs
              </TabsTrigger>
              <TabsTrigger value="assignments" className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Assignments
              </TabsTrigger>
              <TabsTrigger value="trials" className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Trials
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Settings
              </TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-6">
              <SellerProfileView profile={profile} onProfileUpdate={fetchProfile} />
            </TabsContent>

            <TabsContent value="programs" className="space-y-6">
              <SellerProgramsView />
            </TabsContent>

            <TabsContent value="assignments" className="space-y-6">
              <SellerScriptAssignments />
            </TabsContent>

            <TabsContent value="trials" className="space-y-6">
              <TrialManagementDashboard />
            </TabsContent>

            <TabsContent value="settings" className="space-y-6">
              <SellerSettingsView profile={profile} onProfileUpdate={fetchProfile} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default SellerDashboard;
