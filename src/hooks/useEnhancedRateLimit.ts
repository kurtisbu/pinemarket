
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSecurityAudit } from './useSecurityAudit';

interface RateLimitResult {
  allowed: boolean;
  current_count: number;
  limit: number;
  reset_time: string;
  remaining: number;
}

export const useEnhancedRateLimit = () => {
  const { user } = useAuth();
  const { logSuspiciousActivity } = useSecurityAudit();
  const [loading, setLoading] = useState(false);

  const checkRateLimit = async (
    endpoint: string,
    customLimit?: number,
    windowMinutes: number = 60
  ): Promise<RateLimitResult | null> => {
    setLoading(true);
    try {
      // Get client IP (in a real app, this would be handled server-side)
      const ipResponse = await fetch('https://api.ipify.org?format=json');
      const { ip } = await ipResponse.json();

      // Call the enhanced secure rate limit function
      const { data, error } = await supabase.rpc('check_rate_limit_secure', {
        p_user_id: user?.id || null,
        p_ip_address: ip,
        p_endpoint: endpoint,
        p_limit: customLimit || 100,
        p_window_minutes: windowMinutes
      });

      if (error) {
        console.error('Rate limit check error:', error);
        return null;
      }

      const result = data as RateLimitResult;

      // Log suspicious activity if rate limit is exceeded
      if (!result.allowed) {
        await logSuspiciousActivity('rate_limit_exceeded', {
          endpoint,
          current_count: result.current_count,
          limit: result.limit,
          ip_address: ip,
          user_id: user?.id
        });
      }

      return result;
    } catch (error) {
      console.error('Enhanced rate limit check failed:', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const isRateLimited = async (endpoint: string): Promise<boolean> => {
    const result = await checkRateLimit(endpoint);
    return result ? !result.allowed : false;
  };

  const getRemainingRequests = async (endpoint: string): Promise<number> => {
    const result = await checkRateLimit(endpoint);
    return result ? result.remaining : 0;
  };

  const getResetTime = async (endpoint: string): Promise<Date | null> => {
    const result = await checkRateLimit(endpoint);
    return result ? new Date(result.reset_time) : null;
  };

  return {
    checkRateLimit,
    isRateLimited,
    getRemainingRequests,
    getResetTime,
    loading
  };
};
