
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Eye, Download } from 'lucide-react';
import RatingDisplay from './RatingDisplay';

interface Program {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  image_urls: string[];
  view_count: number;
  download_count: number;
  average_rating: number;
  rating_count: number;
  lowestPrice?: number;
  hasMultiplePrices?: boolean;
  profiles?: {
    display_name: string | null;
    username: string | null;
  };
}

interface ProgramCardProps {
  program: Program;
  onClick: () => void;
}

const ProgramCard: React.FC<ProgramCardProps> = ({ program, onClick }) => {
  return (
    <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={onClick}>
      <CardHeader className="p-0">
        {program.image_urls && program.image_urls[0] && (
          <img
            src={program.image_urls[0]}
            alt={program.title}
            className="w-full h-48 object-cover rounded-t-lg"
          />
        )}
      </CardHeader>
      
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-lg line-clamp-2">{program.title}</h3>
          <Badge variant="secondary">{program.category}</Badge>
        </div>
        
        <p className="text-muted-foreground text-sm line-clamp-2 mb-3">
          {program.description}
        </p>

        <RatingDisplay 
          averageRating={program.average_rating} 
          ratingCount={program.rating_count}
          size="sm"
        />
        
        {program.profiles && (
          <p className="text-xs text-muted-foreground mt-2">
            by {program.profiles.display_name || program.profiles.username}
          </p>
        )}
      </CardContent>
      
      <CardFooter className="px-4 pb-4 pt-0 flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Eye className="w-4 h-4" />
            <span>{program.view_count}</span>
          </div>
          <div className="flex items-center gap-1">
            <Download className="w-4 h-4" />
            <span>{program.download_count}</span>
          </div>
        </div>
        
        <div className="text-right">
          {program.hasMultiplePrices && (
            <span className="text-xs text-muted-foreground">From </span>
          )}
          <span className="font-semibold text-lg">
            ${program.lowestPrice ?? program.price}
          </span>
        </div>
      </CardFooter>
    </Card>
  );
};

export default ProgramCard;
