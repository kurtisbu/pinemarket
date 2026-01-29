
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, Check, Calendar, Users, Clock, Edit2, Save, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AccessCode {
  id: string;
  code: string;
  is_used: boolean;
  current_uses: number;
  max_uses: number;
  expires_at: string | null;
  created_at: string;
  used_by_user_id: string | null;
  used_at: string | null;
}

interface AccessCodeDetailsProps {
  code: AccessCode;
  onClose: () => void;
  onUpdate: () => void;
}

const AccessCodeDetails: React.FC<AccessCodeDetailsProps> = ({ code, onClose, onUpdate }) => {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editedMaxUses, setEditedMaxUses] = useState(code.max_uses.toString());
  const [editedExpiresAt, setEditedExpiresAt] = useState(
    code.expires_at ? new Date(code.expires_at).toISOString().split('T')[0] : ''
  );
  const [usageHistory, setUsageHistory] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // In a real implementation, you might want to fetch usage history
    // For now, we'll show basic information
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusInfo = () => {
    if (code.current_uses >= code.max_uses) {
      return { label: 'Fully Used', variant: 'secondary' as const };
    }
    if (code.expires_at && new Date(code.expires_at) < new Date()) {
      return { label: 'Expired', variant: 'destructive' as const };
    }
    if (code.current_uses > 0) {
      return { label: 'Partially Used', variant: 'outline' as const };
    }
    return { label: 'Unused', variant: 'default' as const };
  };

  const handleSaveChanges = async () => {
    setLoading(true);
    try {
      const updates: any = {
        max_uses: parseInt(editedMaxUses),
      };

      if (editedExpiresAt) {
        updates.expires_at = new Date(editedExpiresAt).toISOString();
      } else {
        updates.expires_at = null;
      }

      const { error } = await supabase
        .from('seller_access_codes')
        .update(updates)
        .eq('id', code.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Access code updated successfully',
      });

      setIsEditing(false);
      onUpdate();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to update access code',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedMaxUses(code.max_uses.toString());
    setEditedExpiresAt(
      code.expires_at ? new Date(code.expires_at).toISOString().split('T')[0] : ''
    );
  };

  const statusInfo = getStatusInfo();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Access Code Details</h3>
          <p className="text-sm text-muted-foreground">
            Code: <span className="font-mono font-medium">{code.code}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => copyToClipboard(code.code)}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </Button>
          <Badge variant={statusInfo.variant}>
            {statusInfo.label}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="w-4 h-4" />
              Usage Statistics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Current Uses:</span>
              <span className="font-medium">{code.current_uses}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Maximum Uses:</span>
              {isEditing ? (
                <Input
                  type="number"
                  min="1"
                  max="1000"
                  value={editedMaxUses}
                  onChange={(e) => setEditedMaxUses(e.target.value)}
                  className="w-20 h-6 text-sm"
                />
              ) : (
                <span className="font-medium">{code.max_uses}</span>
              )}
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Remaining:</span>
              <span className="font-medium">
                {Math.max(0, code.max_uses - code.current_uses)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Dates & Expiration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Created:</span>
              <span className="font-medium">
                {new Date(code.created_at).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Expires:</span>
              {isEditing ? (
                <Input
                  type="date"
                  value={editedExpiresAt}
                  onChange={(e) => setEditedExpiresAt(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-32 h-6 text-sm"
                />
              ) : (
                <span className="font-medium">
                  {code.expires_at 
                    ? new Date(code.expires_at).toLocaleDateString()
                    : 'Never'
                  }
                </span>
              )}
            </div>
            {code.used_at && (
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">First Used:</span>
                <span className="font-medium">
                  {new Date(code.used_at).toLocaleDateString()}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {code.expires_at && new Date(code.expires_at) < new Date() && (
        <Alert>
          <Clock className="w-4 h-4" />
          <AlertDescription>
            This access code has expired and can no longer be used.
          </AlertDescription>
        </Alert>
      )}

      {code.current_uses >= code.max_uses && (
        <Alert>
          <Users className="w-4 h-4" />
          <AlertDescription>
            This access code has reached its maximum usage limit.
          </AlertDescription>
        </Alert>
      )}

      <Separator />

      <div className="flex justify-end space-x-2">
        {isEditing ? (
          <>
            <Button variant="outline" onClick={handleCancelEdit}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSaveChanges} disabled={loading}>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            onClick={() => setIsEditing(true)}
            disabled={code.current_uses >= code.max_uses}
          >
            <Edit2 className="w-4 h-4 mr-2" />
            Edit
          </Button>
        )}
      </div>
    </div>
  );
};

export default AccessCodeDetails;
