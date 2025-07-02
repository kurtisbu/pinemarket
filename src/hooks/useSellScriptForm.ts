
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useSecurityValidation } from './useSecurityValidation';
import { useSecureFileValidation } from './useSecureFileValidation';

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
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    category: '',
    tags: [] as string[],
    tradingview_publication_url: ''
  });

  const handleInputChange = (field: string, value: string | number) => {
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

    if (!formData.price) {
      toast({
        title: 'Price required',
        description: 'Please set a price for your program.',
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
        pricing_model: 'one_time',
        price: parseFloat(formData.price),
        monthly_price: null,
        yearly_price: null,
        billing_interval: null,
        trial_period_days: 0
      };

      const { error } = await supabase
        .from('programs')
        .insert(programData);

      if (error) throw error;

      toast({
        title: 'Program created successfully',
        description: `Your Pine Script program has been created with ${imageUrls.length} optimized image${imageUrls.length !== 1 ? 's' : ''}.`,
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

  const isFormValid = formData.title.trim() && formData.description.trim() && formData.price && formData.category;
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
    handleSubmit,
    loading,
    securityValidating,
    uploadingMedia,
    isSubmitDisabled
  };
};
