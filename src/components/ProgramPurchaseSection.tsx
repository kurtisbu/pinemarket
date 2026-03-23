
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ProgramPriceSelector } from '@/components/ProgramPriceSelector';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock } from 'lucide-react';

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

  const hasTrialOption = program.trial_period_days && program.trial_period_days > 0;

  useEffect(() => {
    const checkTrialEligibility = async () => {
      if (!user || !hasTrialOption) {
        setCheckingEligibility(false);
        return;
      }

      try {
        const { data, error } = await supabase.rpc('check_trial_eligibility', {
          p_user_id: user.id,
          p_program_id: program.id
        });

        if (!error) {
          setIsTrialEligible(data);
        }
      } catch {
        // ignore
      } finally {
        setCheckingEligibility(false);
      }
    };

    checkTrialEligibility();
  }, [user, program.id, hasTrialOption]);

  const showTrialBanner = hasTrialOption && user && isTrialEligible && !checkingEligibility;

  return (
    <div className="space-y-4">
      {showTrialBanner && (
        <Alert className="border-blue-200 bg-blue-50/30">
          <Clock className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            This program includes a <strong>{program.trial_period_days}-day free trial</strong>. You won't be charged until the trial ends. You can cancel anytime.
          </AlertDescription>
        </Alert>
      )}
      <ProgramPriceSelector
        programId={program.id}
        trialPeriodDays={showTrialBanner ? program.trial_period_days! : undefined}
      />
    </div>
  );
};

export default ProgramPurchaseSection;
