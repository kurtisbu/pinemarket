
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User } from 'lucide-react';

interface SellerInfoProps {
  program: any;
  onViewProfile: () => void;
}

const SellerInfo: React.FC<SellerInfoProps> = ({ program, onViewProfile }) => {
  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">Seller Information</h3>
        
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-green-500 flex items-center justify-center">
            {program.profiles?.avatar_url ? (
              <img 
                src={program.profiles.avatar_url} 
                alt={program.profiles.display_name || 'Seller'} 
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <User className="w-6 h-6 text-white" />
            )}
          </div>
          <div>
            <h4 className="font-medium">
              {program.profiles?.display_name || 'Unknown Seller'}
            </h4>
            <p className="text-sm text-muted-foreground">
              @{program.profiles?.username || 'unknown'}
            </p>
          </div>
        </div>

        {/* TradingView Connection Status */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-2 h-2 rounded-full ${
              program.profiles?.is_tradingview_connected ? 'bg-green-500' : 'bg-gray-400'
            }`} />
            <span className="text-sm font-medium">
              TradingView {program.profiles?.is_tradingview_connected ? 'Connected' : 'Not Connected'}
            </span>
          </div>
          {program.profiles?.is_tradingview_connected && program.profiles?.tradingview_username && (
            <p className="text-xs text-muted-foreground ml-4">
              Profile: @{program.profiles.tradingview_username}
            </p>
          )}
        </div>
        
        {program.profiles?.bio && (
          <p className="text-sm text-muted-foreground mb-4">
            {program.profiles.bio}
          </p>
        )}
        
        <Button 
          variant="outline" 
          className="w-full"
          onClick={onViewProfile}
        >
          View Profile
        </Button>
      </CardContent>
    </Card>
  );
};

export default SellerInfo;
