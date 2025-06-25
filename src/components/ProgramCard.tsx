
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, Download, Eye } from 'lucide-react';

interface ProgramCardProps {
  id: string;
  title: string;
  description: string;
  price: number;
  rating: number;
  downloads: number;
  views: number;
  category: string;
  author: string;
  image: string;
  tags: string[];
  pricing_model?: string;
  monthly_price?: number | null;
  yearly_price?: number | null;
  billing_interval?: string | null;
}

const ProgramCard: React.FC<ProgramCardProps> = ({
  id,
  title,
  description,
  price,
  rating,
  downloads,
  views,
  category,
  author,
  image,
  tags
}) => {
  const navigate = useNavigate();

  const handleViewDetails = () => {
    navigate(`/program/${id}`);
  };

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-border">
      <CardHeader className="p-0">
        <div className="relative">
          <img 
            src={image} 
            alt={title}
            className="w-full h-48 object-cover rounded-t-lg cursor-pointer"
            onClick={handleViewDetails}
          />
          <Badge className="absolute top-3 left-3 bg-blue-500 hover:bg-blue-600">
            {category}
          </Badge>
          <div className="absolute top-3 right-3 bg-black/50 text-white px-2 py-1 rounded text-sm">
            ${price}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-4">
        <h3 
          className="font-semibold text-lg mb-2 group-hover:text-blue-500 transition-colors cursor-pointer"
          onClick={handleViewDetails}
        >
          {title}
        </h3>
        <p className="text-muted-foreground text-sm mb-3 line-clamp-2">
          {description}
        </p>
        
        <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
          <span>by {author}</span>
          <div className="flex items-center space-x-1">
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            <span>{rating.toFixed(1)}</span>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-1 mb-3">
          {tags.slice(0, 3).map((tag, index) => (
            <Badge key={index} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
        
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center space-x-1">
            <Download className="w-3 h-3" />
            <span>{downloads}</span>
          </div>
          <div className="flex items-center space-x-1">
            <Eye className="w-3 h-3" />
            <span>{views}</span>
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="p-4 pt-0">
        <Button 
          className="w-full bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600"
          onClick={handleViewDetails}
        >
          View Details
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ProgramCard;
