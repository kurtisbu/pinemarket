
export interface Program {
  id: string;
  title: string;
  price: number;
  pricing_model: string;
  subscription_plan_id: string | null;
  trial_period_days: number | null;
  monthly_price: number | null;
  yearly_price: number | null;
  billing_interval: string | null;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  interval: string;
  features: string[];
}

export interface PricingOption {
  value: 'month' | 'year';
  label: string;
  price: number;
}

export const createVirtualPlan = (program: Program): SubscriptionPlan => {
  let defaultPrice = 0;
  let defaultInterval = 'month';
  
  if (program.billing_interval === 'month' && program.monthly_price) {
    defaultPrice = program.monthly_price;
    defaultInterval = 'month';
  } else if (program.billing_interval === 'year' && program.yearly_price) {
    defaultPrice = program.yearly_price;
    defaultInterval = 'year';
  } else if (program.billing_interval === 'both') {
    if (program.monthly_price) {
      defaultPrice = program.monthly_price;
      defaultInterval = 'month';
    } else if (program.yearly_price) {
      defaultPrice = program.yearly_price;
      defaultInterval = 'year';
    }
  }

  return {
    id: `virtual-${program.id}`,
    name: `${program.title} Access`,
    description: 'Subscribe to access this Pine Script',
    price: defaultPrice,
    interval: defaultInterval,
    features: [
      'Full access to this Pine Script',
      'Automatic updates and improvements',
      'Direct assignment to your TradingView account',
      'Priority support from the script author'
    ]
  };
};

export const getIntervalOptions = (program: Program): PricingOption[] => {
  const options = [];
  if (program.monthly_price && (program.billing_interval === 'month' || program.billing_interval === 'both')) {
    options.push({ value: 'month' as const, label: 'Monthly', price: program.monthly_price });
  }
  if (program.yearly_price && (program.billing_interval === 'year' || program.billing_interval === 'both')) {
    options.push({ value: 'year' as const, label: 'Yearly', price: program.yearly_price });
  }
  return options;
};

export const getCurrentPrice = (program: Program, selectedInterval: 'month' | 'year', subscriptionPlan: SubscriptionPlan | null): number => {
  if (selectedInterval === 'month' && program.monthly_price) {
    return program.monthly_price;
  } else if (selectedInterval === 'year' && program.yearly_price) {
    return program.yearly_price;
  }
  
  // Fallback to subscription plan price, but only if it's not 0
  if (subscriptionPlan?.price && subscriptionPlan.price > 0) {
    return subscriptionPlan.price;
  }
  
  // Final fallback - return the appropriate price based on interval
  return selectedInterval === 'month' 
    ? (program.monthly_price || 0)
    : (program.yearly_price || 0);
};

export const getIntervalDisplay = (selectedInterval: 'month' | 'year'): string => {
  return selectedInterval === 'month' ? 'month' : 'year';
};
