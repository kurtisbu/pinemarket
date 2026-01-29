
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import Header from '@/components/Header';
import ProfileBasicInfo from '@/components/ProfileBasicInfo';
import TradingViewUsernameField from '@/components/TradingViewUsernameField';

interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  bio: string;
  tradingview_username: string;
  is_tradingview_connected: boolean;
}

const ProfileSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    display_name: '',
    bio: '',
    avatar_url: '',
    tradingview_username: '',
  });

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
      
      setProfile(data);
      setFormData({
        display_name: data.display_name || '',
        bio: data.bio || '',
        avatar_url: data.avatar_url || '',
        tradingview_username: data.tradingview_username || '',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to fetch profile data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      handleInputChange('avatar_url', data.publicUrl);
      
      toast({
        title: 'Success',
        description: 'Avatar uploaded successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to upload avatar',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: formData.display_name,
          bio: formData.bio,
          avatar_url: formData.avatar_url,
          tradingview_username: formData.tradingview_username,
        })
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Profile updated successfully',
      });

      fetchProfile();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to update profile',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleBecomeSeller = () => {
    navigate('/seller/onboarding');
  };

  if (!user) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <div className="animate-pulse">
              <div className="h-8 bg-muted rounded w-1/3 mb-6"></div>
              <div className="h-32 bg-muted rounded mb-6"></div>
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
        <div className="max-w-2xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Profile Settings</h1>
            <p className="text-muted-foreground">
              Manage your account settings and preferences
            </p>
          </div>

          <ProfileBasicInfo
            formData={formData}
            onInputChange={handleInputChange}
            onAvatarUpload={handleAvatarUpload}
            uploading={uploading}
          />

          <TradingViewUsernameField
            value={formData.tradingview_username}
            onChange={handleInputChange}
          />

          {!profile?.is_tradingview_connected && (
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">Want to sell your Pine Scripts?</h3>
              <p className="text-blue-700 text-sm mb-4">
                Join our seller program to monetize your TradingView Pine Scripts and reach thousands of traders.
              </p>
              <Button onClick={handleBecomeSeller} variant="outline">
                Become a Seller
              </Button>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSettings;
