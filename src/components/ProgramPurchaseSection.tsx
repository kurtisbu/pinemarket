
import React from 'react';
import PurchaseCard from '@/components/PurchaseCard';
import SubscriptionPurchaseCard from '@/components/SubscriptionPurchaseCard';

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
    price: program.price,
    monthly_price: program.monthly_price,
    yearly_price: program.yearly_price,
    billing_interval: program.billing_interval
  });

  if (program.pricing_model === 'subscription') {
    return <SubscriptionPurchaseCard program={program} />;
  }

  // For one-time purchases, use the regular purchase card
  return (
    <PurchaseCard 
      price={program.price}
      programId={program.id}
      sellerId={program.seller_id}
    />
  );
};

export default ProgramPurchaseSection;
