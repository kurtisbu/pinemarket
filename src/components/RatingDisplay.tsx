
import React from 'react';
import { Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface RatingDisplayProps {
  averageRating: number;
  ratingCount: number;
  showCount?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const RatingDisplay: React.FC<RatingDisplayProps> = ({ 
  averageRating, 
  ratingCount, 
  showCount = true,
  size = 'md'
}) => {
  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  const renderStars = () => {
    const stars = [];
    const fullStars = Math.floor(averageRating);
    const hasHalfStar = averageRating % 1 >= 0.5;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(
          <Star 
            key={i} 
            className={`${sizeClasses[size]} fill-yellow-400 text-yellow-400`} 
          />
        );
      } else if (i === fullStars && hasHalfStar) {
        stars.push(
          <div key={i} className="relative">
            <Star className={`${sizeClasses[size]} text-gray-300`} />
            <Star 
              className={`${sizeClasses[size]} fill-yellow-400 text-yellow-400 absolute top-0 left-0`}
              style={{ clipPath: 'inset(0 50% 0 0)' }}
            />
          </div>
        );
      } else {
        stars.push(
          <Star 
            key={i} 
            className={`${sizeClasses[size]} text-gray-300`} 
          />
        );
      }
    }

    return stars;
  };

  if (ratingCount === 0) {
    return (
      <div className="flex items-center gap-1">
        {[...Array(5)].map((_, i) => (
          <Star key={i} className={`${sizeClasses[size]} text-gray-300`} />
        ))}
        <span className={`${textSizeClasses[size]} text-muted-foreground ml-1`}>
          No ratings yet
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center">
        {renderStars()}
      </div>
      <span className={`${textSizeClasses[size]} font-medium ml-1`}>
        {averageRating.toFixed(1)}
      </span>
      {showCount && (
        <Badge variant="secondary" className={`${textSizeClasses[size]} ml-1`}>
          {ratingCount} {ratingCount === 1 ? 'review' : 'reviews'}
        </Badge>
      )}
    </div>
  );
};

export default RatingDisplay;
