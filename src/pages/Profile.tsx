
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Header from '@/components/Header';
import { User, Calendar } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import UserTradingViewScripts from '@/components/UserTradingViewScripts';

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

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .single();

      if (error || !data) {
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

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-start gap-6">
                <Avatar className="w-24 h-24">
                  <AvatarImage src={profile.avatar_url} alt={profile.display_name || profile.username} />
                  <AvatarFallback className="text-2xl">
                    {(profile.display_name || profile.username)?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-3xl font-bold">
                      {profile.display_name || profile.username}
                    </h1>
                    {profile.role && profile.role !== 'user' && (
                      <Badge variant="secondary" className="capitalize">
                        {profile.role}
                      </Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground mb-2">@{profile.username}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span>Member since {joinDate}</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {profile.bio ? (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-2">About</h3>
                  <p className="text-muted-foreground whitespace-pre-wrap">{profile.bio}</p>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>This user hasn't added a bio yet.</p>
                </div>
              )}
              
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4">Pine Script Programs for Sale</h3>
                <div className="text-center py-8 text-muted-foreground">
                  <p>No programs available yet. Check back later!</p>
                </div>
              </div>

              {profile.is_tradingview_connected && (
                <UserTradingViewScripts profileId={profile.id} isOwner={isOwner} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Profile;
