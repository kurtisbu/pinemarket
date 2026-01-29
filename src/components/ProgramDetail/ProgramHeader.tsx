
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Eye, Download } from 'lucide-react';
import RatingDisplay from '@/components/RatingDisplay';

interface ProgramHeaderProps {
  program: {
    title: string;
    category: string;
    view_count: number;
    download_count: number;
    average_rating: number;
    rating_count: number;
    profiles?: {
      display_name: string | null;
      username: string | null;
    };
  };
}

const ProgramHeader: React.FC<ProgramHeaderProps> = ({ program }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h1 className="text-3xl font-bold mb-2">{program.title}</h1>
          <div className="flex items-center gap-4 text-muted-foreground">
            {program.profiles && (
              <span>
                by {program.profiles.display_name || program.profiles.username}
              </span>
            )}
            <Badge variant="secondary">{program.category}</Badge>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <RatingDisplay 
          averageRating={program.average_rating} 
          ratingCount={program.rating_count}
        />
        
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Eye className="w-4 h-4" />
            <span>{program.view_count} views</span>
          </div>
          <div className="flex items-center gap-1">
            <Download className="w-4 h-4" />
            <span>{program.download_count} downloads</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProgramHeader;
