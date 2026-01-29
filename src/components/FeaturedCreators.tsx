import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Star, TrendingUp, Users, ArrowRight, Award } from 'lucide-react';

interface FeaturedCreator {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  bio: string;
  featured_description: string;
  total_programs: number;
  avg_rating: number;
  total_sales: number;
}

interface FeaturedCreatorsProps {
  limit?: number;
  showHeader?: boolean;
  className?: string;
}

const FeaturedCreators: React.FC<FeaturedCreatorsProps> = ({ 
  limit = 6, 
  showHeader = true, 
  className = '' 
}) => {
  const [creators, setCreators] = useState<FeaturedCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchFeaturedCreators();
  }, []);

  const fetchFeaturedCreators = async () => {
    try {
      const { data, error } = await supabase.rpc('get_featured_creators_with_stats');

      if (error) throw error;
      
      // Apply limit on client side since the function returns all featured creators
      const limitedData = limit ? (data || []).slice(0, limit) : (data || []);
      setCreators(limitedData);
    } catch (error) {
      console.error('Error fetching featured creators:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewProfile = (username: string) => {
    navigate(`/profile/${username}`);
  };

  const handleViewAllCreators = () => {
    navigate('/creators');
  };

  if (loading) {
    return (
      <div className={`space-y-6 ${className}`}>
        {showHeader && (
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-2">Featured Creators</h2>
            <p className="text-muted-foreground">Discover our top-performing creators</p>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className="animate-pulse">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-muted rounded-full" />
                    <div className="space-y-2 flex-1">
                      <div className="h-4 bg-muted rounded w-3/4" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 bg-muted rounded w-full" />
                    <div className="h-3 bg-muted rounded w-2/3" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (creators.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {showHeader && (
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center space-x-2 mb-2">
            <Award className="w-6 h-6 text-amber-500" />
            <h2 className="text-3xl font-bold bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
              Featured Creators
            </h2>
            <Award className="w-6 h-6 text-amber-500" />
          </div>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Discover our handpicked selection of top-performing creators who consistently deliver 
            exceptional trading scripts and innovative solutions
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {creators.map((creator) => (
          <Card 
            key={creator.id} 
            className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-background to-muted/20"
          >
            <CardContent className="p-6 space-y-4">
              {/* Creator Header */}
              <div className="flex items-start space-x-3">
                <div className="relative">
                  <Avatar className="h-12 w-12 ring-2 ring-amber-500/20">
                    <AvatarImage src={creator.avatar_url} />
                    <AvatarFallback className="bg-gradient-to-br from-amber-500 to-orange-500 text-white">
                      {creator.display_name?.[0] || creator.username?.[0] || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <Badge 
                    variant="default" 
                    className="absolute -top-1 -right-1 p-0 h-5 w-5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 border-2 border-background"
                  >
                    <Star className="w-2.5 h-2.5" />
                  </Badge>
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                    {creator.display_name || creator.username}
                  </h3>
                  <p className="text-sm text-muted-foreground">@{creator.username}</p>
                </div>
              </div>

              {/* Featured Description or Bio */}
              <div className="space-y-2">
                {creator.featured_description && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      {creator.featured_description}
                    </p>
                  </div>
                )}
                {creator.bio && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {creator.bio}
                  </p>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 py-3 border-t border-border">
                <div className="text-center space-y-1">
                  <div className="flex items-center justify-center space-x-1">
                    <TrendingUp className="w-4 h-4 text-blue-500" />
                    <span className="text-lg font-semibold">{creator.total_programs}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Programs</p>
                </div>
                
                <div className="text-center space-y-1">
                  <div className="flex items-center justify-center space-x-1">
                    <Users className="w-4 h-4 text-green-500" />
                    <span className="text-lg font-semibold">{creator.total_sales}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Sales</p>
                </div>
              </div>

              {/* Rating */}
              {creator.avg_rating > 0 && (
                <div className="flex items-center justify-center space-x-1 py-2">
                  <div className="flex items-center space-x-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${
                          i < Math.floor(creator.avg_rating)
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-muted-foreground'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-sm font-medium">{creator.avg_rating.toFixed(1)}</span>
                </div>
              )}

              {/* View Profile Button */}
              <Button
                variant="outline"
                className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                onClick={() => handleViewProfile(creator.username)}
              >
                View Profile
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* View All Button */}
      {showHeader && (
        <div className="text-center">
          <Button
            variant="outline"
            size="lg"
            onClick={handleViewAllCreators}
            className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 hover:from-amber-500/20 hover:to-orange-500/20 border-amber-200 dark:border-amber-800"
          >
            View All Featured Creators
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default FeaturedCreators;