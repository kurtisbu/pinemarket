
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import SellScriptForm from '@/components/SellScript/SellScriptForm';
import StripeConnectBanner from '@/components/StripeConnectBanner';
import { useSellScriptForm } from '@/hooks/useSellScriptForm';
import { Loader2 } from 'lucide-react';

const SellScript = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stripeStatus, setStripeStatus] = useState({
    account_id: null as string | null,
    charges_enabled: false,
    loading: true,
  });
  const {
    formData,
    handleInputChange,
    currentTag,
    setCurrentTag,
    addTag,
    removeTag,
    scriptType,
    setScriptType,
    scriptFile,
    setScriptFile,
    mediaFiles,
    setMediaFiles,
    prices,
    setPrices,
    handleSubmit,
    loading,
    securityValidating,
    uploadingMedia,
    isSubmitDisabled
  } = useSellScriptForm();

  const categories = [
    'Indicator',
    'Strategy',
    'Utility',
    'Screener',
    'Library',
    'Educational'
  ];

  React.useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  useEffect(() => {
    const fetchStripeStatus = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('stripe_account_id, stripe_charges_enabled')
          .eq('id', user.id)
          .single();

        if (error) throw error;

        setStripeStatus({
          account_id: data.stripe_account_id,
          charges_enabled: data.stripe_charges_enabled,
          loading: false,
        });
      } catch (error) {
        console.error('Error fetching Stripe status:', error);
        setStripeStatus(prev => ({ ...prev, loading: false }));
      }
    };

    fetchStripeStatus();
  }, [user]);

  if (!user) return null;

  if (stripeStatus.loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const isStripeConnected = stripeStatus.account_id && stripeStatus.charges_enabled;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <StripeConnectBanner
            stripeAccountId={stripeStatus.account_id}
            stripeChargesEnabled={stripeStatus.charges_enabled}
            variant="error"
          />
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Sell Your Pine Script
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                  Enhanced Security
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SellScriptForm
                formData={formData}
                onInputChange={handleInputChange}
                categories={categories}
                currentTag={currentTag}
                setCurrentTag={setCurrentTag}
                onAddTag={addTag}
                onRemoveTag={removeTag}
                scriptType={scriptType}
                setScriptType={setScriptType}
                scriptFile={scriptFile}
                setScriptFile={setScriptFile}
                mediaFiles={mediaFiles}
                setMediaFiles={setMediaFiles}
                prices={prices}
                setPrices={setPrices}
                onSubmit={handleSubmit}
                isSubmitDisabled={isSubmitDisabled || !isStripeConnected}
                loading={loading}
                securityValidating={securityValidating}
                uploadingMedia={uploadingMedia}
                onCancel={() => navigate('/')}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SellScript;
