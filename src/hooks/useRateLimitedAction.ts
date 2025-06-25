
import { useState } from 'react';
import { useRateLimit } from './useRateLimit';
import { useToast } from '@/components/ui/use-toast';

interface UseRateLimitedActionOptions {
  endpoint: string;
  onSuccess?: () => void;
  onRateLimited?: () => void;
  customLimit?: number;
}

export const useRateLimitedAction = (options: UseRateLimitedActionOptions) => {
  const { endpoint, onSuccess, onRateLimited, customLimit } = options;
  const { checkRateLimit } = useRateLimit();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const executeAction = async (action: () => Promise<void> | void) => {
    setLoading(true);
    
    try {
      // Check rate limit first
      const rateLimitResult = await checkRateLimit(endpoint, customLimit);
      
      if (!rateLimitResult) {
        toast({
          title: 'Rate limit check failed',
          description: 'Unable to verify rate limit. Please try again.',
          variant: 'destructive',
        });
        return false;
      }

      if (!rateLimitResult.allowed) {
        const resetTime = new Date(rateLimitResult.reset_time);
        const timeUntilReset = Math.ceil((resetTime.getTime() - Date.now()) / 1000 / 60);
        
        toast({
          title: 'Rate limit exceeded',
          description: `You have reached the rate limit for ${endpoint}. Please wait ${timeUntilReset} minutes before trying again.`,
          variant: 'destructive',
        });
        
        if (onRateLimited) {
          onRateLimited();
        }
        
        return false;
      }

      // Rate limit passed, execute the action
      await action();
      
      if (onSuccess) {
        onSuccess();
      }
      
      // Show remaining requests if getting low
      if (rateLimitResult.remaining <= 5) {
        toast({
          title: 'Rate limit warning',
          description: `You have ${rateLimitResult.remaining} requests remaining for ${endpoint}.`,
          variant: 'default',
        });
      }
      
      return true;
    } catch (error) {
      console.error('Rate-limited action failed:', error);
      toast({
        title: 'Action failed',
        description: 'An error occurred while executing the action.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    executeAction,
    loading
  };
};
