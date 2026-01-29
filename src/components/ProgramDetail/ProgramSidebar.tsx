
import React from 'react';
import DeliveryInfo from '@/components/DeliveryInfo';
import ProgramPurchaseSection from '@/components/ProgramPurchaseSection';
import SellerInfo from '@/components/SellerInfo';

interface ProgramSidebarProps {
  program: any;
  onViewProfile: () => void;
}

const ProgramSidebar: React.FC<ProgramSidebarProps> = ({ program, onViewProfile }) => {
  return (
    <div className="space-y-6">
      <DeliveryInfo program={program} />
      <ProgramPurchaseSection program={program} />
      <SellerInfo program={program} onViewProfile={onViewProfile} />
    </div>
  );
};

export default ProgramSidebar;
