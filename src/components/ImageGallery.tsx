
import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';

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

  const goToImage = (index: number) => {
    setCurrentIndex(index);
  };

  if (displayImages.length === 1) {
    return (
      <div className="relative group">
        <Dialog>
          <DialogTrigger asChild>
            <div className="relative cursor-pointer">
              <img 
                src={displayImages[0]} 
                alt="Program screenshot"
                className="w-full h-64 md:h-96 object-cover rounded-lg transition-all duration-200 group-hover:brightness-110"
              />
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all duration-200 rounded-lg flex items-center justify-center">
                <Maximize2 className="w-8 h-8 text-white opacity-0 group-hover:opacity-80 transition-opacity duration-200" />
              </div>
            </div>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] p-0">
            <img 
              src={displayImages[0]} 
              alt="Program screenshot"
              className="w-full h-auto max-h-[85vh] object-contain rounded-md"
            />
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main Image */}
      <div className="relative group">
        <Dialog>
          <DialogTrigger asChild>
            <div className="relative cursor-pointer">
              <img 
                src={displayImages[currentIndex]} 
                alt={`Program screenshot ${currentIndex + 1}`}
                className="w-full h-64 md:h-96 object-cover rounded-lg transition-all duration-200 group-hover:brightness-110"
              />
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all duration-200 rounded-lg flex items-center justify-center">
                <Maximize2 className="w-8 h-8 text-white opacity-0 group-hover:opacity-80 transition-opacity duration-200" />
              </div>
            </div>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] p-0">
            <img 
              src={displayImages[currentIndex]} 
              alt={`Program screenshot ${currentIndex + 1}`}
              className="w-full h-auto max-h-[85vh] object-contain rounded-md"
            />
          </DialogContent>
        </Dialog>
        
        {/* Navigation Arrows */}
        {displayImages.length > 1 && (
          <>
            <Button
              variant="outline"
              size="icon"
              className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white/90 hover:bg-white shadow-lg opacity-80 hover:opacity-100 transition-opacity"
              onClick={goToPrevious}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            
            <Button
              variant="outline"
              size="icon"
              className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white/90 hover:bg-white shadow-lg opacity-80 hover:opacity-100 transition-opacity"
              onClick={goToNext}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </>
        )}
        
        {/* Image Counter */}
        {displayImages.length > 1 && (
          <div className="absolute bottom-4 right-4 bg-black/70 text-white px-3 py-1 rounded-full text-sm font-medium">
            {currentIndex + 1} / {displayImages.length}
          </div>
        )}
      </div>
      
      {/* Thumbnail Navigation */}
      {displayImages.length > 1 && (
        <div className="flex space-x-2 overflow-x-auto pb-2">
          {displayImages.map((image, index) => (
            <button
              key={index}
              onClick={() => goToImage(index)}
              className={`flex-shrink-0 w-20 h-16 rounded-md border-2 overflow-hidden transition-all duration-200 ${
                index === currentIndex 
                  ? 'border-blue-500 ring-2 ring-blue-200 shadow-md' 
                  : 'border-gray-300 hover:border-gray-400 hover:shadow-sm'
              }`}
            >
              <img 
                src={image} 
                alt={`Thumbnail ${index + 1}`}
                className="w-full h-full object-cover transition-all duration-200 hover:scale-105"
              />
            </button>
          ))}
        </div>
      )}
      
      {/* Image Navigation Dots (for mobile) */}
      {displayImages.length > 1 && displayImages.length <= 8 && (
        <div className="flex justify-center space-x-2 md:hidden">
          {displayImages.map((_, index) => (
            <button
              key={index}
              onClick={() => goToImage(index)}
              className={`w-2 h-2 rounded-full transition-all duration-200 ${
                index === currentIndex 
                  ? 'bg-blue-500 scale-125' 
                  : 'bg-gray-300 hover:bg-gray-400'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ImageGallery;
