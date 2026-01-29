
import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import StarRatingInput from './StarRatingInput';

interface RatingFormProps {
  programId: string;
  existingRating?: {
    id: string;
    rating: number;
    review_text: string | null;
  };
  onRatingSubmitted: () => void;
}

const RatingForm: React.FC<RatingFormProps> = ({ 
  programId, 
  existingRating, 
  onRatingSubmitted 
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rating, setRating] = useState(existingRating?.rating || 0);
  const [reviewText, setReviewText] = useState(existingRating?.review_text || '');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to submit a rating',
        variant: 'destructive',
      });
      return;
    }

    if (rating === 0) {
      toast({
        title: 'Rating Required',
        description: 'Please select a star rating',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);

    try {
      if (existingRating) {
        // Update existing rating
        const { error } = await supabase
          .from('ratings')
          .update({
            rating,
            review_text: reviewText.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingRating.id);

        if (error) throw error;

        toast({
          title: 'Rating Updated',
          description: 'Your rating has been updated successfully',
        });
      } else {
        // Create new rating
        const { error } = await supabase
          .from('ratings')
          .insert({
            program_id: programId,
            user_id: user.id,
            rating,
            review_text: reviewText.trim() || null,
          });

        if (error) throw error;

        toast({
          title: 'Rating Submitted',
          description: 'Thank you for your feedback!',
        });
      }

      onRatingSubmitted();
    } catch (error: any) {
      console.error('Rating submission error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit rating',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {existingRating ? 'Update Your Rating' : 'Rate This Script'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Your Rating
            </label>
            <StarRatingInput 
              rating={rating} 
              onRatingChange={setRating}
              disabled={submitting}
            />
          </div>

          <div>
            <label htmlFor="review" className="block text-sm font-medium mb-2">
              Review (Optional)
            </label>
            <Textarea
              id="review"
              placeholder="Share your experience with this script..."
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              disabled={submitting}
              maxLength={1000}
              className="min-h-[100px]"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {reviewText.length}/1000 characters
            </p>
          </div>

          <Button type="submit" disabled={submitting || rating === 0}>
            {submitting 
              ? 'Submitting...' 
              : existingRating 
                ? 'Update Rating' 
                : 'Submit Rating'
            }
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default RatingForm;
