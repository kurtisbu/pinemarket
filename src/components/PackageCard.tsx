import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, Star, Eye } from 'lucide-react';

interface PackageCardProps {
  id: string;
  title: string;
  description: string;
  programCount: number;
  lowestPrice: number;
  averageRating: number;
  ratingCount: number;
  viewCount: number;
  sellerName: string;
}

const PackageCard: React.FC<PackageCardProps> = ({
  id,
  title,
  description,
  programCount,
  lowestPrice,
  averageRating,
  ratingCount,
  viewCount,
  sellerName,
}) => {
  const navigate = useNavigate();

  return (
    <Card 
      className="cursor-pointer hover:shadow-lg transition-all duration-300 group"
      onClick={() => navigate(`/package/${id}`)}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-5 w-5 text-primary" />
              <Badge variant="secondary">{programCount} Programs</Badge>
            </div>
            <h3 className="text-xl font-bold line-clamp-2 group-hover:text-primary transition-colors">
              {title}
            </h3>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <p className="text-muted-foreground line-clamp-3 mb-4">
          {description}
        </p>

        <div className="flex items-center gap-4 text-sm">
          {averageRating > 0 && (
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span className="font-medium">{averageRating.toFixed(1)}</span>
              <span className="text-muted-foreground">({ratingCount})</span>
            </div>
          )}
          
          <div className="flex items-center gap-1 text-muted-foreground">
            <Eye className="h-4 w-4" />
            <span>{viewCount}</span>
          </div>
        </div>

        <div className="mt-4">
          <p className="text-sm text-muted-foreground">by {sellerName}</p>
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Starting at</p>
          <p className="text-2xl font-bold">${lowestPrice.toFixed(2)}</p>
        </div>
        <Button onClick={(e) => {
          e.stopPropagation();
          navigate(`/package/${id}`);
        }}>
          View Package
        </Button>
      </CardFooter>
    </Card>
  );
};

export default PackageCard;
