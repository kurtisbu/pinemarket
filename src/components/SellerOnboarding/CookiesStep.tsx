
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ExternalLink, Copy, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CookiesStepProps {
  sessionCookie: string;
  signedSessionCookie: string;
  onSessionCookieChange: (value: string) => void;
  onSignedSessionCookieChange: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
}

const CookiesStep: React.FC<CookiesStepProps> = ({
  sessionCookie,
  signedSessionCookie,
  onSessionCookieChange,
  onSignedSessionCookieChange,
  onNext,
  onBack
}) => {
  const { toast } = useToast();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied!',
      description: 'Text copied to clipboard',
    });
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold mb-2">Get Session Cookies</h2>
        <p className="text-muted-foreground">
          We need your session cookies to connect to TradingView.
        </p>
      </div>
      
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
        <h3 className="font-semibold mb-3 flex items-center">
          <ExternalLink className="w-4 h-4 mr-2" />
          Step-by-step instructions:
        </h3>
        <ol className="list-decimal list-inside space-y-2 text-sm">
          <li>Open TradingView.com in a new tab</li>
          <li>Make sure you're logged in</li>
          <li>Right-click anywhere and select "Inspect" or press F12</li>
          <li>Go to the "Application" tab (Chrome) or "Storage" tab (Firefox)</li>
          <li>Click on "Cookies" in the left sidebar</li>
          <li>Click on "https://www.tradingview.com"</li>
          <li>Find and copy these two cookie values:</li>
        </ol>
      </div>

      <div className="grid gap-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>sessionid</Label>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => copyToClipboard('sessionid')}
            >
              <Copy className="w-3 h-3" />
            </Button>
          </div>
          <Input
            type="password"
            value={sessionCookie}
            onChange={(e) => onSessionCookieChange(e.target.value)}
            placeholder="Paste sessionid cookie value here"
          />
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>sessionid_sign</Label>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => copyToClipboard('sessionid_sign')}
            >
              <Copy className="w-3 h-3" />
            </Button>
          </div>
          <Input
            type="password"
            value={signedSessionCookie}
            onChange={(e) => onSignedSessionCookieChange(e.target.value)}
            placeholder="Paste sessionid_sign cookie value here"
          />
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
        <p className="text-sm text-yellow-800">
          <strong>Security Note:</strong> These cookies are encrypted and stored securely. 
          They're only used to sync your scripts and manage access for buyers.
        </p>
      </div>

      <div className="flex gap-2">
        <Button 
          variant="outline" 
          onClick={onBack}
          className="flex-1"
        >
          Back
        </Button>
        <Button 
          onClick={onNext}
          disabled={!sessionCookie || !signedSessionCookie}
          className="flex-1"
        >
          Test Connection <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
};

export default CookiesStep;
