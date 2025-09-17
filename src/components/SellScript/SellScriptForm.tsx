
import React from 'react';
import { Button } from '@/components/ui/button';
import ProgramBasicForm from './ProgramBasicForm';
import TagManager from './TagManager';
import ScriptUploadSection from './ScriptUploadSection';
import MediaUploadSection from './MediaUploadSection';
import SubscriptionPlanSelector from '../SubscriptionPlanSelector';

interface SellScriptFormProps {
  formData: {
    title: string;
    description: string;
    price: string;
    category: string;
    tags: string[];
    tradingview_publication_url: string;
    offer_trial: boolean;
    trial_period_days: number;
    pricing_model: string;
    monthly_price: string;
    yearly_price: string;
    billing_interval: string;
  };
  onInputChange: (field: string, value: string | number | boolean) => void;
  categories: string[];
  currentTag: string;
  setCurrentTag: (tag: string) => void;
  onAddTag: () => void;
  onRemoveTag: (tag: string) => void;
  scriptType: 'file' | 'link';
  setScriptType: (type: 'file' | 'link') => void;
  scriptFile: File | null;
  setScriptFile: (file: File | null) => void;
  mediaFiles: File[];
  setMediaFiles: React.Dispatch<React.SetStateAction<File[]>>;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitDisabled: boolean;
  loading: boolean;
  securityValidating: boolean;
  uploadingMedia: boolean;
  onCancel: () => void;
}

const SellScriptForm: React.FC<SellScriptFormProps> = ({
  formData,
  onInputChange,
  categories,
  currentTag,
  setCurrentTag,
  onAddTag,
  onRemoveTag,
  scriptType,
  setScriptType,
  scriptFile,
  setScriptFile,
  mediaFiles,
  setMediaFiles,
  onSubmit,
  isSubmitDisabled,
  loading,
  securityValidating,
  uploadingMedia,
  onCancel
}) => {
  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <ProgramBasicForm
        formData={formData}
        onInputChange={onInputChange}
        categories={categories}
      />

      <TagManager
        tags={formData.tags}
        currentTag={currentTag}
        setCurrentTag={setCurrentTag}
        onAddTag={onAddTag}
        onRemoveTag={onRemoveTag}
      />

      <ScriptUploadSection
        scriptType={scriptType}
        setScriptType={setScriptType}
        scriptFile={scriptFile}
        setScriptFile={setScriptFile}
        tradingViewUrl={formData.tradingview_publication_url}
        onUrlChange={(url) => onInputChange('tradingview_publication_url', url)}
      />

      <MediaUploadSection
        mediaFiles={mediaFiles}
        setMediaFiles={setMediaFiles}
      />

      {formData.pricing_model === 'subscription' && (
        <SubscriptionPlanSelector
          monthlyPrice={formData.monthly_price}
          onMonthlyPriceChange={(price) => onInputChange('monthly_price', price)}
          yearlyPrice={formData.yearly_price}
          onYearlyPriceChange={(price) => onInputChange('yearly_price', price)}
          interval={formData.billing_interval}
          onIntervalChange={(interval) => onInputChange('billing_interval', interval)}
          trialPeriodDays={formData.trial_period_days}
          onTrialPeriodChange={(days) => onInputChange('trial_period_days', days)}
        />
      )}

      <div className="flex gap-4">
        <Button 
          type="submit" 
          disabled={isSubmitDisabled} 
          className="flex-1"
        >
          {uploadingMedia 
            ? 'Processing Images...' 
            : loading || securityValidating 
              ? 'Creating Securely...' 
              : 'Create Program (Draft)'
          }
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      {(securityValidating || uploadingMedia) && (
        <p className="text-sm text-muted-foreground text-center">
          {uploadingMedia 
            ? 'Optimizing and uploading images...' 
            : 'Running security validation...'
          }
        </p>
      )}
    </form>
  );
};

export default SellScriptForm;
