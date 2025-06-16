
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShoppingCart } from 'lucide-react';

interface PurchaseCardProps {
  price: number;
}

const PurchaseCard: React.FC<PurchaseCardProps> = ({ price }) => {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="text-center mb-6">
          <div className="text-3xl font-bold text-green-600 mb-2">
            ${price}
          </div>
          <p className="text-sm text-muted-foreground">One-time purchase</p>
        </div>
        
        <Button className="w-full mb-4 bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600">
          <ShoppingCart className="w-4 h-4 mr-2" />
          Buy Now
        </Button>
        
        <Button variant="outline" className="w-full">
          Add to Cart
        </Button>
      </CardContent>
    </Card>
  );
};

export default PurchaseCard;
