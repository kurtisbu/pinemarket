
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, User } from 'lucide-react';

interface ProfileBasicInfoProps {
  formData: {
    display_name: string;
    bio: string;
    avatar_url: string;
  };
  onInputChange: (field: string, value: string) => void;
  onAvatarUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  uploading: boolean;
}

const ProfileBasicInfo: React.FC<ProfileBasicInfoProps> = ({
  formData,
  onInputChange,
  onAvatarUpload,
  uploading,
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Settings</CardTitle>
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
              onChange={onAvatarUpload}
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
            onChange={(e) => onInputChange('display_name', e.target.value)}
            placeholder="Your display name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            value={formData.bio}
            onChange={(e) => onInputChange('bio', e.target.value)}
            placeholder="Tell us about yourself..."
            rows={4}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default ProfileBasicInfo;
