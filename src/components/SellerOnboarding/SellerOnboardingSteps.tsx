
import React from 'react';
import { CheckCircle } from 'lucide-react';

interface Step {
  id: number;
  title: string;
  description: string;
}

interface SellerOnboardingStepsProps {
  steps: Step[];
  currentStep: number;
}

const SellerOnboardingSteps: React.FC<SellerOnboardingStepsProps> = ({ 
  steps, 
  currentStep 
}) => {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div className={`
              w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
              ${currentStep > step.id 
                ? 'bg-green-500 text-white' 
                : currentStep === step.id 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-muted text-muted-foreground'
              }
            `}>
              {currentStep > step.id ? <CheckCircle className="w-4 h-4" /> : step.id}
            </div>
            {index < steps.length - 1 && (
              <div className={`
                w-16 h-0.5 mx-2
                ${currentStep > step.id ? 'bg-green-500' : 'bg-muted'}
              `} />
            )}
          </div>
        ))}
      </div>
      <div className="text-center">
        <h3 className="font-semibold">{steps[currentStep]?.title}</h3>
        <p className="text-sm text-muted-foreground">{steps[currentStep]?.description}</p>
      </div>
    </div>
  );
};

export default SellerOnboardingSteps;
