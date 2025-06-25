
import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Upload, X } from 'lucide-react';

interface MediaUploadSectionProps {
  mediaFiles: File[];
  setMediaFiles: React.Dispatch<React.SetStateAction<File[]>>;
}

const MediaUploadSection: React.FC<MediaUploadSectionProps> = ({
  mediaFiles,
  setMediaFiles
}) => {
  const handleMediaFilesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setMediaFiles(prev => [...prev, ...files]);
  };

  const removeMediaFile = (index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="media">Screenshots & GIFs (Optional)</Label>
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
        <div className="text-center">
          <Upload className="mx-auto h-12 w-12 text-gray-400" />
          <div className="mt-4">
            <Label htmlFor="media" className="cursor-pointer">
              <span className="mt-2 block text-sm font-medium text-gray-900">
                Upload images and GIFs to showcase your program
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
          <h4 className="text-sm font-medium mb-2">Selected files:</h4>
          <div className="space-y-2">
            {mediaFiles.map((file, index) => (
              <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                <span className="text-sm">{file.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeMediaFile(index)}
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
