
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Check, Clock, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface DeliveryInfoProps {
  program: any;
}

const DeliveryInfo: React.FC<DeliveryInfoProps> = ({ program }) => {
  const [hasLinkedScripts, setHasLinkedScripts] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkLinkedScripts = async () => {
      if (!program?.id) {
        setLoading(false);
        return;
      }

      try {
        const { count, error } = await supabase
          .from('program_scripts')
          .select('id', { count: 'exact', head: true })
          .eq('program_id', program.id);

        if (!error) {
          setHasLinkedScripts((count ?? 0) > 0);
        }
      } catch (error) {
        console.error('Failed to check linked scripts:', error);
      } finally {
        setLoading(false);
      }
    };

    checkLinkedScripts();
  }, [program?.id]);

  const getDeliveryInfo = () => {
    const hasScript = program?.tradingview_script_id || hasLinkedScripts;
    const sellerConnected = program?.profiles?.is_tradingview_connected;

    if (hasScript && sellerConnected) {
      return {
        type: 'success',
        icon: <Check className="w-4 h-4" />,
        title: 'Instant Access',
        description: 'This script will be automatically assigned to your TradingView account immediately after purchase.',
        details: [
          'Automatic assignment within seconds',
          'No manual steps required',
          'Direct access through TradingView'
        ]
      };
    } else if (hasScript && !sellerConnected) {
      return {
        type: 'warning',
        icon: <Clock className="w-4 h-4" />,
        title: 'Manual Assignment',
        description: 'The seller will manually assign this script to your TradingView account.',
        details: [
          'Assignment typically within 24 hours',
          'You will receive email notification',
          'Seller will contact you for TradingView username'
        ]
      };
    } else if (program?.script_file_path) {
      return {
        type: 'info',
        icon: <AlertTriangle className="w-4 h-4" />,
        title: 'File Download',
        description: 'This program will be delivered as a downloadable Pine Script file.',
        details: [
          'Instant download after purchase',
          'Pine Script source code included',
          'Manual import to TradingView required'
        ]
      };
    }
    
    return null;
  };

  if (loading) {
    return null;
  }

  const deliveryInfo = getDeliveryInfo();

  if (!deliveryInfo) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          {deliveryInfo.icon}
          {deliveryInfo.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          {deliveryInfo.description}
        </p>
        <ul className="space-y-2">
          {deliveryInfo.details.map((detail, index) => (
            <li key={index} className="flex items-center gap-2 text-sm">
              <div className="w-1.5 h-1.5 bg-current rounded-full opacity-60" />
              {detail}
            </li>
          ))}
        </ul>
        
        {program.tradingview_script_id && (
          <Alert className="mt-4">
            <AlertDescription className="text-xs">
              <strong>TradingView Script ID:</strong> {program.tradingview_script_id}
              {program.tradingview_publication_url && (
                <div className="mt-1">
                  <a 
                    href={program.tradingview_publication_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    View on TradingView
                  </a>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default DeliveryInfo;
