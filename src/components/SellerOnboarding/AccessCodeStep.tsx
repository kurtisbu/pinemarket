
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowRight } from 'lucide-react';

interface AccessCodeStepProps {
  onNext: () => void;
}

interface AccessCodeResponse {
  valid: boolean;
  error?: string;
  message?: string;
}

const AccessCodeStep: React.FC<AccessCodeStepProps> = ({ onNext }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [accessCode, setAccessCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const validateAccessCode = async () => {
    if (!user || !accessCode.trim()) {
      setError('Please enter an access code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase.rpc('validate_seller_access_code', {
        p_code: accessCode.trim(),
        p_user_id: user.id
      });

      if (error) throw error;

      const response = data as AccessCodeResponse;

      if (response.valid) {
        toast({
          title: 'Access Code Validated',
          description: 'You can now proceed with seller onboarding.',
        });
        onNext();
      } else {
        setError(response.error || 'Invalid access code');
      }
    } catch (error: any) {
      console.error('Access code validation error:', error);
      setError('Failed to validate access code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    validateAccessCode();
  };

  return (
    <div className="text-center space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Seller Access Required</h2>
        <p className="text-muted-foreground">
          Please enter your seller access code to continue with the onboarding process.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="accessCode">Seller Access Code</Label>
          <Input
            id="accessCode"
            type="text"
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value)}
            placeholder="Enter your access code"
            disabled={loading}
          />
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button 
          type="submit" 
          className="w-full"
          disabled={loading || !accessCode.trim()}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Validating...
            </>
          ) : (
            <>
              Validate Access Code
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </form>

      <div className="bg-muted/50 p-4 rounded-lg text-left">
        <h3 className="font-semibold mb-2">Need an access code?</h3>
        <p className="text-sm text-muted-foreground">
          Seller access codes are provided by invitation only. Contact support if you believe you should have access to sell on our platform.
        </p>
      </div>
    </div>
  );
};

export default AccessCodeStep;
