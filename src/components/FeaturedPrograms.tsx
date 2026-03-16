import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import ProgramCard from './ProgramCard';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

const FeaturedPrograms = () => {
  const navigate = useNavigate();

  const { data: programs, isLoading } = useQuery({
    queryKey: ['featured-programs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('programs')
        .select(`
          *,
          profiles!seller_id (
            display_name,
            username
          ),
          program_prices (
            amount,
            price_type,
            interval,
            is_active
          )
        `)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(6);

      if (error) throw error;

      return data?.map(program => {
        const activePrices = (program.program_prices || []).filter((p: any) => p.is_active);
        const lowestPrice = activePrices.length > 0 
          ? Math.min(...activePrices.map((p: any) => p.amount))
          : program.price;
        const hasMultiplePrices = activePrices.length > 1;
        
        return {
          ...program,
          seller: Array.isArray(program.profiles) ? program.profiles[0] : program.profiles,
          lowestPrice,
          hasMultiplePrices
        };
      });
    },
  });

  if (isLoading) {
    return (
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Featured Pine Scripts</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!programs || programs.length === 0) {
    return (
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-lg mx-auto">
            <Sparkles className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-3xl font-bold mb-4">No Programs Yet</h2>
            <p className="text-muted-foreground mb-6">
              Be the first to publish a Pine Script program on PineMarket and reach thousands of traders.
            </p>
            <Button onClick={() => navigate('/seller/onboarding')}>
              Start Selling
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Featured Pine Scripts</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Discover the most popular and highest-rated Pine Script programs trusted by thousands of traders
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {programs.map((program) => (
            <ProgramCard
              key={program.id}
              program={program}
              onClick={() => navigate(`/program/${program.id}`)}
            />
          ))}
        </div>
        
        <div className="text-center mt-12">
          <Button onClick={() => navigate('/browse')} size="lg">
            View All Programs
          </Button>
        </div>
      </div>
    </section>
  );
};

export default FeaturedPrograms;
