
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ExternalLink, AlertTriangle } from 'lucide-react';

interface TradingViewVendorDisclaimerProps {
  onAccept: () => void;
  onDecline: () => void;
}

const TradingViewVendorDisclaimer: React.FC<TradingViewVendorDisclaimerProps> = ({ 
  onAccept, 
  onDecline 
}) => {
  const [hasReadRules, setHasReadRules] = useState(false);
  const [agreesToComply, setAgreesToComply] = useState(false);

  const canProceed = hasReadRules && agreesToComply;

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-yellow-500" />
          TradingView Vendor Requirements
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Important:</strong> Before you can sell Pine Scripts on our platform, you must understand and agree to comply with TradingView's official vendor requirements.
          </p>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Key TradingView Vendor Requirements:</h3>
          
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <p><strong>Quality Standards:</strong> All scripts must be original, well-documented, and provide real trading value</p>
            </div>
            
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <p><strong>No Misleading Claims:</strong> Avoid unrealistic profit claims or guaranteed returns</p>
            </div>
            
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <p><strong>Proper Documentation:</strong> Provide clear descriptions, usage instructions, and parameter explanations</p>
            </div>
            
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <p><strong>User Support:</strong> Respond to user questions and provide reasonable support</p>
            </div>
            
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <p><strong>Compliance:</strong> Follow all TradingView community guidelines and terms of service</p>
            </div>
            
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <p><strong>No Spam or Manipulation:</strong> Avoid artificial rating manipulation or spam practices</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="text-sm text-gray-700 mb-3">
            <strong>Important:</strong> Violation of TradingView's vendor requirements can result in:
          </p>
          <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
            <li>Removal of your scripts from TradingView</li>
            <li>Suspension of your TradingView account</li>
            <li>Suspension from our marketplace</li>
          </ul>
        </div>

        <div className="flex items-center gap-3 p-4 border rounded-lg">
          <ExternalLink className="w-5 h-5 text-blue-500" />
          <div className="flex-1">
            <p className="font-medium">Read the Full Requirements</p>
            <a 
              href="https://www.tradingview.com/support/solutions/43000549951-vendor-requirements/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline text-sm"
            >
              View TradingView's Official Vendor Requirements →
            </a>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="readRules" 
              checked={hasReadRules}
              onCheckedChange={(checked) => setHasReadRules(checked as boolean)}
            />
            <label htmlFor="readRules" className="text-sm">
              I have read and understand TradingView's vendor requirements
            </label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="agreeComply" 
              checked={agreesToComply}
              onCheckedChange={(checked) => setAgreesToComply(checked as boolean)}
            />
            <label htmlFor="agreeComply" className="text-sm">
              I agree to comply with all TradingView vendor requirements and understand that violations may result in account suspension
            </label>
          </div>
        </div>

        <div className="flex gap-4 pt-6">
          <Button 
            onClick={onAccept}
            disabled={!canProceed}
            className="flex-1"
          >
            I Agree - Continue Setup
          </Button>
          <Button 
            variant="outline" 
            onClick={onDecline}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default TradingViewVendorDisclaimer;
