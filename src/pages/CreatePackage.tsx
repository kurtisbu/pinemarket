import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Package, Plus, X } from 'lucide-react';
import StripeConnectBanner from '@/components/StripeConnectBanner';
import { PriceManager, type PriceObject } from '@/components/SellScript/PriceManager';

interface Program {
  id: string;
  title: string;
  description: string;
  image_urls: string[];
}

const CreatePackage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [loadingPrograms, setLoadingPrograms] = useState(true);
  const [stripeStatus, setStripeStatus] = useState({
    account_id: null as string | null,
    charges_enabled: false,
  });
  
  const [availablePrograms, setAvailablePrograms] = useState<Program[]>([]);
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [prices, setPrices] = useState<PriceObject[]>([]);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
  });

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    
    fetchStripeStatus();
    fetchSellerPrograms();
  }, [user, navigate]);

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
      });
    } catch (error) {
      console.error('Error fetching Stripe status:', error);
    }
  };

  const fetchSellerPrograms = async () => {
    if (!user) return;
    
    setLoadingPrograms(true);
    try {
      const { data, error } = await supabase
        .from('programs')
        .select('id, title, description, image_urls')
        .eq('seller_id', user.id)
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setAvailablePrograms(data || []);
    } catch (error) {
      console.error('Error fetching programs:', error);
      toast({
        title: 'Error',
        description: 'Failed to load your programs',
        variant: 'destructive',
      });
    } finally {
      setLoadingPrograms(false);
    }
  };

  const toggleProgram = (programId: string) => {
    setSelectedPrograms(prev =>
      prev.includes(programId)
        ? prev.filter(id => id !== programId)
        : [...prev, programId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;

    // Validate
    if (!formData.title.trim()) {
      toast({
        title: 'Title required',
        description: 'Please enter a package title',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.description.trim()) {
      toast({
        title: 'Description required',
        description: 'Please enter a package description',
        variant: 'destructive',
      });
      return;
    }

    if (selectedPrograms.length < 2) {
      toast({
        title: 'Select at least 2 programs',
        description: 'A package must contain at least 2 programs',
        variant: 'destructive',
      });
      return;
    }

    if (prices.length === 0) {
      toast({
        title: 'At least one price required',
        description: 'Please add at least one pricing option',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      // Create package
      const { data: packageData, error: packageError } = await supabase
        .from('program_packages')
        .insert({
          seller_id: user.id,
          title: formData.title,
          description: formData.description,
          status: 'draft',
        })
        .select()
        .single();

      if (packageError) throw packageError;

      // Add programs to package
      const packagePrograms = selectedPrograms.map((programId, index) => ({
        package_id: packageData.id,
        program_id: programId,
        display_order: index,
      }));

      const { error: programsError } = await supabase
        .from('package_programs')
        .insert(packagePrograms);

      if (programsError) throw programsError;

      // Create Stripe products and prices
      const { data: stripeData, error: stripeError } = await supabase.functions.invoke(
        'create-program-prices',
        {
          body: {
            resourceType: 'package',
            resourceId: packageData.id,
            prices: prices.map(p => ({
              display_name: p.display_name,
              description: p.description,
              amount: parseFloat(p.amount),
              currency: 'USD',
              price_type: p.price_type,
              interval: p.interval,
            })),
          },
        }
      );

      if (stripeError) throw stripeError;

      // Save prices to database
      const pricesWithStripeIds = prices.map((price, index) => ({
        package_id: packageData.id,
        display_name: price.display_name,
        description: price.description,
        amount: parseFloat(price.amount),
        currency: 'USD',
        price_type: price.price_type,
        interval: price.interval,
        stripe_price_id: stripeData.prices[index].stripe_price_id,
        sort_order: index,
      }));

      const { error: pricesError } = await supabase
        .from('package_prices')
        .insert(pricesWithStripeIds);

      if (pricesError) throw pricesError;

      toast({
        title: 'Package created!',
        description: 'Your package has been created as a draft. You can publish it from your dashboard.',
      });

      navigate('/seller-dashboard');
    } catch (error: any) {
      console.error('Error creating package:', error);
      toast({
        title: 'Failed to create package',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const isStripeConnected = stripeStatus.account_id && stripeStatus.charges_enabled;

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <StripeConnectBanner
          stripeAccountId={stripeStatus.account_id}
          stripeChargesEnabled={stripeStatus.charges_enabled}
          variant="error"
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-6 w-6" />
              Create Program Package
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Package Details */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Package Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g., Complete Trading Suite"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="description">Package Description *</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe what's included in this package and why buyers should choose it..."
                    rows={4}
                    required
                  />
                </div>
              </div>

              {/* Program Selection */}
              <div className="space-y-4">
                <Label>Select Programs to Include *</Label>
                <p className="text-sm text-muted-foreground">
                  Choose at least 2 programs from your published listings
                </p>
                
                {loadingPrograms ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : availablePrograms.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>You need to publish at least 2 programs before creating a package.</p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigate('/sell-script')}
                      className="mt-4"
                    >
                      Create Program
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto border rounded-lg p-4">
                    {availablePrograms.map((program) => (
                      <div
                        key={program.id}
                        className="flex items-start gap-3 p-3 rounded-lg hover:bg-accent transition-colors"
                      >
                        <Checkbox
                          id={program.id}
                          checked={selectedPrograms.includes(program.id)}
                          onCheckedChange={() => toggleProgram(program.id)}
                        />
                        <label
                          htmlFor={program.id}
                          className="flex-1 cursor-pointer"
                        >
                          <h4 className="font-medium">{program.title}</h4>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {program.description}
                          </p>
                        </label>
                      </div>
                    ))}
                  </div>
                )}

                {selectedPrograms.length > 0 && (
                  <p className="text-sm text-primary">
                    {selectedPrograms.length} program{selectedPrograms.length > 1 ? 's' : ''} selected
                  </p>
                )}
              </div>

              {/* Pricing */}
              <div className="space-y-4">
                <Label>Package Pricing *</Label>
                <PriceManager prices={prices} onPricesChange={setPrices} />
              </div>

              {/* Submit */}
              <Button
                type="submit"
                disabled={loading || !isStripeConnected || selectedPrograms.length < 2}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Package...
                  </>
                ) : (
                  'Create Package (as Draft)'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CreatePackage;
