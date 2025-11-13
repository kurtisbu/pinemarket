
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useSecurityValidation } from './useSecurityValidation';
import { useSecureFileValidation } from './useSecureFileValidation';
import type { PriceObject } from '@/components/SellScript/PriceManager';

export const useSellScriptForm = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { validateProgramData, validating: securityValidating } = useSecurityValidation();
  const { validateFile } = useSecureFileValidation();
  
  const [loading, setLoading] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [scriptFile, setScriptFile] = useState<File | null>(null);
  const [scriptType, setScriptType] = useState<'file' | 'link'>('link');
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [currentTag, setCurrentTag] = useState('');
  const [prices, setPrices] = useState<PriceObject[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    tags: [] as string[],
    tradingview_publication_url: '',
    offer_trial: false,
    trial_period_days: 7,
  });

  const handleInputChange = (field: string, value: string | number | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addTag = () => {
    if (currentTag.trim() && !formData.tags.includes(currentTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, currentTag.trim()]
      }));
      setCurrentTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const uploadFile = async (file: File, bucket: string, folder: string) => {
    const validation = await validateFile(file, bucket as 'pine-scripts' | 'program-media');
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const fileName = `${folder}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file);

    if (error) throw error;

    if (bucket === 'program-media') {
      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);
      return publicUrl;
    }

    return fileName;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Check Stripe connection
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_account_id, stripe_charges_enabled')
      .eq('id', user.id)
      .single();

    if (!profile?.stripe_account_id || !profile.stripe_charges_enabled) {
      toast({
        title: 'Stripe Account Required',
        description: 'You must connect and complete your Stripe account setup before publishing programs.',
        variant: 'destructive',
      });
      return;
    }

    // Validate prices
    if (prices.length === 0) {
      toast({
        title: 'At least one price required',
        description: 'Please add at least one pricing option for your program.',
        variant: 'destructive',
      });
      return;
    }

    // Validate each price
    for (const price of prices) {
      if (!price.display_name.trim()) {
        toast({
          title: 'Display name required',
          description: 'All pricing options must have a display name.',
          variant: 'destructive',
        });
        return;
      }

      const amount = parseFloat(price.amount);
      if (!price.amount || isNaN(amount) || amount <= 0) {
        toast({
          title: 'Valid price required',
          description: 'All pricing options must have a valid price greater than $0.',
          variant: 'destructive',
        });
        return;
      }

      if (price.price_type === 'recurring' && !price.interval) {
        toast({
          title: 'Billing interval required',
          description: 'Recurring pricing options must have a billing interval.',
          variant: 'destructive',
        });
        return;
      }
    }

    if (formData.offer_trial && (!formData.trial_period_days || formData.trial_period_days < 1)) {
      toast({
        title: 'Invalid trial period',
        description: 'Trial period must be at least 1 day.',
        variant: 'destructive',
      });
      return;
    }

    const validationResult = await validateProgramData({
      title: formData.title,
      description: formData.description,
      tradingview_publication_url: formData.tradingview_publication_url
    });

    if (!validationResult.valid) {
      toast({
        title: 'Validation failed',
        description: validationResult.error,
        variant: 'destructive',
      });
      return;
    }
    
    setLoading(true);

    try {
      let scriptPath: string | null = null;
      let publicationUrl: string | null = null;
      let scriptId: string | null = null;

      if (scriptType === 'file') {
        if (!scriptFile) {
          toast({ title: 'Script file required', description: 'Please upload a .txt file containing your Pine Script.', variant: 'destructive' });
          setLoading(false);
          return;
        }
        scriptPath = await uploadFile(scriptFile, 'pine-scripts', user.id);
      } else if (scriptType === 'link') {
        if (!formData.tradingview_publication_url.trim()) {
          toast({ title: 'TradingView link required', description: 'Please provide a TradingView publication link.', variant: 'destructive' });
          setLoading(false);
          return;
        }
        publicationUrl = formData.tradingview_publication_url;
        const scriptIdMatch = publicationUrl.match(/script\/([a-zA-Z0-9-]+)\//);
        scriptId = scriptIdMatch ? scriptIdMatch[1] : null;

        if (!scriptId) {
            toast({ title: 'Invalid TradingView URL', description: 'Could not extract script ID from the provided link.', variant: 'destructive' });
            setLoading(false);
            return;
        }
      }

      const imageUrls: string[] = [];
      if (mediaFiles.length > 0) {
        setUploadingMedia(true);
        toast({
          title: 'Processing images',
          description: `Uploading and optimizing ${mediaFiles.length} image${mediaFiles.length > 1 ? 's' : ''}...`,
        });
        
        for (const file of mediaFiles) {
          try {
            const url = await uploadFile(file, 'program-media', user.id);
            imageUrls.push(url);
          } catch (error: any) {
            toast({
              title: 'Media upload failed',
              description: `Failed to upload ${file.name}: ${error.message}`,
              variant: 'destructive',
            });
            setLoading(false);
            setUploadingMedia(false);
            return;
          }
        }
        setUploadingMedia(false);
      }

      const programData = {
        seller_id: user.id,
        title: formData.title,
        description: formData.description,
        category: formData.category,
        tags: formData.tags,
        image_urls: imageUrls,
        status: 'draft',
        script_file_path: scriptPath,
        tradingview_publication_url: publicationUrl,
        tradingview_script_id: scriptId,
        pricing_model: 'flexible', // New flexible pricing model
        price: 0, // Price is now in program_prices table
        trial_period_days: formData.offer_trial ? formData.trial_period_days : 0
      };

      const { data: program, error: programError } = await supabase
        .from('programs')
        .insert(programData)
        .select()
        .single();

      if (programError) throw programError;

      // Insert all price objects
      const priceData = prices.map((price, index) => ({
        program_id: program.id,
        price_type: price.price_type,
        amount: parseFloat(price.amount),
        interval: price.interval || null,
        display_name: price.display_name,
        description: price.description || null,
        sort_order: index,
      }));

      const { error: pricesError } = await supabase
        .from('program_prices')
        .insert(priceData);

      if (pricesError) throw pricesError;

      // Create Stripe products and prices
      try {
        const { error: stripeError } = await supabase.functions.invoke('create-program-prices', {
          body: { programId: program.id }
        });

        if (stripeError) {
          console.error('Stripe price creation error:', stripeError);
          toast({
            title: 'Program created',
            description: 'Program created but Stripe prices setup failed. You can set them up later from your dashboard.',
            variant: 'destructive',
          });
        }
      } catch (stripeError: any) {
        console.error('Stripe integration error:', stripeError);
        // Don't fail the whole operation if Stripe fails
      }

      toast({
        title: 'Program created successfully',
        description: `Your Pine Script program has been created with ${prices.length} pricing option${prices.length !== 1 ? 's' : ''}${imageUrls.length > 0 ? ` and ${imageUrls.length} image${imageUrls.length !== 1 ? 's' : ''}` : ''}.`,
      });

      navigate('/my-programs');
    } catch (error: any) {
      console.error('Secure program creation failed:', error);
      toast({
        title: 'Operation failed',
        description: error.message || 'Failed to create program securely',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setUploadingMedia(false);
    }
  };

  const isFormValid = formData.title.trim() && 
    formData.description.trim() && 
    formData.category && 
    prices.length > 0 &&
    prices.every(p => 
      p.display_name.trim() && 
      p.amount && 
      parseFloat(p.amount) > 0 &&
      (p.price_type === 'one_time' || (p.price_type === 'recurring' && p.interval))
    );
  const isSubmitDisabled = loading || securityValidating || uploadingMedia || !isFormValid;

  return {
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
  };
};
