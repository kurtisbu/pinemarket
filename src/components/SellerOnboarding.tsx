
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, Circle, ExternalLink, Copy, Loader2, ArrowRight } from 'lucide-react';

interface SellerOnboardingProps {
  onComplete: () => void;
}

const SellerOnboarding: React.FC<SellerOnboardingProps> = ({ onComplete }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    tradingview_username: '',
    tradingview_session_cookie: '',
    tradingview_signed_session_cookie: '',
  });

  const steps = [
    { id: 1, title: 'Welcome', description: 'Get started as a seller' },
    { id: 2, title: 'TradingView Setup', description: 'Connect your TradingView account' },
    { id: 3, title: 'Get Cookies', description: 'Extract session cookies' },
    { id: 4, title: 'Test Connection', description: 'Verify and sync scripts' },
    { id: 5, title: 'Complete', description: 'Ready to sell!' },
  ];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied!',
      description: 'Text copied to clipboard',
    });
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleTestConnection = async () => {
    if (!user) return;
    setLoading(true);

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

      // Sync scripts after successful connection
      await handleSyncScripts();
      setCurrentStep(5);
    } catch (error: any) {
      toast({
        title: 'Connection Test Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSyncScripts = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.functions.invoke('tradingview-service', {
        body: { action: 'sync-user-scripts', user_id: user.id },
      });

      if (error || data.error) {
        toast({ 
          title: 'Sync Warning', 
          description: error?.message || data.error,
          variant: 'destructive'
        });
      } else {
        toast({ 
          title: 'Scripts Synced!', 
          description: data.message 
        });
      }
    } catch (error: any) {
      console.error('Sync error:', error);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="text-center space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Welcome to PineMarket!</h2>
              <p className="text-muted-foreground">
                Let's get you set up to start selling your TradingView Pine Scripts.
              </p>
            </div>
            <div className="bg-muted/50 p-4 rounded-lg text-left">
              <h3 className="font-semibold mb-2">What you'll need:</h3>
              <ul className="space-y-2 text-sm">
                <li>• Your TradingView username</li>
                <li>• Access to your TradingView session cookies</li>
                <li>• Published Pine Scripts on TradingView</li>
              </ul>
            </div>
            <Button onClick={() => setCurrentStep(2)} className="w-full">
              Get Started <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-bold mb-2">TradingView Account Setup</h2>
              <p className="text-muted-foreground">
                First, let's get your TradingView username.
              </p>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="username">TradingView Username</Label>
                <Input
                  id="username"
                  value={formData.tradingview_username}
                  onChange={(e) => handleInputChange('tradingview_username', e.target.value)}
                  placeholder="Enter your exact TradingView username"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  This must match exactly with your TradingView profile username
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setCurrentStep(1)}
                className="flex-1"
              >
                Back
              </Button>
              <Button 
                onClick={() => setCurrentStep(3)}
                disabled={!formData.tradingview_username.trim()}
                className="flex-1"
              >
                Next <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        );

      case 3:
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
                  value={formData.tradingview_session_cookie}
                  onChange={(e) => handleInputChange('tradingview_session_cookie', e.target.value)}
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
                  value={formData.tradingview_signed_session_cookie}
                  onChange={(e) => handleInputChange('tradingview_signed_session_cookie', e.target.value)}
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
                onClick={() => setCurrentStep(2)}
                className="flex-1"
              >
                Back
              </Button>
              <Button 
                onClick={() => setCurrentStep(4)}
                disabled={!formData.tradingview_session_cookie || !formData.tradingview_signed_session_cookie}
                className="flex-1"
              >
                Test Connection <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-bold mb-2">Test & Sync</h2>
              <p className="text-muted-foreground">
                Let's verify your connection and sync your scripts.
              </p>
            </div>

            <div className="bg-muted/50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Connection Details:</h3>
              <div className="space-y-1 text-sm">
                <div>Username: <span className="font-mono">{formData.tradingview_username}</span></div>
                <div>Session Cookie: <span className="text-green-600">✓ Provided</span></div>
                <div>Signed Cookie: <span className="text-green-600">✓ Provided</span></div>
              </div>
            </div>

            <Button 
              onClick={handleTestConnection}
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Testing Connection...
                </>
              ) : (
                <>
                  Test Connection & Sync Scripts
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>

            <div className="flex">
              <Button 
                variant="outline" 
                onClick={() => setCurrentStep(3)}
                disabled={loading}
                className="flex-1"
              >
                Back
              </Button>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="text-center space-y-6">
            <div className="space-y-2">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
              <h2 className="text-2xl font-bold">Setup Complete!</h2>
              <p className="text-muted-foreground">
                Your TradingView account is connected and your scripts have been synced.
              </p>
            </div>
            <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">What's next?</h3>
              <ul className="text-sm space-y-1 text-left">
                <li>• Create program listings from your synced scripts</li>
                <li>• Set up your Stripe account to receive payments</li>
                <li>• Start selling your Pine Scripts!</li>
              </ul>
            </div>
            <Button onClick={onComplete} className="w-full">
              Go to Dashboard
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                ${currentStep > step.id 
                  ? 'bg-green-500 text-white' 
                  : currentStep === step.id 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-muted text-muted-foreground'
                }
              `}>
                {currentStep > step.id ? <CheckCircle className="w-4 h-4" /> : step.id}
              </div>
              {index < steps.length - 1 && (
                <div className={`
                  w-16 h-0.5 mx-2
                  ${currentStep > step.id ? 'bg-green-500' : 'bg-muted'}
                `} />
              )}
            </div>
          ))}
        </div>
        <div className="text-center">
          <h3 className="font-semibold">{steps[currentStep - 1]?.title}</h3>
          <p className="text-sm text-muted-foreground">{steps[currentStep - 1]?.description}</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          {renderStep()}
        </CardContent>
      </Card>
    </div>
  );
};

export default SellerOnboarding;
