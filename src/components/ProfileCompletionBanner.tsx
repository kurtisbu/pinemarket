import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { UserCircle, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ProfileCompletionBannerProps {
  hasTradingViewUsername: boolean;
}

const ProfileCompletionBanner: React.FC<ProfileCompletionBannerProps> = ({ 
  hasTradingViewUsername 
}) => {
  const navigate = useNavigate();

  if (hasTradingViewUsername) {
    return null;
  }

  return (
    <Alert className="bg-blue-50 border-blue-200">
      <UserCircle className="h-4 w-4 text-blue-600" />
      <AlertDescription className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-blue-900 font-semibold mb-1">
            Complete your profile for faster checkout
          </p>
          <p className="text-blue-700 text-sm">
            Add your TradingView username to your profile to automatically fill it during purchases.
          </p>
        </div>
        <Button
          onClick={() => navigate('/profile/settings')}
          variant="outline"
          size="sm"
          className="ml-4 border-blue-300 text-blue-700 hover:bg-blue-100"
        >
          Add Username
        </Button>
      </AlertDescription>
    </Alert>
  );
};

export default ProfileCompletionBanner;
