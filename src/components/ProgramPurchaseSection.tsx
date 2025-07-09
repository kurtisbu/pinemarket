
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import PurchaseCard from '@/components/PurchaseCard';
import TrialPurchaseCard from '@/components/TrialPurchaseCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  const { user } = useAuth();
  const [isTrialEligible, setIsTrialEligible] = useState(false);
  const [checkingEligibility, setCheckingEligibility] = useState(true);

  useEffect(() => {
    const checkTrialEligibility = async () => {
      if (!user || !program.trial_period_days || program.trial_period_days <= 0) {
        setCheckingEligibility(false);
        return;
      }

      try {
        const { data, error } = await supabase.rpc('check_trial_eligibility', {
          p_user_id: user.id,
          p_program_id: program.id
        });

        if (error) {
          console.error('Error checking trial eligibility:', error);
          setIsTrialEligible(false);
        } else {
          setIsTrialEligible(data);
        }
      } catch (error) {
        console.error('Error checking trial eligibility:', error);
        setIsTrialEligible(false);
      } finally {
        setCheckingEligibility(false);
      }
    };

    checkTrialEligibility();
  }, [user, program.id, program.trial_period_days]);

  console.log('ProgramPurchaseSection - Program data:', {
    id: program.id,
    pricing_model: program.pricing_model,
    price: program.price,
    trial_period_days: program.trial_period_days,
    isTrialEligible,
    checkingEligibility
  });

  const hasTrialOption = program.trial_period_days && program.trial_period_days > 0;
  const showTrialTab = hasTrialOption && user && isTrialEligible && !checkingEligibility;

  // If no trial or user not eligible, show regular purchase card
  if (!showTrialTab) {
    return (
      <PurchaseCard 
        price={program.price}
        programId={program.id}
        sellerId={program.seller_id}
      />
    );
  }

  // Show both trial and purchase options in tabs
  return (
    <Tabs defaultValue="trial" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="trial">Free Trial</TabsTrigger>
        <TabsTrigger value="purchase">Buy Now</TabsTrigger>
      </TabsList>
      
      <TabsContent value="trial" className="mt-4">
        <TrialPurchaseCard
          programId={program.id}
          sellerId={program.seller_id}
          trialPeriodDays={program.trial_period_days || 7}
          isTrialEligible={isTrialEligible}
        />
      </TabsContent>
      
      <TabsContent value="purchase" className="mt-4">
        <PurchaseCard 
          price={program.price}
          programId={program.id}
          sellerId={program.seller_id}
        />
      </TabsContent>
    </Tabs>
  );
};

export default ProgramPurchaseSection;
