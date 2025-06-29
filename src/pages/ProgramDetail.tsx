import React, { useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ImageGallery from '@/components/ImageGallery';
import DeliveryInfo from '@/components/DeliveryInfo';
import SellerInfo from '@/components/SellerInfo';
import ProgramPurchaseSection from '@/components/ProgramPurchaseSection';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Star, Download, Eye, Calendar, CreditCard } from 'lucide-react';
import { Loader2 } from 'lucide-react';

const ProgramDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: program, isLoading, error, refetch } = useQuery({
    queryKey: ['program', id],
    queryFn: async () => {
      if (!id) throw new Error('Program ID is required');

      const { data, error } = await supabase
        .from('programs')
        .select(`
          *,
          profiles!seller_id (
            display_name,
            username,
            avatar_url,
            bio,
            is_tradingview_connected,
            tradingview_username
          )
        `)
        .eq('id', id)
        .eq('status', 'published')
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Handle Stripe success callback
  useEffect(() => {
    const handleStripeSuccess = async () => {
      const success = searchParams.get('success');
      const sessionId = searchParams.get('session_id');
      
      if (success === 'true' && sessionId && user && id) {
        console.log('Stripe success detected, processing purchase completion...', { sessionId, programId: id });
        
        try {
          // Call the stripe-connect function to complete the purchase
          const { data, error } = await supabase.functions.invoke('stripe-connect', {
            body: {
              action: 'complete-stripe-purchase',
              session_id: sessionId,
              program_id: id,
            },
          });

          if (error) {
            console.error('Purchase completion error:', error);
            toast({
              title: 'Payment processed, but setup incomplete',
              description: 'Your payment was successful, but there was an issue setting up script access. Please contact support.',
              variant: 'destructive',
            });
          } else {
            console.log('Purchase completion successful:', data);
            toast({
              title: 'Purchase successful!',
              description: 'Your payment has been processed and script access is being set up.',
            });
            
            // Refetch program data to update UI
            refetch();
          }
        } catch (error: any) {
          console.error('Purchase completion failed:', error);
          toast({
            title: 'Payment processed, but setup incomplete',
            description: 'Your payment was successful, but there was an issue setting up script access. Please contact support.',
            variant: 'destructive',
          });
        }

        // Clean up URL parameters
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    };

    handleStripeSuccess();
  }, [searchParams, user, id, toast, refetch]);

  // Increment view count when program is loaded
  useEffect(() => {
    if (program && id) {
      supabase.rpc('increment_program_view_count', { program_uuid: id });
    }
  }, [program, id]);

  const handleViewProfile = () => {
    if (program?.profiles?.username) {
      navigate(`/profile/${program.profiles.username}`);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex justify-center items-center py-12">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !program) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-12 text-center">
          <h1 className="text-2xl font-bold mb-4">Program Not Found</h1>
          <p className="text-muted-foreground mb-4">
            The program you're looking for doesn't exist or has been removed.
          </p>
          <Button onClick={() => navigate('/browse')}>
            Browse All Programs
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Image Gallery */}
            <ImageGallery images={program.image_urls || []} />
            
            {/* Program Details */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Badge className="bg-blue-500 hover:bg-blue-600">
                  {program.category}
                </Badge>
                <Badge variant="secondary">
                  <CreditCard className="w-3 h-3 mr-1" />
                  One-time Purchase
                </Badge>
                <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span>{program.average_rating.toFixed(1)}</span>
                  <span>({program.rating_count} reviews)</span>
                </div>
              </div>
              
              <h1 className="text-3xl font-bold mb-2">{program.title}</h1>
              
              {/* Pricing Display */}
              <div className="mb-4">
                <div className="text-2xl font-bold text-green-600">
                  ${program.price}
                </div>
                <div className="text-sm text-muted-foreground">
                  One-time payment for lifetime access
                </div>
              </div>
              
              <div className="flex items-center gap-6 text-sm text-muted-foreground mb-6">
                <div className="flex items-center space-x-1">
                  <Download className="w-4 h-4" />
                  <span>{program.download_count} downloads</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Eye className="w-4 h-4" />
                  <span>{program.view_count} views</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Calendar className="w-4 h-4" />
                  <span>Published {formatDate(program.created_at)}</span>
                </div>
              </div>
              
              <Separator className="my-6" />
              
              <div>
                <h2 className="text-xl font-semibold mb-4">Description</h2>
                <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {program.description}
                </p>
              </div>

              {/* Pricing Model Information */}
              <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                <h3 className="text-lg font-semibold mb-2">Pricing Details</h3>
                <div className="space-y-2 text-sm">
                  <p className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    <strong>One-time Purchase:</strong> Pay once and own this script forever
                  </p>
                  <p>No recurring charges or subscription fees</p>
                  <p>Lifetime access to updates and improvements</p>
                </div>
              </div>
              
              {program.tags && program.tags.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-3">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {program.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Sidebar */}
          <div className="space-y-6">
            <DeliveryInfo program={program} />
            <ProgramPurchaseSection program={program} />
            <SellerInfo program={program} onViewProfile={handleViewProfile} />
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default ProgramDetail;
