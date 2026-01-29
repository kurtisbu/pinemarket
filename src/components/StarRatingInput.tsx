
import React, { useState } from 'react';
import { Star } from 'lucide-react';

interface StarRatingInputProps {
  rating: number;
  onRatingChange: (rating: number) => void;
  disabled?: boolean;
}

const StarRatingInput: React.FC<StarRatingInputProps> = ({ 
  rating, 
  onRatingChange, 
  disabled = false 
}) => {
  const [hoverRating, setHoverRating] = useState(0);

  const handleMouseEnter = (starIndex: number) => {
    if (!disabled) {
      setHoverRating(starIndex);
    }
  };

  const handleMouseLeave = () => {
    if (!disabled) {
      setHoverRating(0);
    }
  };

  const handleClick = (starIndex: number) => {
    if (!disabled) {
      onRatingChange(starIndex);
    }
  };

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => {
        const isActive = star <= (hoverRating || rating);
        return (
          <button
            key={star}
            type="button"
            className={`p-1 transition-colors ${
              disabled ? 'cursor-default' : 'cursor-pointer hover:scale-110'
            }`}
            onMouseEnter={() => handleMouseEnter(star)}
            onMouseLeave={handleMouseLeave}
            onClick={() => handleClick(star)}
            disabled={disabled}
          >
            <Star
              className={`w-6 h-6 transition-colors ${
                isActive
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-gray-300 hover:text-yellow-200'
              }`}
            />
          </button>
        );
      })}
    </div>
  );
};

export default StarRatingInput;
