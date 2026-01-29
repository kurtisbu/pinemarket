
import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileText, Loader2, Shield, AlertTriangle } from 'lucide-react';
import { useSecureFileValidation } from '@/hooks/useSecureFileValidation';
import { useSecurityAudit } from '@/hooks/useSecurityAudit';

interface SecureFileUploadProps {
  bucketName: 'pine-scripts' | 'program-media';
  allowedTypes: string[];
  maxSizeMB: number;
  onUploadComplete: (filePath: string, fileUrl: string) => void;
  accept?: string;
  label: string;
}

const SecureFileUpload: React.FC<SecureFileUploadProps> = ({
  bucketName,
  allowedTypes,
  maxSizeMB,
  onUploadComplete,
  accept,
  label
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { validateFile, validating } = useSecureFileValidation();
  const { logFileUploadAttempt } = useSecurityAudit();
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    error?: string;
  } | null>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      setValidationResult(null);
      return;
    }

    setSelectedFile(file);
    
    // Perform security validation
    const result = await validateFile(file, bucketName);
    setValidationResult(result);

    if (!result.valid) {
      toast({
        title: 'File validation failed',
        description: result.error || 'Invalid file selected',
        variant: 'destructive',
      });
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !user || !validationResult?.valid) return;

    setUploading(true);
    try {
      // Create secure file path: userId/timestamp-filename
      const timestamp = Date.now();
      const fileName = selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `${user.id}/${timestamp}-${fileName}`;

      console.log(`Uploading to ${bucketName}:`, filePath);

      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Upload error:', error);
        await logFileUploadAttempt(selectedFile.name, selectedFile.size, 'failed', error.message);
        throw error;
      }

      console.log('Upload successful:', data);
      await logFileUploadAttempt(selectedFile.name, selectedFile.size, 'success');

      // Get public URL for program media, private path for pine scripts
      let fileUrl = '';
      if (bucketName === 'program-media') {
        const { data: urlData } = supabase.storage
          .from(bucketName)
          .getPublicUrl(filePath);
        fileUrl = urlData.publicUrl;
      } else {
        // For pine scripts, we'll use the secure path
        fileUrl = filePath;
      }

      onUploadComplete(filePath, fileUrl);
      setSelectedFile(null);
      setValidationResult(null);
      
      toast({
        title: 'Upload successful',
        description: `${label} uploaded securely`,
      });
    } catch (error: any) {
      console.error('Upload failed:', error);
      toast({
        title: 'Upload failed',
        description: error.message || 'Failed to upload file',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="file-upload" className="flex items-center gap-2">
          <Shield className="w-4 h-4" />
          {label} (Secure Upload)
        </Label>
        <Input
          id="file-upload"
          type="file"
          accept={accept}
          onChange={handleFileSelect}
          disabled={uploading || validating}
          className="mt-1"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Files are validated for security before upload. Max size: {maxSizeMB}MB
        </p>
      </div>
      
      {selectedFile && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-3 bg-muted rounded">
            <FileText className="w-4 h-4" />
            <span className="text-sm truncate">{selectedFile.name}</span>
            <span className="text-xs text-muted-foreground">
              ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
            </span>
          </div>
          
          {validating && (
            <Alert>
              <Loader2 className="w-4 h-4 animate-spin" />
              <AlertDescription>
                Validating file for security threats...
              </AlertDescription>
            </Alert>
          )}
          
          {validationResult && !validating && (
            <Alert variant={validationResult.valid ? 'default' : 'destructive'}>
              {validationResult.valid ? (
                <Shield className="w-4 h-4" />
              ) : (
                <AlertTriangle className="w-4 h-4" />
              )}
              <AlertDescription>
                {validationResult.valid 
                  ? 'File passed security validation and is safe to upload'
                  : `Security validation failed: ${validationResult.error}`
                }
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
      
      <Button 
        onClick={handleUpload} 
        disabled={!selectedFile || uploading || validating || !validationResult?.valid}
        className="w-full"
      >
        {uploading ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : validating ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <>
            <Shield className="w-4 h-4 mr-2" />
            <Upload className="w-4 h-4 mr-2" />
          </>
        )}
        {uploading ? 'Uploading Securely...' : validating ? 'Validating...' : `Secure Upload ${label}`}
      </Button>
    </div>
  );
};

export default SecureFileUpload;
