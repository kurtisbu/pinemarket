
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ProgramCard from '@/components/ProgramCard';
import { Loader2 } from 'lucide-react';

interface SellerPublishedProgramsProps {
  sellerId: string;
  sellerUsername: string;
}

const SellerPublishedPrograms: React.FC<SellerPublishedProgramsProps> = ({ sellerId, sellerUsername }) => {
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
          )
        `)
        .eq('seller_id', sellerId)
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!sellerId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pine Script Programs for Sale</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pine Script Programs for Sale</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>Error loading programs. Please try again later.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pine Script Programs for Sale</CardTitle>
        {programs && programs.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {programs.length} program{programs.length === 1 ? '' : 's'} available
          </p>
        )}
      </CardHeader>
      <CardContent>
        {!programs || programs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No programs available for sale yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {programs.map(program => (
              <ProgramCard
                key={program.id}
                id={program.id}
                title={program.title}
                description={program.description}
                price={program.price}
                rating={program.average_rating}
                downloads={program.download_count}
                views={program.view_count}
                category={program.category}
                author={program.profiles?.display_name || program.profiles?.username || sellerUsername}
                image={program.image_urls?.[0] || '/placeholder.svg'}
                tags={program.tags || []}
                pricing_model={program.pricing_model}
                monthly_price={program.monthly_price}
                yearly_price={program.yearly_price}
                billing_interval={program.billing_interval}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SellerPublishedPrograms;
