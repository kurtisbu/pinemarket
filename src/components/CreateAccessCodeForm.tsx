
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { RefreshCw, Copy, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CreateAccessCodeFormProps {
  onSuccess: () => void;
}

const CreateAccessCodeForm: React.FC<CreateAccessCodeFormProps> = ({ onSuccess }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [useCustomCode, setUseCustomCode] = useState(false);
  const [customCode, setCustomCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [maxUses, setMaxUses] = useState('1');
  const [hasExpiration, setHasExpiration] = useState(false);
  const [expirationDate, setExpirationDate] = useState('');
  const [bulkCount, setBulkCount] = useState('1');
  const [prefix, setPrefix] = useState('SELLER');
  const [copied, setCopied] = useState(false);

  const generateCode = (withPrefix: string = prefix) => {
    const randomPart = Math.random().toString(36).substring(2, 10).toUpperCase();
    return `${withPrefix}-${randomPart}`;
  };

  const handleGenerateCode = () => {
    const newCode = generateCode();
    setGeneratedCode(newCode);
    if (!useCustomCode) {
      setCustomCode(newCode);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const validateForm = () => {
    const code = useCustomCode ? customCode : generatedCode;
    if (!code.trim()) {
      toast({
        title: 'Error',
        description: 'Please generate or enter a code',
        variant: 'destructive',
      });
      return false;
    }

    if (parseInt(maxUses) < 1 || parseInt(maxUses) > 1000) {
      toast({
        title: 'Error',
        description: 'Max uses must be between 1 and 1000',
        variant: 'destructive',
      });
      return false;
    }

    if (hasExpiration && !expirationDate) {
      toast({
        title: 'Error',
        description: 'Please select an expiration date',
        variant: 'destructive',
      });
      return false;
    }

    if (hasExpiration && new Date(expirationDate) <= new Date()) {
      toast({
        title: 'Error',
        description: 'Expiration date must be in the future',
        variant: 'destructive',
      });
      return false;
    }

    return true;
  };

  const createSingleCode = async (codeValue: string) => {
    const codeData = {
      code: codeValue,
      max_uses: parseInt(maxUses),
      expires_at: hasExpiration ? expirationDate : null,
    };

    const { error } = await supabase
      .from('seller_access_codes')
      .insert([codeData]);

    if (error) throw error;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    try {
      const count = parseInt(bulkCount);
      
      if (count === 1) {
        const code = useCustomCode ? customCode : generatedCode;
        await createSingleCode(code);
      } else {
        // Bulk creation
        const codes = [];
        for (let i = 0; i < count; i++) {
          codes.push({
            code: generateCode(),
            max_uses: parseInt(maxUses),
            expires_at: hasExpiration ? expirationDate : null,
          });
        }

        const { error } = await supabase
          .from('seller_access_codes')
          .insert(codes);

        if (error) throw error;
      }

      toast({
        title: 'Success',
        description: `Successfully created ${count} access code${count > 1 ? 's' : ''}`,
      });

      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create access code',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Generate initial code on mount
  React.useEffect(() => {
    handleGenerateCode();
  }, []);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Switch
            id="bulk-mode"
            checked={parseInt(bulkCount) > 1}
            onCheckedChange={(checked) => setBulkCount(checked ? '5' : '1')}
          />
          <Label htmlFor="bulk-mode">Bulk creation</Label>
        </div>

        {parseInt(bulkCount) > 1 && (
          <div className="space-y-2">
            <Label htmlFor="bulk-count">Number of codes to create</Label>
            <Input
              id="bulk-count"
              type="number"
              min="2"
              max="100"
              value={bulkCount}
              onChange={(e) => setBulkCount(e.target.value)}
            />
            <div className="space-y-2">
              <Label htmlFor="prefix">Code prefix</Label>
              <Input
                id="prefix"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value.toUpperCase())}
                placeholder="SELLER"
              />
            </div>
          </div>
        )}

        {parseInt(bulkCount) === 1 && (
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="custom-code"
                checked={useCustomCode}
                onCheckedChange={setUseCustomCode}
              />
              <Label htmlFor="custom-code">Use custom code</Label>
            </div>

            {useCustomCode ? (
              <div className="space-y-2">
                <Label htmlFor="custom-code-input">Custom Code</Label>
                <Input
                  id="custom-code-input"
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
                  placeholder="Enter custom code"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Generated Code</Label>
                <div className="flex space-x-2">
                  <Input
                    value={generatedCode}
                    readOnly
                    className="font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGenerateCode}
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => copyToClipboard(generatedCode)}
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <Separator />

        <div className="space-y-2">
          <Label htmlFor="max-uses">Maximum Uses</Label>
          <Select value={maxUses} onValueChange={setMaxUses}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 use</SelectItem>
              <SelectItem value="5">5 uses</SelectItem>
              <SelectItem value="10">10 uses</SelectItem>
              <SelectItem value="25">25 uses</SelectItem>
              <SelectItem value="50">50 uses</SelectItem>
              <SelectItem value="100">100 uses</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="has-expiration"
              checked={hasExpiration}
              onCheckedChange={setHasExpiration}
            />
            <Label htmlFor="has-expiration">Set expiration date</Label>
          </div>

          {hasExpiration && (
            <div className="space-y-2">
              <Label htmlFor="expiration-date">Expiration Date</Label>
              <Input
                id="expiration-date"
                type="date"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="submit" disabled={loading}>
          {loading && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
          Create {parseInt(bulkCount) > 1 && `${bulkCount} codes`}
        </Button>
      </div>
    </form>
  );
};

export default CreateAccessCodeForm;
