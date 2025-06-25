
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface PaymentSecurityMetrics {
  recentPurchaseCount: number;
  totalSpent24h: number;
  averageTransactionAmount: number;
  suspiciousActivityScore: number;
  isHighRiskUser: boolean;
}

interface SecurityValidationResult {
  isValid: boolean;
  riskScore: number;
  blockedReasons: string[];
  warnings: string[];
}

export const usePaymentSecurity = () => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<PaymentSecurityMetrics | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchUserMetrics = async (userId: string): Promise<PaymentSecurityMetrics> => {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get recent purchases
    const { data: recentPurchases, error } = await supabase
      .from('purchases')
      .select('amount, created_at')
      .eq('buyer_id', userId)
      .gte('created_at', oneDayAgo.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user metrics:', error);
      throw error;
    }

    const recentPurchaseCount = recentPurchases?.length || 0;
    const totalSpent24h = recentPurchases?.reduce((sum, purchase) => sum + Number(purchase.amount), 0) || 0;
    const averageTransactionAmount = recentPurchaseCount > 0 ? totalSpent24h / recentPurchaseCount : 0;

    // Calculate suspicious activity score
    let suspiciousActivityScore = 0;
    
    // High frequency purchases
    if (recentPurchaseCount > 5) suspiciousActivityScore += 30;
    else if (recentPurchaseCount > 3) suspiciousActivityScore += 15;
    
    // High spending amount
    if (totalSpent24h > 1000) suspiciousActivityScore += 25;
    else if (totalSpent24h > 500) suspiciousActivityScore += 10;
    
    // Rapid successive purchases (within 5 minutes)
    if (recentPurchases && recentPurchases.length > 1) {
      const rapidPurchases = recentPurchases.filter((purchase, index) => {
        if (index === 0) return false;
        const currentTime = new Date(purchase.created_at);
        const previousTime = new Date(recentPurchases[index - 1].created_at);
        return (currentTime.getTime() - previousTime.getTime()) < 5 * 60 * 1000; // 5 minutes
      });
      suspiciousActivityScore += rapidPurchases.length * 20;
    }

    const isHighRiskUser = suspiciousActivityScore > 50;

    return {
      recentPurchaseCount,
      totalSpent24h,
      averageTransactionAmount,
      suspiciousActivityScore,
      isHighRiskUser
    };
  };

  const validatePayment = async (
    amount: number,
    sellerId: string,
    programId: string
  ): Promise<SecurityValidationResult> => {
    if (!user) {
      return {
        isValid: false,
        riskScore: 100,
        blockedReasons: ['User not authenticated'],
        warnings: []
      };
    }

    const blockedReasons: string[] = [];
    const warnings: string[] = [];
    let riskScore = 0;

    // Self-purchase check
    if (user.id === sellerId) {
      blockedReasons.push('Cannot purchase your own script');
      riskScore += 100;
    }

    // Amount validation
    if (amount < 0.50) {
      blockedReasons.push('Amount below minimum threshold');
      riskScore += 50;
    } else if (amount > 10000) {
      warnings.push('High-value transaction');
      riskScore += 20;
    }

    // Get user metrics
    try {
      const userMetrics = await fetchUserMetrics(user.id);
      
      // Rate limiting
      if (userMetrics.recentPurchaseCount > 10) {
        blockedReasons.push('Too many recent purchases');
        riskScore += 60;
      } else if (userMetrics.recentPurchaseCount > 5) {
        warnings.push('Multiple recent purchases detected');
        riskScore += 25;
      }

      // Spending patterns
      if (userMetrics.totalSpent24h > 2000) {
        warnings.push('High spending in last 24 hours');
        riskScore += 30;
      }

      // Suspicious activity
      if (userMetrics.isHighRiskUser) {
        warnings.push('Suspicious activity pattern detected');
        riskScore += userMetrics.suspiciousActivityScore;
      }

      // Check for duplicate purchase
      const { data: existingPurchase } = await supabase
        .from('purchases')
        .select('id')
        .eq('buyer_id', user.id)
        .eq('program_id', programId)
        .eq('status', 'completed')
        .single();

      if (existingPurchase) {
        blockedReasons.push('Script already purchased');
        riskScore += 100;
      }

    } catch (error) {
      console.error('Error validating payment:', error);
      warnings.push('Unable to validate payment history');
      riskScore += 10;
    }

    return {
      isValid: blockedReasons.length === 0 && riskScore < 80,
      riskScore,
      blockedReasons,
      warnings
    };
  };

  const loadMetrics = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const userMetrics = await fetchUserMetrics(user.id);
      setMetrics(userMetrics);
    } catch (error) {
      console.error('Failed to load payment metrics:', error);
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, [user]);

  return {
    metrics,
    loading,
    validatePayment,
    refreshMetrics: loadMetrics
  };
};
