import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { FlaskConical } from 'lucide-react';

const TestModeBanner = () => {
  const { isTestAccount, user } = useAuth();
  if (!user || !isTestAccount) return null;
  return (
    <div className="w-full bg-amber-500/15 border-b border-amber-500/40 text-amber-900 dark:text-amber-200">
      <div className="max-w-7xl mx-auto px-4 py-1.5 flex items-center justify-center gap-2 text-xs font-medium">
        <FlaskConical className="w-3.5 h-3.5" />
        Test mode — you are signed into a test account. Purchases and payouts route through Stripe sandbox and are isolated from live data.
      </div>
    </div>
  );
};

export default TestModeBanner;