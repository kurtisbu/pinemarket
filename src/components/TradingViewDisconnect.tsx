import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Unplug } from 'lucide-react';

interface TradingViewDisconnectProps {
  userId: string;
  tradingviewUsername: string;
  onDisconnected: () => void;
}

const TradingViewDisconnect: React.FC<TradingViewDisconnectProps> = ({
  userId,
  tradingviewUsername,
  onDisconnected,
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('tradingview-service', {
        body: {
          action: 'disconnect-tradingview',
          user_id: userId,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast({
        title: 'Disconnected Successfully',
        description: 'Your TradingView account has been disconnected.',
      });

      onDisconnected();
    } catch (error: any) {
      toast({
        title: 'Disconnect Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" disabled={loading}>
          <Unplug className="w-4 h-4 mr-2" />
          Disconnect TradingView
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Disconnect TradingView Account?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Are you sure you want to disconnect <strong>{tradingviewUsername}</strong> from your account?
            </p>
            <p className="text-destructive font-semibold">
              This will:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Remove all synced scripts from your profile</li>
              <li>Disable automatic script assignments for buyers</li>
              <li>Set your published programs to draft status</li>
            </ul>
            <p className="text-sm text-muted-foreground mt-2">
              You can reconnect later, but you'll need to sync your scripts again.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDisconnect}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Disconnecting...
              </>
            ) : (
              'Disconnect'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default TradingViewDisconnect;
