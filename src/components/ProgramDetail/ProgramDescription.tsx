
import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card } from '@/components/ui/card';
import { CreditCard, Package, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface IncludedScript {
  id: string;
  title: string;
  publication_url: string;
  image_url: string | null;
}

interface ProgramDescriptionProps {
  description: string;
  tags?: string[];
  programId?: string;
}

const ProgramDescription: React.FC<ProgramDescriptionProps> = ({ description, tags, programId }) => {
  const [includedScripts, setIncludedScripts] = useState<IncludedScript[]>([]);
  const [loadingScripts, setLoadingScripts] = useState(false);

  useEffect(() => {
    const fetchIncludedScripts = async () => {
      if (!programId) return;
      
      setLoadingScripts(true);
      try {
        const { data, error } = await supabase
          .from('program_scripts')
          .select(`
            display_order,
            tradingview_scripts (
              id,
              title,
              publication_url,
              image_url
            )
          `)
          .eq('program_id', programId)
          .order('display_order');

        if (error) throw error;
        
        const scripts = data
          ?.filter(ps => ps.tradingview_scripts)
          .map(ps => ({
            id: ps.tradingview_scripts!.id,
            title: ps.tradingview_scripts!.title,
            publication_url: ps.tradingview_scripts!.publication_url,
            image_url: ps.tradingview_scripts!.image_url,
          })) || [];
        
        setIncludedScripts(scripts);
      } catch (error) {
        console.error('Failed to fetch included scripts:', error);
      } finally {
        setLoadingScripts(false);
      }
    };

    fetchIncludedScripts();
  }, [programId]);

  return (
    <>
      <Separator className="my-6" />
      
      <div>
        <h2 className="text-xl font-semibold mb-4">Description</h2>
        <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
          {description}
        </p>
      </div>

      {includedScripts.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Package className="w-5 h-5" />
            Included Scripts ({includedScripts.length})
          </h3>
          <div className="grid gap-3">
            {includedScripts.map(script => (
              <Card key={script.id} className="p-3 flex items-center gap-3">
                {script.image_url && (
                  <img
                    src={script.image_url}
                    alt={script.title}
                    className="w-16 h-10 object-cover rounded"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{script.title}</p>
                </div>
                {script.publication_url && (
                  <a
                    href={script.publication_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline text-sm flex items-center gap-1"
                  >
                    View
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 p-4 bg-muted/50 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Pricing Details</h3>
        <div className="space-y-2 text-sm">
          <p className="flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            <strong>One-time Purchase:</strong> Pay once and own this script forever
          </p>
          <p>No recurring charges or subscription fees</p>
          <p>Lifetime access to updates and improvements</p>
        </div>
      </div>
      
      {tags && tags.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-3">Tags</h3>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag, index) => (
              <Badge key={index} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

export default ProgramDescription;
