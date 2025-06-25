
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSecurityAudit } from './useSecurityAudit';

interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitized?: string;
}

export const useSecurityValidation = () => {
  const [validating, setValidating] = useState(false);
  const { logSecurityEvent } = useSecurityAudit();

  const validateTradingViewUrl = async (url: string): Promise<ValidationResult> => {
    if (!url || url.trim() === '') {
      return { valid: false, error: 'URL is required' };
    }

    try {
      const { data, error } = await supabase.rpc('validate_tradingview_url', {
        url: url.trim()
      });

      if (error) {
        console.error('URL validation error:', error);
        return { valid: false, error: 'URL validation failed' };
      }

      if (!data) {
        await logSecurityEvent({
          action: 'invalid_url_attempt',
          resource_type: 'validation',
          details: { url: url.substring(0, 100) }, // Only log first 100 chars
          risk_level: 'medium'
        });
        return { valid: false, error: 'Invalid TradingView URL format' };
      }

      return { valid: true };
    } catch (error: any) {
      console.error('URL validation error:', error);
      return { valid: false, error: 'URL validation failed' };
    }
  };

  const sanitizeContent = async (content: string, maxLength: number = 1000): Promise<ValidationResult> => {
    if (!content) {
      return { valid: true, sanitized: '' };
    }

    setValidating(true);
    try {
      const { data, error } = await supabase.rpc('sanitize_user_content', {
        content: content,
        max_length: maxLength
      });

      if (error) {
        console.error('Content sanitization error:', error);
        return { valid: false, error: 'Content validation failed' };
      }

      const sanitized = data as string;
      
      // Check if content was significantly modified (potential XSS attempt)
      const originalLength = content.length;
      const sanitizedLength = sanitized.length;
      const reductionRatio = (originalLength - sanitizedLength) / originalLength;

      if (reductionRatio > 0.3) { // More than 30% reduction suggests suspicious content
        await logSecurityEvent({
          action: 'suspicious_content_detected',
          resource_type: 'validation',
          details: {
            original_length: originalLength,
            sanitized_length: sanitizedLength,
            reduction_ratio: reductionRatio
          },
          risk_level: 'high'
        });
      }

      return { valid: true, sanitized };
    } catch (error: any) {
      console.error('Content sanitization error:', error);
      return { valid: false, error: 'Content validation failed' };
    } finally {
      setValidating(false);
    }
  };

  const validateProgramData = async (data: {
    title: string;
    description: string;
    tradingview_publication_url?: string;
  }): Promise<ValidationResult> => {
    // Validate title
    const titleResult = await sanitizeContent(data.title, 200);
    if (!titleResult.valid) {
      return { valid: false, error: `Title validation failed: ${titleResult.error}` };
    }

    // Validate description
    const descriptionResult = await sanitizeContent(data.description, 5000);
    if (!descriptionResult.valid) {
      return { valid: false, error: `Description validation failed: ${descriptionResult.error}` };
    }

    // Validate TradingView URL if provided
    if (data.tradingview_publication_url) {
      const urlResult = await validateTradingViewUrl(data.tradingview_publication_url);
      if (!urlResult.valid) {
        return { valid: false, error: `URL validation failed: ${urlResult.error}` };
      }
    }

    return { valid: true };
  };

  return {
    validating,
    validateTradingViewUrl,
    sanitizeContent,
    validateProgramData
  };
};
