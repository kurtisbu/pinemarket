
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Star } from 'lucide-react';

interface Rating {
  id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
  profiles: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

interface RatingsListProps {
  programId: string;
}

const RatingsList: React.FC<RatingsListProps> = ({ programId }) => {
  const { data: ratings, isLoading } = useQuery({
    queryKey: ['ratings', programId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ratings')
        .select(`
          id,
          rating,
          review_text,
          created_at,
          profiles (
            display_name,
            username,
            avatar_url
          )
        `)
        .eq('program_id', programId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Rating[];
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Reviews</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-muted rounded-full"></div>
                  <div className="h-4 bg-muted rounded w-24"></div>
                </div>
                <div className="h-3 bg-muted rounded w-full mb-2"></div>
                <div className="h-3 bg-muted rounded w-3/4"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!ratings || ratings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Reviews</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No reviews yet. Be the first to rate this script!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reviews ({ratings.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {ratings.map((rating) => (
          <div key={rating.id} className="border-b pb-4 last:border-b-0">
            <div className="flex items-start gap-3">
              <Avatar className="w-10 h-10">
                <AvatarImage src={rating.profiles.avatar_url || undefined} />
                <AvatarFallback>
                  {(rating.profiles.display_name || rating.profiles.username || 'U')[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium">
                    {rating.profiles.display_name || rating.profiles.username || 'Anonymous User'}
                  </span>
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${
                          i < rating.rating
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {rating.rating}/5
                  </Badge>
                </div>
                
                {rating.review_text && (
                  <p className="text-sm text-muted-foreground mb-2">
                    {rating.review_text}
                  </p>
                )}
                
                <p className="text-xs text-muted-foreground">
                  {new Date(rating.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default RatingsList;
