
import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ImageGalleryProps {
  images: string[];
}

const ImageGallery: React.FC<ImageGalleryProps> = ({ images }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const displayImages = images.length > 0 ? images : ['/placeholder.svg'];

  const goToPrevious = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex === 0 ? displayImages.length - 1 : prevIndex - 1
    );
  };

  const goToNext = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex === displayImages.length - 1 ? 0 : prevIndex + 1
    );
  };

  if (displayImages.length === 1) {
    return (
      <div className="relative">
        <img 
          src={displayImages[0]} 
          alt="Program screenshot"
          className="w-full h-64 md:h-96 object-cover rounded-lg"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main Image */}
      <div className="relative">
        <img 
          src={displayImages[currentIndex]} 
          alt={`Program screenshot ${currentIndex + 1}`}
          className="w-full h-64 md:h-96 object-cover rounded-lg"
        />
        
        {/* Navigation Arrows */}
        <Button
          variant="outline"
          size="icon"
          className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white/90"
          onClick={goToPrevious}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        
        <Button
          variant="outline"
          size="icon"
          className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white/90"
          onClick={goToNext}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
        
        {/* Image Counter */}
        <div className="absolute bottom-4 right-4 bg-black/50 text-white px-3 py-1 rounded text-sm">
          {currentIndex + 1} / {displayImages.length}
        </div>
      </div>
      
      {/* Thumbnail Navigation */}
      <div className="flex space-x-2 overflow-x-auto">
        {displayImages.map((image, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`flex-shrink-0 w-16 h-16 rounded border-2 overflow-hidden ${
              index === currentIndex ? 'border-blue-500' : 'border-gray-300'
            }`}
          >
            <img 
              src={image} 
              alt={`Thumbnail ${index + 1}`}
              className="w-full h-full object-cover"
            />
          </button>
        ))}
      </div>
    </div>
  );
};

export default ImageGallery;
