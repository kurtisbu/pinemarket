
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Header from '@/components/Header';
import { User, Settings, FileText, BarChart3 } from 'lucide-react';
import SellerProfileView from '@/components/SellerProfileView';
import SellerProgramsView from '@/components/SellerProgramsView';
import SellerSettingsView from '@/components/SellerSettingsView';
import SellerScriptAssignments from '@/components/SellerScriptAssignments';

interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  bio: string;
  role: string;
  created_at: string;
  is_tradingview_connected: boolean;
}

const SellerDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
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
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      
      // Redirect non-sellers to profile settings
      if (!data.is_tradingview_connected) {
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

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">Seller Dashboard</h1>
            <p className="text-muted-foreground">
              Manage your profile, programs, and settings all in one place
            </p>
          </div>

          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
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
