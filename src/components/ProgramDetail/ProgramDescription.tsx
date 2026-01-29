
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CreditCard } from 'lucide-react';

interface ProgramDescriptionProps {
  description: string;
  tags?: string[];
}

const ProgramDescription: React.FC<ProgramDescriptionProps> = ({ description, tags }) => {
  return (
    <>
      <Separator className="my-6" />
      
      <div>
        <h2 className="text-xl font-semibold mb-4">Description</h2>
        <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
          {description}
        </p>
      </div>

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
