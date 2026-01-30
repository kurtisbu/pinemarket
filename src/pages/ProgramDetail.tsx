
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ImageGallery from '@/components/ImageGallery';
import ProgramHeader from '@/components/ProgramDetail/ProgramHeader';
import ProgramDescription from '@/components/ProgramDetail/ProgramDescription';
import ProgramSidebar from '@/components/ProgramDetail/ProgramSidebar';
import UserRatingSection from '@/components/UserRatingSection';
import RatingsList from '@/components/RatingsList';
import ProfileCompletionBanner from '@/components/ProfileCompletionBanner';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

const ProgramDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [refreshKey, setRefreshKey] = useState(0);
  const [hasTradingViewUsername, setHasTradingViewUsername] = useState(true);

  const { data: program, isLoading, error, refetch } = useQuery({
    queryKey: ['program', id, refreshKey],
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

        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    };

    handleStripeSuccess();
  }, [searchParams, user, id, toast, refetch]);

  // Check if user has TradingView username in profile
  useEffect(() => {
    const checkProfile = async () => {
      if (!user) {
        setHasTradingViewUsername(true); // Don't show banner for non-logged in users
        return;
      }
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('tradingview_username')
          .eq('id', user.id)
          .single();

        setHasTradingViewUsername(!!(data?.tradingview_username));
      } catch (error) {
        console.error('Error checking profile:', error);
      }
    };

    checkProfile();
  }, [user]);

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

  const handleRatingUpdate = () => {
    setRefreshKey(prev => prev + 1);
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
        {user && <ProfileCompletionBanner hasTradingViewUsername={hasTradingViewUsername} />}
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-6">
          <div className="lg:col-span-2 space-y-6">
            <ImageGallery images={program.image_urls || []} />
            <ProgramHeader program={program} />
            <ProgramDescription description={program.description} tags={program.tags} programId={program.id} />
            
            <UserRatingSection 
              programId={program.id} 
              onRatingUpdate={handleRatingUpdate}
            />
            
            <RatingsList programId={program.id} />
          </div>
          
          <ProgramSidebar program={program} onViewProfile={handleViewProfile} />
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default ProgramDetail;
