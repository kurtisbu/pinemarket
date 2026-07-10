import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageCircle, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { resolveDiscordInvite } from '@/lib/discord';

interface DiscordAccessCardProps {
  programId?: string;
  sellerDisplayName?: string | null;
  productInvite?: string | null;
  productDescription?: string | null;
  sellerDefaultInvite?: string | null;
  sellerDefaultDescription?: string | null;
  /**
   * If true, skip the purchase check (used on /my-purchases where ownership is already known).
   */
  ownershipConfirmed?: boolean;
  className?: string;
}

const DiscordAccessCard: React.FC<DiscordAccessCardProps> = ({
  programId,
  sellerDisplayName,
  productInvite,
  productDescription,
  sellerDefaultInvite,
  sellerDefaultDescription,
  ownershipConfirmed = false,
  className,
}) => {
  const { user } = useAuth();
  const [owns, setOwns] = useState<boolean>(ownershipConfirmed);
  const inviteUrl = resolveDiscordInvite(productInvite, sellerDefaultInvite);
  const description =
    (productInvite ? productDescription : sellerDefaultDescription) ||
    sellerDefaultDescription ||
    null;

  useEffect(() => {
    if (ownershipConfirmed) {
      setOwns(true);
      return;
    }
    if (!user || !programId || !inviteUrl) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('purchases')
        .select('id')
        .eq('buyer_id', user.id)
        .eq('program_id', programId)
        .eq('status', 'completed')
        .limit(1);
      if (!cancelled) setOwns((data?.length ?? 0) > 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, programId, inviteUrl, ownershipConfirmed]);

  if (!inviteUrl || !owns) return null;

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#5865F2]/10 text-[#5865F2]">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-semibold leading-tight">
              Join {sellerDisplayName || 'the seller'} on Discord
            </h4>
            {description && (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            )}
            <Button asChild size="sm" className="mt-3 bg-[#5865F2] hover:bg-[#4752C4] text-white">
              <a href={inviteUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1 h-4 w-4" />
                Join Discord
              </a>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DiscordAccessCard;