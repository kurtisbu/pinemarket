
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ProgramCard from '@/components/ProgramCard';
import SearchAndSort from '@/components/SearchAndSort';
import CategoryFilter from '@/components/CategoryFilter';
import { Loader2 } from 'lucide-react';

interface Program {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  tags: string[];
  image_urls: string[];
  view_count: number;
  download_count: number;
  average_rating: number;
  rating_count: number;
  created_at: string;
  pricing_model: string;
  monthly_price: number | null;
  yearly_price: number | null;
  billing_interval: string | null;
  seller: {
    display_name: string;
    username: string;
  };
}

const Browse = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeCategory, setActiveCategory] = useState(searchParams.get('category') || 'All');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'newest');

  // Update URL params when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (activeCategory !== 'All') params.set('category', activeCategory);
    if (searchQuery) params.set('search', searchQuery);
    if (sortBy !== 'newest') params.set('sort', sortBy);
    setSearchParams(params);
  }, [activeCategory, searchQuery, sortBy, setSearchParams]);

  const { data: programs, isLoading, error } = useQuery({
    queryKey: ['programs', activeCategory, searchQuery, sortBy],
    queryFn: async () => {
      let query = supabase
        .from('programs')
        .select(`
          *,
          profiles!seller_id (
            display_name,
            username
          )
        `)
        .eq('status', 'published');

      // Apply category filter
      if (activeCategory !== 'All') {
        query = query.eq('category', activeCategory);
      }

      // Apply search filter
      if (searchQuery) {
        query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
      }

      // Apply sorting
      switch (sortBy) {
        case 'popular':
          query = query.order('view_count', { ascending: false });
          break;
        case 'rated':
          query = query.order('average_rating', { ascending: false });
          break;
        case 'newest':
        default:
          query = query.order('created_at', { ascending: false });
          break;
      }

      const { data, error } = await query;

      if (error) throw error;

      return data?.map(program => ({
        ...program,
        seller: Array.isArray(program.profiles) ? program.profiles[0] : program.profiles
      })) as Program[];
    },
  });

  const { data: categoryCounts } = useQuery({
    queryKey: ['category-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('programs')
        .select('category')
        .eq('status', 'published');

      if (error) throw error;

      const counts = data.reduce((acc, program) => {
        acc[program.category] = (acc[program.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        All: data.length,
        ...counts
      };
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <Header onSearch={setSearchQuery} searchQuery={searchQuery} />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4">Browse Pine Scripts</h1>
          <p className="text-muted-foreground">
            Discover professional TradingView indicators and strategies
          </p>
        </div>

        <SearchAndSort 
          sortBy={sortBy} 
          onSortChange={setSortBy}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        <CategoryFilter 
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          categoryCounts={categoryCounts || {}}
        />

        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-destructive">Failed to load programs. Please try again.</p>
          </div>
        ) : !programs || programs.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No programs found matching your criteria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {programs.map((program) => (
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
                author={program.seller?.display_name || 'Unknown'}
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
      </main>

      <Footer />
    </div>
  );
};

export default Browse;
