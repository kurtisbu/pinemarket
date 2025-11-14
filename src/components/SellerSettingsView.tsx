import React, { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import StripeConnectSettings from '@/components/StripeConnectSettings';
import TradingViewConnectionStatus from '@/components/TradingViewConnectionStatus';
import TradingViewDisconnect from '@/components/TradingViewDisconnect';
import { Upload, User, Loader2, RefreshCw } from 'lucide-react';

interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  bio: string;
  role: string;
  created_at: string;
  is_tradingview_connected: boolean;
  tradingview_username?: string;
  tradingview_connection_status?: string;
  tradingview_last_validated_at?: string;
  tradingview_last_error?: string;
}

interface SellerSettingsViewProps {
  profile: Profile | null;
  onProfileUpdate: () => void;
}

const SellerSettingsView: React.FC<SellerSettingsViewProps> = ({ profile, onProfileUpdate }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [refreshingHealth, setRefreshingHealth] = useState(false);
  const [formData, setFormData] = useState({
    display_name: profile?.display_name || '',
    bio: profile?.bio || '',
    avatar_url: profile?.avatar_url || '',
    tradingview_username: '',
    tradingview_session_cookie: '',
    tradingview_signed_session_cookie: '',
    is_tradingview_connected: profile?.is_tradingview_connected || false,
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      setFormData(prev => ({
        ...prev,
        avatar_url: publicUrl
      }));

      toast({
        title: 'Avatar uploaded',
        description: 'Your profile picture has been updated.',
      });
    } catch (error: any) {
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!user) return;
    setTestingConnection(true);

    try {
      const { data, error } = await supabase.functions.invoke('tradingview-service', {
        body: {
          action: 'test-connection',
          credentials: {
            tradingview_session_cookie: formData.tradingview_session_cookie,
            tradingview_signed_session_cookie: formData.tradingview_signed_session_cookie,
          },
          user_id: user.id,
          tradingview_username: formData.tradingview_username,
        },
      });

      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);

      toast({
        title: 'Success!',
        description: data.message,
      });

      setFormData(prev => ({
        ...prev,
        tradingview_session_cookie: '',
        tradingview_signed_session_cookie: '',
        is_tradingview_connected: true,
      }));

      onProfileUpdate();
    } catch (error: any) {
      toast({
        title: 'Connection Test Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleRefreshHealthCheck = async () => {
    if (!user) return;
    setRefreshingHealth(true);

    try {
      const { data, error } = await supabase.functions.invoke('tradingview-health-check');

      if (error) throw new Error(error.message);

      toast({
        title: 'Health Check Complete',
        description: 'TradingView connection status has been refreshed.',
      });

      onProfileUpdate();
    } catch (error: any) {
      toast({
        title: 'Health Check Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setRefreshingHealth(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const updateData: Database['public']['Tables']['profiles']['Insert'] = {
        id: user.id,
        display_name: formData.display_name,
        bio: formData.bio,
        avatar_url: formData.avatar_url,
        tradingview_username: formData.tradingview_username,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('profiles')
        .upsert(updateData);

      if (error) throw error;

      toast({
        title: 'Settings updated',
        description: 'Your profile settings have been successfully updated.',
      });

      setFormData(prev => ({
        ...prev,
        tradingview_session_cookie: '',
        tradingview_signed_session_cookie: '',
      }));

      onProfileUpdate();
    } catch (error: any) {
      toast({
        title: 'Update failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Settings</h2>
        <p className="text-muted-foreground">Manage your profile and account settings</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            
            <div className="flex flex-col items-center space-y-4">
              <Avatar className="w-24 h-24">
                <AvatarImage src={formData.avatar_url} alt="Profile picture" />
                <AvatarFallback className="text-2xl">
                  <User className="w-8 h-8" />
                </AvatarFallback>
              </Avatar>
              <div>
                <Label htmlFor="avatar" className="cursor-pointer">
                  <div className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors">
                    <Upload className="w-4 h-4" />
                    {uploading ? 'Uploading...' : 'Change Avatar'}
                  </div>
                </Label>
                <Input
                  id="avatar"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="display_name">Display Name</Label>
              <Input
                id="display_name"
                value={formData.display_name}
                onChange={(e) => handleInputChange('display_name', e.target.value)}
                placeholder="Your display name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={formData.bio}
                onChange={(e) => handleInputChange('bio', e.target.value)}
                placeholder="Tell us about yourself..."
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        <StripeConnectSettings />

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>TradingView Integration</CardTitle>
              <div className="flex items-center gap-2">
                <TradingViewConnectionStatus
                  isConnected={profile?.is_tradingview_connected || false}
                  connectionStatus={profile?.tradingview_connection_status}
                  lastValidatedAt={profile?.tradingview_last_validated_at}
                  lastError={profile?.tradingview_last_error}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRefreshHealthCheck}
                  disabled={refreshingHealth}
                >
                  {refreshingHealth ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <TradingViewConnectionStatus
              isConnected={profile?.is_tradingview_connected || false}
              connectionStatus={profile?.tradingview_connection_status}
              lastValidatedAt={profile?.tradingview_last_validated_at}
              lastError={profile?.tradingview_last_error}
              showDetails={true}
            />
            
            {profile?.is_tradingview_connected && profile.tradingview_username ? (
              <div className="space-y-4">
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-sm font-medium mb-1">Connected Account</p>
                  <p className="text-lg font-semibold">{profile.tradingview_username}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Your TradingView account is connected and scripts are synced.
                  </p>
                </div>
                <TradingViewDisconnect
                  userId={user?.id || ''}
                  tradingviewUsername={profile.tradingview_username}
                  onDisconnected={() => {
                    onProfileUpdate();
                    toast({
                      title: 'Account Disconnected',
                      description: 'You can now connect a different TradingView account.',
                    });
                  }}
                />
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Connect your TradingView account to automate script assignments for your buyers.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="tradingview_username">TradingView Username</Label>
                  <Input
                    id="tradingview_username"
                    value={formData.tradingview_username}
                    onChange={(e) => handleInputChange('tradingview_username', e.target.value)}
                    placeholder="Your TradingView username"
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="session_cookie">Session Cookie (sessionid)</Label>
                  <Input
                    id="session_cookie"
                    type="password"
                    value={formData.tradingview_session_cookie}
                    onChange={(e) => handleInputChange('tradingview_session_cookie', e.target.value)}
                    placeholder="Value is hidden for security"
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signed_session_cookie">Signed Session Cookie (sessionid_sign)</Label>
                  <Input
                    id="signed_session_cookie"
                    type="password"
                    value={formData.tradingview_signed_session_cookie}
                    onChange={(e) => handleInputChange('tradingview_signed_session_cookie', e.target.value)}
                    placeholder="Value is hidden for security"
                    disabled={loading}
                  />
                </div>
                <Button type="button" onClick={handleTestConnection} variant="outline" disabled={loading || testingConnection}>
                  {testingConnection ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {testingConnection ? 'Testing...' : 'Test & Save Connection'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Button type="submit" disabled={loading || uploading || testingConnection} className="w-full">
          {loading ? 'Saving Settings...' : 'Save All Settings'}
        </Button>
      </form>
    </div>
  );
};

export default SellerSettingsView;
