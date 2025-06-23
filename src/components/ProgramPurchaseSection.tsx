
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
}

interface ProgramPurchaseSectionProps {
  program: Program;
}

const ProgramPurchaseSection: React.FC<ProgramPurchaseSectionProps> = ({ program }) => {
  if (program.pricing_model === 'subscription') {
    return <SubscriptionPurchaseCard program={program} />;
  }

  return (
    <PurchaseCard 
      price={program.price}
      programId={program.id}
      sellerId={program.seller_id}
    />
  );
};

export default ProgramPurchaseSection;
