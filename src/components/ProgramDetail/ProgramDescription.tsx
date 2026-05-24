
import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card } from '@/components/ui/card';
import { Package, ExternalLink, LineChart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const isValidPublicationUrl = (url: string | null | undefined): boolean => {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.includes('#published-scripts')) return false;
  // Generic profile URL like /u/username/ — not a specific script publication
  if (/\/u\/[^/]+\/?$/.test(trimmed)) return false;
  return true;
};

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
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              Included Scripts
            </h3>
            <Badge variant="secondary" className="text-xs">
              {includedScripts.length} {includedScripts.length === 1 ? 'script' : 'scripts'}
            </Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {includedScripts.map(script => {
              const hasLink = isValidPublicationUrl(script.publication_url);
              const Wrapper: any = hasLink ? 'a' : 'div';
              const wrapperProps = hasLink
                ? {
                    href: script.publication_url,
                    target: '_blank',
                    rel: 'noopener noreferrer',
                  }
                : {};
              return (
                <Wrapper
                  key={script.id}
                  {...wrapperProps}
                  className={`group flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 transition-all ${
                    hasLink
                      ? 'hover:border-primary/40 hover:bg-primary/5 cursor-pointer'
                      : ''
                  }`}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <LineChart className="w-4 h-4" />
                  </div>
                  <p className="flex-1 min-w-0 truncate text-sm font-medium">
                    {script.title}
                  </p>
                  {hasLink && (
                    <ExternalLink className="w-3.5 h-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                  )}
                </Wrapper>
              );
            })}
          </div>
        </div>
      )}
      
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
