
import React from 'react';
import PurchaseCard from '@/components/PurchaseCard';

interface Program {
  id: string;
  title: string;
  price: number;
  pricing_model: string;
  subscription_plan_id: string | null;
  trial_period_days: number | null;
  seller_id: string;
  monthly_price: number | null;
  yearly_price: number | null;
  billing_interval: string | null;
}

interface ProgramPurchaseSectionProps {
  program: Program;
}

const ProgramPurchaseSection: React.FC<ProgramPurchaseSectionProps> = ({ program }) => {
  console.log('ProgramPurchaseSection - Program data:', {
    id: program.id,
    pricing_model: program.pricing_model,
    price: program.price
  });

  // Always use the regular purchase card for one-time purchases
  return (
    <PurchaseCard 
      price={program.price}
      programId={program.id}
      sellerId={program.seller_id}
    />
  );
};

export default ProgramPurchaseSection;
