
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface RateLimitResult {
  allowed: boolean;
  current_count: number;
  limit: number;
  reset_time: string;
  remaining: number;
}

interface RateLimitConfig {
  endpoint: string;
  requests_per_hour: number;
  requests_per_minute: number;
  burst_limit: number;
  enabled: boolean;
}

export const useRateLimit = () => {
  const { user } = useAuth();
  const [configs, setConfigs] = useState<RateLimitConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Check if user is admin to access rate limit configs
  const checkAdminAccess = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!error && data?.role === 'admin') {
        setIsAdmin(true);
      }
    } catch (error) {
      console.error('Error checking admin access:', error);
    }
  };

  const fetchRateLimitConfigs = async () => {
    if (!isAdmin) {
      // Use default configs if not admin
      setConfigs([
        { endpoint: 'general', requests_per_hour: 1000, requests_per_minute: 100, burst_limit: 200, enabled: true },
        { endpoint: 'payment', requests_per_hour: 5, requests_per_minute: 1, burst_limit: 3, enabled: true },
        { endpoint: 'script-download', requests_per_hour: 30, requests_per_minute: 2, burst_limit: 5, enabled: true }
      ]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('rate_limit_configs')
        .select('*')
        .eq('enabled', true);

      if (error) throw error;
      setConfigs(data || []);
    } catch (error) {
      console.error('Failed to fetch rate limit configs:', error);
      // Fallback to default configs
      setConfigs([
        { endpoint: 'general', requests_per_hour: 1000, requests_per_minute: 100, burst_limit: 200, enabled: true },
        { endpoint: 'payment', requests_per_hour: 5, requests_per_minute: 1, burst_limit: 3, enabled: true },
        { endpoint: 'script-download', requests_per_hour: 30, requests_per_minute: 2, burst_limit: 5, enabled: true }
      ]);
    }
  };

  const checkRateLimit = async (
    endpoint: string,
    customLimit?: number,
    windowMinutes: number = 60
  ): Promise<RateLimitResult | null> => {
    setLoading(true);
    try {
      // Get configuration for this endpoint
      const config = configs.find(c => c.endpoint === endpoint);
      const limit = customLimit || config?.requests_per_hour || 100;

      // Get client IP (in a real app, this would be handled server-side)
      const ipResponse = await fetch('https://api.ipify.org?format=json');
      const { ip } = await ipResponse.json();

      // Call the enhanced secure rate limit function
      const { data, error } = await supabase.rpc('check_rate_limit_secure', {
        p_user_id: user?.id || null,
        p_ip_address: ip,
        p_endpoint: endpoint,
        p_limit: limit,
        p_window_minutes: windowMinutes
      });

      if (error) {
        console.error('Rate limit check error:', error);
        return null;
      }

      return data as unknown as RateLimitResult;
    } catch (error) {
      console.error('Rate limit check failed:', error);
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

  useEffect(() => {
    checkAdminAccess();
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchRateLimitConfigs();
    }
  }, [isAdmin]);

  return {
    configs,
    loading,
    isAdmin,
    checkRateLimit,
    isRateLimited,
    getRemainingRequests,
    getResetTime,
    refreshConfigs: fetchRateLimitConfigs
  };
};
