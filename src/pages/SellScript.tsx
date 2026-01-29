import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import Header from '@/components/Header';
import { Upload, X, Plus } from 'lucide-react';

const SellScript = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [scriptFile, setScriptFile] = useState<File | null>(null);
  const [scriptType, setScriptType] = useState<'file' | 'link'>('file');
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

  const handleInputChange = (field: string, value: string) => {
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

  const handleScriptFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.txt')) {
        toast({
          title: 'Invalid file type',
          description: 'Please upload a .txt file containing your Pine Script.',
          variant: 'destructive',
        });
        return;
      }
      setScriptFile(file);
    }
  };

  const handleMediaFilesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setMediaFiles(prev => [...prev, ...files]);
  };

  const removeMediaFile = (index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFile = async (file: File, bucket: string, folder: string) => {
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
        scriptPath = await uploadFile(scriptFile, 'scripts', user.id);
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

      // Upload media files
      const imageUrls: string[] = [];
      for (const file of mediaFiles) {
        const url = await uploadFile(file, 'program-media', user.id);
        imageUrls.push(url);
      }

      // Create program record
      const { error } = await supabase
        .from('programs')
        .insert({
          seller_id: user.id,
          title: formData.title,
          description: formData.description,
          price: parseFloat(formData.price),
          category: formData.category,
          tags: formData.tags,
          image_urls: imageUrls,
          status: 'draft',
          script_file_path: scriptPath,
          tradingview_publication_url: publicationUrl,
          tradingview_script_id: scriptId,
        });

      if (error) throw error;

      toast({
        title: 'Program created',
        description: 'Your Pine Script program has been successfully uploaded as a draft.',
      });

      navigate('/my-programs');
    } catch (error: any) {
      toast({
        title: 'Operation failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Sell Your Pine Script</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="title">Program Title *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => handleInputChange('title', e.target.value)}
                      placeholder="Enter program title"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category">Category *</Label>
                    <Select onValueChange={(value) => handleInputChange('category', value)} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="price">Price (USD) *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) => handleInputChange('price', e.target.value)}
                    placeholder="0.00"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Describe your Pine Script program, its features, and usage instructions..."
                    rows={6}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tags</Label>
                  <div className="flex gap-2 mb-2">
                    <Input
                      value={currentTag}
                      onChange={(e) => setCurrentTag(e.target.value)}
                      placeholder="Add a tag"
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    />
                    <Button type="button" onClick={addTag} variant="outline">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                        {tag}
                        <X
                          className="w-3 h-3 cursor-pointer"
                          onClick={() => removeTag(tag)}
                        />
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <Label>Pine Script *</Label>
                  <RadioGroup value={scriptType} onValueChange={(value: 'file' | 'link') => setScriptType(value)}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="file" id="file" />
                      <Label htmlFor="file">Upload .txt file</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="link" id="link" />
                      <Label htmlFor="link">TradingView publication link</Label>
                    </div>
                  </RadioGroup>

                  {scriptType === 'file' ? (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                      <div className="text-center">
                        <Upload className="mx-auto h-12 w-12 text-gray-400" />
                        <div className="mt-4">
                          <Label htmlFor="script" className="cursor-pointer">
                            <span className="mt-2 block text-sm font-medium text-gray-900">
                              {scriptFile ? scriptFile.name : 'Upload your .txt file containing Pine Script'}
                            </span>
                          </Label>
                          <Input
                            id="script"
                            type="file"
                            accept=".txt"
                            onChange={handleScriptFileChange}
                            className="hidden"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Input
                        value={formData.tradingview_publication_url}
                        onChange={(e) => handleInputChange('tradingview_publication_url', e.target.value)}
                        placeholder="https://www.tradingview.com/script/..."
                      />
                      <p className="text-sm text-muted-foreground">
                        Provide a link to your published Pine Script on TradingView
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="media">Screenshots & GIFs (Optional)</Label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                    <div className="text-center">
                      <Upload className="mx-auto h-12 w-12 text-gray-400" />
                      <div className="mt-4">
                        <Label htmlFor="media" className="cursor-pointer">
                          <span className="mt-2 block text-sm font-medium text-gray-900">
                            Upload images and GIFs to showcase your program
                          </span>
                        </Label>
                        <Input
                          id="media"
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleMediaFilesChange}
                          className="hidden"
                        />
                      </div>
                    </div>
                  </div>
                  {mediaFiles.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium mb-2">Selected files:</h4>
                      <div className="space-y-2">
                        {mediaFiles.map((file, index) => (
                          <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                            <span className="text-sm">{file.name}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeMediaFile(index)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-4">
                  <Button type="submit" disabled={loading} className="flex-1">
                    {loading ? 'Creating...' : 'Create Program (Draft)'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => navigate('/')}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SellScript;
