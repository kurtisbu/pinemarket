
import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Upload, X, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface MediaUploadSectionProps {
  mediaFiles: File[];
  setMediaFiles: React.Dispatch<React.SetStateAction<File[]>>;
}

const MediaUploadSection: React.FC<MediaUploadSectionProps> = ({
  mediaFiles,
  setMediaFiles
}) => {
  const RECOMMENDED_WIDTH = 800;
  const RECOMMENDED_HEIGHT = 600;
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  const resizeImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // Calculate dimensions maintaining aspect ratio
        let { width, height } = img;
        const aspectRatio = width / height;
        
        if (width > RECOMMENDED_WIDTH || height > RECOMMENDED_HEIGHT) {
          if (aspectRatio > RECOMMENDED_WIDTH / RECOMMENDED_HEIGHT) {
            width = RECOMMENDED_WIDTH;
            height = RECOMMENDED_WIDTH / aspectRatio;
          } else {
            height = RECOMMENDED_HEIGHT;
            width = RECOMMENDED_HEIGHT * aspectRatio;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        ctx?.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const resizedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now(),
            });
            resolve(resizedFile);
          } else {
            resolve(file);
          }
        }, file.type, 0.9);
      };
      
      img.src = URL.createObjectURL(file);
    });
  };

  const handleMediaFilesChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const processedFiles: File[] = [];
    
    for (const file of files) {
      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        alert(`${file.name} is too large. Maximum file size is 5MB.`);
        continue;
      }
      
      // Resize image if it's an image file
      if (file.type.startsWith('image/')) {
        try {
          const resizedFile = await resizeImage(file);
          processedFiles.push(resizedFile);
        } catch (error) {
          console.error('Error resizing image:', error);
          processedFiles.push(file);
        }
      } else {
        processedFiles.push(file);
      }
    }
    
    setMediaFiles(prev => [...prev, ...processedFiles]);
  };

  const removeMediaFile = (index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="media">Screenshots & GIFs</Label>
        <Alert className="mt-2">
          <Info className="w-4 h-4" />
          <AlertDescription>
            <strong>Recommended image size:</strong> {RECOMMENDED_WIDTH}x{RECOMMENDED_HEIGHT} pixels. 
            Images will be automatically resized to optimize loading while maintaining quality.
            Maximum file size: 5MB per image.
          </AlertDescription>
        </Alert>
      </div>
      
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
        <div className="text-center">
          <Upload className="mx-auto h-12 w-12 text-gray-400" />
          <div className="mt-4">
            <Label htmlFor="media" className="cursor-pointer">
              <span className="mt-2 block text-sm font-medium text-gray-900">
                Upload images and GIFs to showcase your program
              </span>
              <span className="mt-1 block text-xs text-gray-500">
                PNG, JPG, WebP, GIF up to 5MB each
              </span>
            </Label>
            <Input
              id="media"
              type="file"
              accept="image/*"
              multiple
              onChange={handleMediaFilesChange}
              className="hidden"
            />
          </div>
        </div>
      </div>
      
      {mediaFiles.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium mb-3">Selected files ({mediaFiles.length}):</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {mediaFiles.map((file, index) => (
              <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                <div className="flex items-center space-x-3">
                  {file.type.startsWith('image/') && (
                    <img 
                      src={URL.createObjectURL(file)} 
                      alt={file.name}
                      className="w-12 h-12 object-cover rounded"
                    />
                  )}
                  <div>
                    <span className="text-sm font-medium block">{file.name}</span>
                    <span className="text-xs text-gray-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeMediaFile(index)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MediaUploadSection;
