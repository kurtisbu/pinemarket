
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import Header from '@/components/Header';
import StripeConnectSettings from '@/components/StripeConnectSettings';
import ProfileBasicInfo from '@/components/ProfileBasicInfo';
import TradingViewUsernameField from '@/components/TradingViewUsernameField';
import SellerTradingViewIntegration from '@/components/SellerTradingViewIntegration';

const ProfileSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    display_name: '',
    bio: '',
    avatar_url: '',
    tradingview_username: '',
    tradingview_session_cookie: '',
    tradingview_signed_session_cookie: '',
    is_tradingview_connected: false,
  });

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('display_name, bio, avatar_url, tradingview_username, is_tradingview_connected')
      .eq('id', user.id)
      .single();

    if (data) {
      setFormData(prev => ({
        ...prev,
        display_name: data.display_name || '',
        bio: data.bio || '',
        avatar_url: data.avatar_url || '',
        tradingview_username: data.tradingview_username || '',
        is_tradingview_connected: data.is_tradingview_connected || false,
      }));
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    fetchProfile();
  }, [user, navigate, fetchProfile]);

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
      }));

      await fetchProfile();

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

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-8">
          <ProfileBasicInfo
            formData={{
              display_name: formData.display_name,
              bio: formData.bio,
              avatar_url: formData.avatar_url,
            }}
            onInputChange={handleInputChange}
            onAvatarUpload={handleAvatarUpload}
            uploading={uploading}
          />

          <TradingViewUsernameField
            value={formData.tradingview_username}
            onChange={handleInputChange}
          />

          <StripeConnectSettings />

          <SellerTradingViewIntegration
            formData={{
              tradingview_session_cookie: formData.tradingview_session_cookie,
              tradingview_signed_session_cookie: formData.tradingview_signed_session_cookie,
              is_tradingview_connected: formData.is_tradingview_connected,
            }}
            onInputChange={handleInputChange}
            onTestConnection={handleTestConnection}
            loading={loading}
            testingConnection={testingConnection}
          />

          <Button type="submit" disabled={loading || uploading || testingConnection} className="w-full">
            {loading ? 'Saving Settings...' : 'Save All Settings'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ProfileSettings;
