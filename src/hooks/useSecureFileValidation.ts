import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSecurityAudit } from './useSecurityAudit';

interface FileValidationResult {
  valid: boolean;
  error?: string;
  details?: Record<string, any>;
}

export const useSecureFileValidation = () => {
  const [validating, setValidating] = useState(false);
  const { logFileUploadAttempt } = useSecurityAudit();

  const validateFile = async (
    file: File,
    bucketName: 'pine-scripts' | 'program-media'
  ): Promise<FileValidationResult> => {
    setValidating(true);
    
    try {
      // Client-side validation first
      const clientValidation = performClientValidation(file, bucketName);
      if (!clientValidation.valid) {
        await logFileUploadAttempt(file.name, file.size, 'failed', clientValidation.error);
        return clientValidation;
      }

      // Server-side validation
      const { data, error } = await supabase.rpc('validate_file_upload', {
        p_file_name: file.name,
        p_file_size: file.size,
        p_mime_type: file.type,
        p_bucket_name: bucketName
      });

      if (error) {
        console.error('Server file validation error:', error);
        await logFileUploadAttempt(file.name, file.size, 'failed', error.message);
        return {
          valid: false,
          error: 'Server validation failed'
        };
      }

      // Properly cast and validate the result
      const result = data as unknown as FileValidationResult;
      
      // Validate the result structure
      if (!result || typeof result !== 'object' || typeof result.valid !== 'boolean') {
        console.error('Invalid file validation result structure:', result);
        await logFileUploadAttempt(file.name, file.size, 'failed', 'Invalid validation response');
        return {
          valid: false,
          error: 'Invalid validation response'
        };
      }
      
      if (!result.valid) {
        await logFileUploadAttempt(file.name, file.size, 'failed', result.error);
      }

      return result;
    } catch (error: any) {
      console.error('File validation error:', error);
      await logFileUploadAttempt(file.name, file.size, 'failed', error.message);
      return {
        valid: false,
        error: 'Validation failed unexpectedly'
      };
    } finally {
      setValidating(false);
    }
  };

  const performClientValidation = (
    file: File,
    bucketName: 'pine-scripts' | 'program-media'
  ): FileValidationResult => {
    // File size limits (10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return {
        valid: false,
        error: 'File size exceeds 10MB limit'
      };
    }

    // MIME type validation
    const allowedTypes: Record<string, string[]> = {
      'pine-scripts': ['text/plain', 'application/octet-stream'],
      'program-media': ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    };

    const allowed = allowedTypes[bucketName];
    if (!allowed.includes(file.type)) {
      return {
        valid: false,
        error: `Invalid file type. Allowed: ${allowed.join(', ')}`
      };
    }

    // File name validation (prevent directory traversal)
    if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
      return {
        valid: false,
        error: 'Invalid file name'
      };
    }

    // Suspicious file name patterns
    const suspiciousPatterns = [
      /\.exe$/i,
      /\.bat$/i,
      /\.cmd$/i,
      /\.scr$/i,
      /\.pif$/i,
      /\.com$/i,
      /\.vbs$/i,
      /\.js$/i,
      /\.jar$/i
    ];

    if (suspiciousPatterns.some(pattern => pattern.test(file.name))) {
      return {
        valid: false,
        error: 'Potentially dangerous file type detected'
      };
    }

    return { valid: true };
  };

  return {
    validateFile,
    validating
  };
};
