
import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, User, ExternalLink } from 'lucide-react';
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

interface SellerProfileViewProps {
  profile: Profile | null;
  onProfileUpdate: () => void;
}

const SellerProfileView: React.FC<SellerProfileViewProps> = ({ profile, onProfileUpdate }) => {
  if (!profile) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">Loading profile...</p>
        </CardContent>
      </Card>
    );
  }

  const joinDate = new Date(profile.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long'
  });

  return (
    <div className="space-y-6">
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
                <h2 className="text-3xl font-bold">
                  {profile.display_name || profile.username}
                </h2>
                {profile.role && profile.role !== 'user' && (
                  <Badge variant="secondary" className="capitalize">
                    {profile.role}
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground mb-2">@{profile.username}</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <Calendar className="w-4 h-4" />
                <span>Member since {joinDate}</span>
              </div>
              <Button asChild variant="outline">
                <a href={`/profile/${profile.username}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View Public Profile
                </a>
              </Button>
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
              <p>Add a bio in your settings to tell customers about yourself.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {profile.is_tradingview_connected && (
        <UserTradingViewScripts profileId={profile.id} isOwner={true} />
      )}
    </div>
  );
};

export default SellerProfileView;
