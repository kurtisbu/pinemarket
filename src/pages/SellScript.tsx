
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Header from '@/components/Header';
import SellScriptForm from '@/components/SellScript/SellScriptForm';
import { useSellScriptForm } from '@/hooks/useSellScriptForm';

const SellScript = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
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

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
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
                isSubmitDisabled={isSubmitDisabled}
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
