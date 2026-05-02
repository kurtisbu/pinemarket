
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Header from '@/components/Header';
import { Calendar, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import UserTradingViewScripts from '@/components/UserTradingViewScripts';
import UserPurchases from '@/components/UserPurchases';
import SellerPublishedPrograms from '@/components/SellerPublishedPrograms';

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

const Profile = () => {
  const { username } = useParams<{ username: string }>();
  const { user: authUser } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!username) return;

      // Try username lookup first
      let { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .maybeSingle();

      // Fallback: if the URL segment looks like a UUID, try matching by id
      if (!data) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(username)) {
          const byId = await supabase
            .from('profiles')
            .select('*')
            .eq('id', username)
            .maybeSingle();
          data = byId.data;
          error = byId.error;
        }
      }

      if (!data) {
        setNotFound(true);
      } else {
        setProfile(data);
      }
      setLoading(false);
    };

    fetchProfile();
  }, [username]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="animate-pulse">
              <div className="h-32 bg-muted rounded-lg mb-6"></div>
              <div className="h-6 bg-muted rounded w-1/3 mb-4"></div>
              <div className="h-4 bg-muted rounded w-2/3"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-2xl font-bold mb-4">Profile Not Found</h1>
            <p className="text-muted-foreground">The user profile you're looking for doesn't exist.</p>
          </div>
        </div>
      </div>
    );
  }

  const joinDate = new Date(profile.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long'
  });

  const isOwner = authUser?.id === profile.id;

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Profile link copied to clipboard');
    } catch {
      toast.error('Failed to copy link');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero banner */}
      <div className="relative">
        <div className="h-48 sm:h-56 w-full bg-gradient-to-br from-primary/30 via-primary/10 to-background" />
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto -mt-16 sm:-mt-20">
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-6">
              <Avatar className="w-32 h-32 sm:w-36 sm:h-36 ring-4 ring-background shadow-xl">
                <AvatarImage src={profile.avatar_url} alt={profile.display_name || profile.username} />
                <AvatarFallback className="text-4xl">
                  {(profile.display_name || profile.username)?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 sm:pb-2">
                <div className="flex flex-wrap items-center gap-3 mb-1">
                  <h1 className="text-4xl font-bold tracking-tight">
                    {profile.display_name || profile.username}
                  </h1>
                  {profile.role && profile.role !== 'user' && (
                    <Badge variant="secondary" className="capitalize">
                      {profile.role}
                    </Badge>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleShare}
                    className="ml-auto sm:ml-2"
                  >
                    <Share2 className="w-4 h-4" />
                    Share Profile
                  </Button>
                </div>
                <p className="text-muted-foreground text-lg">@{profile.username}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                  <Calendar className="w-4 h-4" />
                  <span>Member since {joinDate}</span>
                </div>
              </div>
            </div>

            {profile.bio && (
              <p className="mt-8 text-lg leading-relaxed text-foreground/80 whitespace-pre-wrap max-w-3xl">
                {profile.bio}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Show purchases only to the profile owner */}
          {isOwner && (
            <UserPurchases userId={profile.id} />
          )}

          {/* Show published programs for sale */}
          <SellerPublishedPrograms 
            sellerId={profile.id} 
            sellerUsername={profile.username} 
          />

          {/* Show TradingView publications only to the profile owner */}
          {isOwner && profile.is_tradingview_connected && (
            <UserTradingViewScripts profileId={profile.id} isOwner={isOwner} />
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
