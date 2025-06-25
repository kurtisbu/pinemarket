
import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Download, Lock, Loader2 } from 'lucide-react';

interface SecureScriptDownloadProps {
  programId: string;
  programTitle: string;
  hasPurchased: boolean;
  isOwner: boolean;
}

const SecureScriptDownload: React.FC<SecureScriptDownloadProps> = ({
  programId,
  programTitle,
  hasPurchased,
  isOwner
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please log in to download scripts',
        variant: 'destructive',
      });
      return;
    }

    if (!hasPurchased && !isOwner) {
      toast({
        title: 'Purchase required',
        description: 'You must purchase this program to download the script',
        variant: 'destructive',
      });
      return;
    }

    setDownloading(true);
    try {
      console.log('Requesting secure download for program:', programId);
      
      // Call the secure download function
      const { data, error } = await supabase.rpc('get_script_download_url', {
        program_id_param: programId
      });

      if (error) {
        console.error('Download access denied:', error);
        throw new Error(error.message || 'Access denied');
      }

      if (!data) {
        throw new Error('No script file found for this program');
      }

      console.log('Download authorized, script path:', data);

      // Get signed URL for download
      const { data: signedUrl, error: urlError } = await supabase.storage
        .from('pine-scripts')
        .createSignedUrl(data, 3600); // 1 hour expiry

      if (urlError) {
        console.error('Failed to create download URL:', urlError);
        throw urlError;
      }

      console.log('Creating download link...');
      
      // Trigger download
      const link = document.createElement('a');
      link.href = signedUrl.signedUrl;
      link.download = `${programTitle}.pine`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: 'Download started',
        description: 'Your Pine Script is downloading...',
      });
    } catch (error: any) {
      console.error('Download failed:', error);
      toast({
        title: 'Download failed',
        description: error.message || 'Failed to download script',
        variant: 'destructive',
      });
    } finally {
      setDownloading(false);
    }
  };

  const canDownload = hasPurchased || isOwner;

  return (
    <Button
      onClick={handleDownload}
      disabled={!canDownload || downloading}
      variant={canDownload ? 'default' : 'outline'}
      className="w-full"
    >
      {downloading ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : canDownload ? (
        <Download className="w-4 h-4 mr-2" />
      ) : (
        <Lock className="w-4 h-4 mr-2" />
      )}
      {downloading ? 'Downloading...' : canDownload ? 'Download Script' : 'Purchase Required'}
    </Button>
  );
};

export default SecureScriptDownload;
