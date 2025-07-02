
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Star, Download, Eye, Calendar, CreditCard } from 'lucide-react';

interface ProgramHeaderProps {
  program: {
    category: string;
    title: string;
    price: number;
    average_rating: number;
    rating_count: number;
    download_count: number;
    view_count: number;
    created_at: string;
  };
}

const ProgramHeader: React.FC<ProgramHeaderProps> = ({ program }) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Badge className="bg-blue-500 hover:bg-blue-600">
          {program.category}
        </Badge>
        <Badge variant="secondary">
          <CreditCard className="w-3 h-3 mr-1" />
          One-time Purchase
        </Badge>
        <div className="flex items-center space-x-1 text-sm text-muted-foreground">
          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
          <span>{program.average_rating.toFixed(1)}</span>
          <span>({program.rating_count} reviews)</span>
        </div>
      </div>
      
      <h1 className="text-3xl font-bold mb-2">{program.title}</h1>
      
      <div className="mb-4">
        <div className="text-2xl font-bold text-green-600">
          ${program.price}
        </div>
        <div className="text-sm text-muted-foreground">
          One-time payment for lifetime access
        </div>
      </div>
      
      <div className="flex items-center gap-6 text-sm text-muted-foreground mb-6">
        <div className="flex items-center space-x-1">
          <Download className="w-4 h-4" />
          <span>{program.download_count} downloads</span>
        </div>
        <div className="flex items-center space-x-1">
          <Eye className="w-4 h-4" />
          <span>{program.view_count} views</span>
        </div>
        <div className="flex items-center space-x-1">
          <Calendar className="w-4 h-4" />
          <span>Published {formatDate(program.created_at)}</span>
        </div>
      </div>
    </div>
  );
};

export default ProgramHeader;
