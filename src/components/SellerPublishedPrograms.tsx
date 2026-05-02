import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import ProgramCard from '@/components/ProgramCard';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface SellerPublishedProgramsProps {
  sellerId: string;
  sellerUsername: string;
}

const SellerPublishedPrograms: React.FC<SellerPublishedProgramsProps> = ({ sellerId, sellerUsername }) => {
  const navigate = useNavigate();

  const { data: programs, isLoading, error } = useQuery({
    queryKey: ['seller-programs', sellerId],
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
        .eq('seller_id', sellerId)
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map((program: any) => {
        const activePrices = (program.program_prices || []).filter((p: any) => p.is_active);
        const lowestPrice = activePrices.length > 0
          ? Math.min(...activePrices.map((p: any) => Number(p.amount)))
          : program.price;
        const hasMultiplePrices = activePrices.length > 1;
        return { ...program, lowestPrice, hasMultiplePrices };
      });
    },
    enabled: !!sellerId,
  });

  const handleProgramClick = (programId: string) => {
    navigate(`/program/${programId}`);
  };

  return (
    <section className="mt-12">
      <div className="flex items-baseline justify-between mb-6">
        <h2 className="text-3xl font-bold tracking-tight">
          Scripts by {sellerUsername}
        </h2>
        {programs && programs.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {programs.length} {programs.length === 1 ? 'script' : 'scripts'}
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="text-center py-16 text-muted-foreground">
          <p>Error loading scripts. Please try again later.</p>
        </div>
      ) : !programs || programs.length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-lg text-muted-foreground">
          <p>No scripts available yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {programs.map(program => (
            <ProgramCard
              key={program.id}
              program={program}
              onClick={() => handleProgramClick(program.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default SellerPublishedPrograms;
