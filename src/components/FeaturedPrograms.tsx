
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import ProgramCard from './ProgramCard';

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
          )
        `)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(6);

      if (error) throw error;

      return data?.map(program => ({
        ...program,
        seller: Array.isArray(program.profiles) ? program.profiles[0] : program.profiles
      }));
    },
  });

  if (isLoading || !programs || programs.length === 0) {
    // Fallback to static data for demo purposes when no programs exist
    const samplePrograms = [
      {
        id: 'sample-1',
        title: "Advanced Trend Following Strategy",
        description: "A sophisticated trend-following strategy that combines multiple timeframes and RSI divergence for optimal entry and exit points.",
        price: 49.99,
        average_rating: 4.8,
        download_count: 1247,
        view_count: 8934,
        category: "Strategy",
        seller: { display_name: "TradePro" },
        image_urls: ["/placeholder.svg"],
        tags: ["Trend", "RSI", "Multi-timeframe"]
      },
      {
        id: 'sample-2',
        title: "Volume Profile Indicator",
        description: "Professional volume profile indicator with VWAP integration and support/resistance level detection.",
        price: 29.99,
        average_rating: 4.9,
        download_count: 2156,
        view_count: 12450,
        category: "Indicator",
        seller: { display_name: "VolumeExpert" },
        image_urls: ["/placeholder.svg"],
        tags: ["Volume", "VWAP", "Support/Resistance"]
      },
      {
        id: 'sample-3',
        title: "Smart Money Concepts Dashboard",
        description: "Complete dashboard showing institutional order flow, liquidity zones, and market structure analysis.",
        price: 79.99,
        average_rating: 4.7,
        download_count: 834,
        view_count: 6721,
        category: "Indicator",
        seller: { display_name: "SmartFlow" },
        image_urls: ["/placeholder.svg"],
        tags: ["SMC", "Order Flow", "Institutional"]
      },
      {
        id: 'sample-4',
        title: "Fibonacci Auto Retracement",
        description: "Automatically draws Fibonacci retracements and extensions based on swing highs and lows with customizable alerts.",
        price: 24.99,
        average_rating: 4.6,
        download_count: 1789,
        view_count: 9876,
        category: "Indicator",
        seller: { display_name: "FibMaster" },
        image_urls: ["/placeholder.svg"],
        tags: ["Fibonacci", "Auto", "Alerts"]
      },
      {
        id: 'sample-5',
        title: "Options Flow Scanner",
        description: "Real-time options flow scanner with unusual activity detection and whale tracking capabilities.",
        price: 89.99,
        average_rating: 4.8,
        download_count: 567,
        view_count: 4532,
        category: "Screener",
        seller: { display_name: "OptionsGuru" },
        image_urls: ["/placeholder.svg"],
        tags: ["Options", "Scanner", "Whale Tracking"]
      },
      {
        id: 'sample-6',
        title: "Scalping Assistant Pro",
        description: "High-frequency scalping strategy with noise filtering and dynamic stop-loss management for 1-5 minute charts.",
        price: 39.99,
        average_rating: 4.5,
        download_count: 1456,
        view_count: 7843,
        category: "Strategy",
        seller: { display_name: "ScalpKing" },
        image_urls: ["/placeholder.svg"],
        tags: ["Scalping", "High Frequency", "Stop Loss"]
      }
    ];

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
            {samplePrograms.map((program) => (
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
              />
            ))}
          </div>
          
          <div className="text-center mt-12">
            <button 
              onClick={() => navigate('/browse')}
              className="bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white px-8 py-3 rounded-lg font-medium transition-all"
            >
              View All Programs
            </button>
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
            />
          ))}
        </div>
        
        <div className="text-center mt-12">
          <button 
            onClick={() => navigate('/browse')}
            className="bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white px-8 py-3 rounded-lg font-medium transition-all"
          >
            View All Programs
          </button>
        </div>
      </div>
    </section>
  );
};

export default FeaturedPrograms;
