import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield } from 'lucide-react';
import SecurePaymentCard from './SecurePaymentCard';

interface PurchaseCardProps {
  price: number;
  programId: string;
  sellerId: string;
}

const PurchaseCard: React.FC<PurchaseCardProps> = (props) => {
  return (
    <div className="space-y-4">
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          This purchase is now processed through our enhanced security system for your protection.
        </AlertDescription>
      </Alert>
      <SecurePaymentCard {...props} />
    </div>
  );
};

export default PurchaseCard;
