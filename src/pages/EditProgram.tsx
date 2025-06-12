import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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

const EditProgram = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [scriptFile, setScriptFile] = useState<File | null>(null);
  const [scriptType, setScriptType] = useState<'file' | 'link'>('file');
  const [tradingViewLink, setTradingViewLink] = useState('');
  const [currentScriptType, setCurrentScriptType] = useState<'file' | 'link'>('file');
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [currentTag, setCurrentTag] = useState('');
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    category: '',
    tags: [] as string[],
    status: 'draft'
  });

  const categories = [
    'Indicator',
    'Strategy',
    'Utility',
    'Screener',
    'Library',
    'Educational'
  ];

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (id) {
      fetchProgram();
    }
  }, [user, navigate, id]);

  const fetchProgram = async () => {
    try {
      const { data, error } = await supabase
        .from('programs')
        .select('*')
        .eq('id', id)
        .eq('seller_id', user!.id)
        .single();

      if (error) throw error;

      setFormData({
        title: data.title,
        description: data.description,
        price: data.price.toString(),
        category: data.category,
        tags: data.tags || [],
        status: data.status
      });
      setExistingImageUrls(data.image_urls || []);
      
      // Determine if current script is a file or link
      if (data.script_file_path) {
        if (data.script_file_path.startsWith('http')) {
          setCurrentScriptType('link');
          setScriptType('link');
          setTradingViewLink(data.script_file_path);
        } else {
          setCurrentScriptType('file');
          setScriptType('file');
        }
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to fetch program details',
        variant: 'destructive',
      });
      navigate('/my-programs');
    } finally {
      setInitialLoading(false);
    }
  };

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

  const removeExistingImage = (index: number) => {
    setExistingImageUrls(prev => prev.filter((_, i) => i !== index));
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
      let scriptPath;
      
      // Handle script update based on type
      if (scriptType === 'file' && scriptFile) {
        scriptPath = await uploadFile(scriptFile, 'scripts', user.id);
      } else if (scriptType === 'link' && tradingViewLink.trim()) {
        scriptPath = tradingViewLink;
      }
      // If no new script provided, keep existing path (don't update)

      const newImageUrls: string[] = [];
      for (const file of mediaFiles) {
        const url = await uploadFile(file, 'program-media', user.id);
        newImageUrls.push(url);
      }

      const updateData: any = {
        title: formData.title,
        description: formData.description,
        price: parseFloat(formData.price),
        category: formData.category,
        tags: formData.tags,
        image_urls: [...existingImageUrls, ...newImageUrls]
      };

      if (scriptPath) {
        updateData.script_file_path = scriptPath;
      }

      const { error } = await supabase
        .from('programs')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Program updated',
        description: 'Your Pine Script program has been successfully updated.',
      });

      navigate('/my-programs');
    } catch (error: any) {
      toast({
        title: 'Update failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user || initialLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8 text-center">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Edit Program</CardTitle>
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
                    <Select value={formData.category} onValueChange={(value) => handleInputChange('category', value)} required>
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
                  <Label>Update Pine Script (Optional)</Label>
                  <p className="text-sm text-muted-foreground">
                    Current script type: {currentScriptType === 'link' ? 'TradingView link' : 'Uploaded file'}
                  </p>
                  <RadioGroup value={scriptType} onValueChange={(value: 'file' | 'link') => setScriptType(value)}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="file" id="file" />
                      <Label htmlFor="file">Upload new .txt file</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="link" id="link" />
                      <Label htmlFor="link">Update TradingView publication link</Label>
                    </div>
                  </RadioGroup>

                  {scriptType === 'file' ? (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                      <div className="text-center">
                        <Upload className="mx-auto h-12 w-12 text-gray-400" />
                        <div className="mt-4">
                          <Label htmlFor="script" className="cursor-pointer">
                            <span className="mt-2 block text-sm font-medium text-gray-900">
                              {scriptFile ? scriptFile.name : 'Upload new .txt file to replace existing script'}
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
                        value={tradingViewLink}
                        onChange={(e) => setTradingViewLink(e.target.value)}
                        placeholder="https://www.tradingview.com/script/..."
                      />
                      <p className="text-sm text-muted-foreground">
                        Update the link to your published Pine Script on TradingView
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Current Images</Label>
                  {existingImageUrls.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {existingImageUrls.map((url, index) => (
                        <div key={index} className="relative">
                          <img src={url} alt={`Program ${index + 1}`} className="w-full h-24 object-cover rounded" />
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="absolute top-1 right-1"
                            onClick={() => removeExistingImage(index)}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No images uploaded yet.</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="media">Add More Screenshots & GIFs</Label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                    <div className="text-center">
                      <Upload className="mx-auto h-12 w-12 text-gray-400" />
                      <div className="mt-4">
                        <Label htmlFor="media" className="cursor-pointer">
                          <span className="mt-2 block text-sm font-medium text-gray-900">
                            Upload additional images and GIFs
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
                      <h4 className="text-sm font-medium mb-2">New files to add:</h4>
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
                    {loading ? 'Updating...' : 'Update Program'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => navigate('/my-programs')}>
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

export default EditProgram;
