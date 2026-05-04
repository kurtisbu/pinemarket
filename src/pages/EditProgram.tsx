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
import { Alert, AlertDescription } from '@/components/ui/alert';
import Header from '@/components/Header';
import ScriptSelector from '@/components/SellScript/ScriptSelector';
import { PriceManager, type PriceObject } from '@/components/SellScript/PriceManager';
import { Upload, X, Plus, Info } from 'lucide-react';

const EditProgram = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [currentTag, setCurrentTag] = useState('');
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
  const [selectedScripts, setSelectedScripts] = useState<string[]>([]);
  const [prices, setPrices] = useState<PriceObject[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    tags: [] as string[],
    status: 'draft',
    tradingview_publication_url: '',
  });

  const categories = ['Indicator', 'Strategy', 'Utility', 'Screener', 'Library', 'Educational'];

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (id) fetchProgram();
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
        category: data.category,
        tags: data.tags || [],
        status: data.status,
        tradingview_publication_url: data.tradingview_publication_url || '',
      });
      setExistingImageUrls(data.image_urls || []);

      const { data: programScripts } = await supabase
        .from('program_scripts')
        .select('tradingview_script_id')
        .eq('program_id', id);
      setSelectedScripts(programScripts?.map((ps) => ps.tradingview_script_id) || []);

      const { data: programPrices } = await supabase
        .from('program_prices')
        .select('*')
        .eq('program_id', id)
        .eq('is_active', true)
        .order('sort_order');
      setPrices(
        (programPrices || []).map((p) => ({
          id: p.id,
          price_type: p.price_type as 'one_time' | 'recurring',
          amount: String(p.amount),
          interval: (p.interval || undefined) as PriceObject['interval'],
          display_name: p.display_name,
          description: p.description || '',
        })),
      );
    } catch (error: any) {
      toast({ title: 'Error', description: 'Failed to fetch program details', variant: 'destructive' });
      navigate('/my-programs');
    } finally {
      setInitialLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const addTag = () => {
    if (currentTag.trim() && !formData.tags.includes(currentTag.trim())) {
      setFormData((prev) => ({ ...prev, tags: [...prev.tags, currentTag.trim()] }));
      setCurrentTag('');
    }
  };

  const removeTag = (tagToRemove: string) =>
    setFormData((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tagToRemove) }));

  const handleMediaFilesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setMediaFiles((prev) => [...prev, ...files]);
  };

  const removeMediaFile = (index: number) => setMediaFiles((prev) => prev.filter((_, i) => i !== index));
  const removeExistingImage = (index: number) => setExistingImageUrls((prev) => prev.filter((_, i) => i !== index));

  const uploadFile = async (file: File, bucket: string, folder: string) => {
    const fileName = `${folder}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from(bucket).upload(fileName, file);
    if (error) throw error;
    if (bucket === 'program-media') {
      const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(fileName);
      return publicUrl;
    }
    return fileName;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (selectedScripts.length === 0) {
      toast({ title: 'Select at least one script', description: 'Please select at least one TradingView script.', variant: 'destructive' });
      return;
    }
    if (prices.length === 0) {
      toast({ title: 'Add at least one price', description: 'Please add at least one pricing option.', variant: 'destructive' });
      return;
    }
    for (const p of prices) {
      if (!p.display_name.trim() || !p.amount || isNaN(parseFloat(p.amount))) {
        toast({ title: 'Invalid price', description: 'All prices need a display name and a valid amount.', variant: 'destructive' });
        return;
      }
      if (p.price_type === 'recurring' && !p.interval) {
        toast({ title: 'Missing interval', description: 'Recurring prices need a billing interval.', variant: 'destructive' });
        return;
      }
    }

    setLoading(true);
    try {
      const newImageUrls: string[] = [];
      for (const file of mediaFiles) {
        const url = await uploadFile(file, 'program-media', user.id);
        newImageUrls.push(url);
      }

      const updateData: Record<string, unknown> = {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        tags: formData.tags,
        image_urls: [...existingImageUrls, ...newImageUrls],
        tradingview_publication_url: formData.tradingview_publication_url?.trim() || null,
      };

      const { error } = await supabase.from('programs').update(updateData).eq('id', id);
      if (error) throw error;

      // Sync prices via edge function (handles Stripe)
      const isExistingId = (pid: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pid);
      const { data: pricesResp, error: pricesError } = await supabase.functions.invoke('update-program-prices', {
        body: {
          programId: id,
          prices: prices.map((p, idx) => ({
            // Only pass id if it looks like a real DB UUID we loaded; new client-side ids from PriceManager are also UUIDs but won't match existing rows — backend handles missing matches as new.
            id: p.id,
            price_type: p.price_type,
            amount: parseFloat(p.amount),
            interval: p.interval || null,
            display_name: p.display_name,
            description: p.description || null,
            sort_order: idx,
          })),
        },
      });
      if (pricesError) throw pricesError;
      if (pricesResp?.error) throw new Error(pricesResp.error);

      // Update program_scripts: delete old and insert new
      await supabase.from('program_scripts').delete().eq('program_id', id);
      const scriptLinks = selectedScripts.map((scriptId, index) => ({
        program_id: id,
        tradingview_script_id: scriptId,
        display_order: index,
      }));
      const { error: scriptsError } = await supabase.from('program_scripts').insert(scriptLinks);
      if (scriptsError) throw scriptsError;

      toast({ title: 'Program updated', description: 'Your program has been updated.' });
      navigate('/my-programs');
    } catch (error: any) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (!user || initialLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8 text-center">Loading...</div>
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
                    <Input id="title" value={formData.title} onChange={(e) => handleInputChange('title', e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category *</Label>
                    <Select value={formData.category} onValueChange={(v) => handleInputChange('category', v)} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea id="description" value={formData.description} onChange={(e) => handleInputChange('description', e.target.value)} rows={6} required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tradingview_publication_url">TradingView Publication Link (Optional)</Label>
                  <Input id="tradingview_publication_url" type="url" value={formData.tradingview_publication_url} onChange={(e) => handleInputChange('tradingview_publication_url', e.target.value)} placeholder="https://www.tradingview.com/script/..." />
                </div>

                <div className="space-y-2">
                  <Label>Tags</Label>
                  <div className="flex gap-2 mb-2">
                    <Input value={currentTag} onChange={(e) => setCurrentTag(e.target.value)} placeholder="Add a tag" onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())} />
                    <Button type="button" onClick={addTag} variant="outline"><Plus className="w-4 h-4" /></Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                        {tag}<X className="w-3 h-3 cursor-pointer" onClick={() => removeTag(tag)} />
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <PriceManager prices={prices} onPricesChange={setPrices} />
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Changing the amount, interval, or type of an existing price creates a new price for new buyers.
                      Active subscribers continue to be billed at their original rate until they cancel and resubscribe.
                    </AlertDescription>
                  </Alert>
                </div>

                <ScriptSelector selectedScripts={selectedScripts} onSelectionChange={setSelectedScripts} />

                <div className="space-y-2">
                  <Label>Current Images</Label>
                  {existingImageUrls.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {existingImageUrls.map((url, index) => (
                        <div key={index} className="relative">
                          <img src={url} alt={`Program ${index + 1}`} className="w-full h-24 object-cover rounded" />
                          <Button type="button" variant="destructive" size="sm" className="absolute top-1 right-1" onClick={() => removeExistingImage(index)}>
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
                  <div className="border-2 border-dashed border-border rounded-lg p-6">
                    <div className="text-center">
                      <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                      <div className="mt-4">
                        <Label htmlFor="media" className="cursor-pointer">
                          <span className="mt-2 block text-sm font-medium">Upload additional images and GIFs</span>
                        </Label>
                        <Input id="media" type="file" accept="image/*" multiple onChange={handleMediaFilesChange} className="hidden" />
                      </div>
                    </div>
                  </div>
                  {mediaFiles.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium mb-2">New files to add:</h4>
                      <div className="space-y-2">
                        {mediaFiles.map((file, index) => (
                          <div key={index} className="flex items-center justify-between bg-muted p-2 rounded">
                            <span className="text-sm">{file.name}</span>
                            <Button type="button" variant="ghost" size="sm" onClick={() => removeMediaFile(index)}>
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-4">
                  <Button type="submit" disabled={loading || selectedScripts.length === 0 || prices.length === 0} className="flex-1">
                    {loading ? 'Updating...' : 'Update Program'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => navigate('/my-programs')}>Cancel</Button>
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
