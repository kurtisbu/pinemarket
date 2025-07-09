
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Edit2 } from 'lucide-react';
import RatingForm from './RatingForm';
import RatingDisplay from './RatingDisplay';

interface UserRatingSectionProps {
  programId: string;
  onRatingUpdate: () => void;
}

const UserRatingSection: React.FC<UserRatingSectionProps> = ({ 
  programId, 
  onRatingUpdate 
}) => {
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);

  const { data: userRating, refetch } = useQuery({
    queryKey: ['userRating', programId, user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('ratings')
        .select('*')
        .eq('program_id', programId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
      return data;
    },
    enabled: !!user,
  });

  const { data: hasPurchased } = useQuery({
    queryKey: ['hasPurchased', programId, user?.id],
    queryFn: async () => {
      if (!user) return false;

      const { data, error } = await supabase
        .from('purchases')
        .select('id')
        .eq('program_id', programId)
        .eq('buyer_id', user.id)
        .eq('status', 'completed')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      return !!data;
    },
    enabled: !!user,
  });

  const handleRatingSubmitted = () => {
    refetch();
    onRatingUpdate();
    setShowForm(false);
  };

  if (!user || !hasPurchased) {
    return null;
  }

  if (showForm) {
    return (
      <div className="space-y-4">
        <RatingForm
          programId={programId}
          existingRating={userRating}
          onRatingSubmitted={handleRatingSubmitted}
        />
        <Button 
          variant="outline" 
          onClick={() => setShowForm(false)}
        >
          Cancel
        </Button>
      </div>
    );
  }

  if (userRating) {
    return (
      <div className="space-y-4">
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-medium mb-2">Your Rating</h4>
              <RatingDisplay 
                averageRating={userRating.rating} 
                ratingCount={1}
                showCount={false}
              />
              {userRating.review_text && (
                <p className="text-sm text-muted-foreground mt-2">
                  {userRating.review_text}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowForm(true)}
            >
              <Edit2 className="w-4 h-4 mr-1" />
              Edit
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center py-4 border border-dashed rounded-lg">
        <p className="text-muted-foreground mb-2">
          You haven't rated this script yet
        </p>
        <Button onClick={() => setShowForm(true)}>
          Write a Review
        </Button>
      </div>
    </div>
  );
};

export default UserRatingSection;
