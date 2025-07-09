
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import TradingViewVendorDisclaimer from '@/components/TradingViewVendorDisclaimer';
import SellerOnboardingSteps from '@/components/SellerOnboarding/SellerOnboardingSteps';
import AccessCodeStep from '@/components/SellerOnboarding/AccessCodeStep';
import WelcomeStep from '@/components/SellerOnboarding/WelcomeStep';
import TradingViewSetupStep from '@/components/SellerOnboarding/TradingViewSetupStep';
import CookiesStep from '@/components/SellerOnboarding/CookiesStep';
import TestConnectionStep from '@/components/SellerOnboarding/TestConnectionStep';
import CompleteStep from '@/components/SellerOnboarding/CompleteStep';

interface SellerOnboardingProps {
  onComplete: () => void;
}

const SellerOnboarding: React.FC<SellerOnboardingProps> = ({ onComplete }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    tradingview_username: '',
    tradingview_session_cookie: '',
    tradingview_signed_session_cookie: '',
  });

  const steps = [
    { id: 0, title: 'Vendor Rules', description: 'TradingView requirements' },
    { id: 1, title: 'Access Code', description: 'Validate seller access' },
    { id: 2, title: 'Welcome', description: 'Get started as a seller' },
    { id: 3, title: 'TradingView Setup', description: 'Connect your TradingView account' },
    { id: 4, title: 'Get Cookies', description: 'Extract session cookies' },
    { id: 5, title: 'Test Connection', description: 'Verify and sync scripts' },
    { id: 6, title: 'Complete', description: 'Ready to sell!' },
  ];

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleDisclaimerAccept = () => {
    setCurrentStep(1);
  };

  const handleDisclaimerDecline = () => {
    toast({
      title: 'Setup Cancelled',
      description: 'You must agree to TradingView vendor requirements to sell scripts.',
      variant: 'destructive',
    });
    onComplete();
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

      await handleSyncScripts();
      setCurrentStep(6);
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
      case 0:
        return (
          <TradingViewVendorDisclaimer
            onAccept={handleDisclaimerAccept}
            onDecline={handleDisclaimerDecline}
          />
        );

      case 1:
        return <AccessCodeStep onNext={() => setCurrentStep(2)} />;

      case 2:
        return <WelcomeStep onNext={() => setCurrentStep(3)} />;

      case 3:
        return (
          <TradingViewSetupStep
            username={formData.tradingview_username}
            onUsernameChange={(value) => handleInputChange('tradingview_username', value)}
            onNext={() => setCurrentStep(4)}
            onBack={() => setCurrentStep(2)}
          />
        );

      case 4:
        return (
          <CookiesStep
            sessionCookie={formData.tradingview_session_cookie}
            signedSessionCookie={formData.tradingview_signed_session_cookie}
            onSessionCookieChange={(value) => handleInputChange('tradingview_session_cookie', value)}
            onSignedSessionCookieChange={(value) => handleInputChange('tradingview_signed_session_cookie', value)}
            onNext={() => setCurrentStep(5)}
            onBack={() => setCurrentStep(3)}
          />
        );

      case 5:
        return (
          <TestConnectionStep
            username={formData.tradingview_username}
            loading={loading}
            onTestConnection={handleTestConnection}
            onBack={() => setCurrentStep(4)}
          />
        );

      case 6:
        return <CompleteStep onComplete={onComplete} />;

      default:
        return null;
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <SellerOnboardingSteps steps={steps} currentStep={currentStep} />

      {currentStep === 0 ? (
        renderStep()
      ) : (
        <Card>
          <CardContent className="p-6">
            {renderStep()}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SellerOnboarding;
