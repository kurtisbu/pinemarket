
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock, Shield, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface TrialPurchaseCardProps {
  programId: string;
  sellerId: string;
  trialPeriodDays: number;
  isTrialEligible: boolean;
}

const TrialPurchaseCard: React.FC<TrialPurchaseCardProps> = ({ 
  programId, 
  sellerId, 
  trialPeriodDays,
  isTrialEligible 
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [tradingviewUsername, setTradingviewUsername] = useState('');

  const handleTrialStart = async () => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please log in to start your free trial.',
        variant: 'destructive',
      });
      navigate('/auth');
      return;
    }

    if (!tradingviewUsername.trim()) {
      toast({
        title: 'TradingView username required',
        description: 'Please enter your TradingView username to receive trial access.',
        variant: 'destructive',
      });
      return;
    }

    if (!isTrialEligible) {
      toast({
        title: 'Trial not available',
        description: 'You have already used the free trial for this program.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      console.log('Starting free trial...', { 
        programId, 
        trialPeriodDays,
        tradingviewUsername: tradingviewUsername.trim()
      });
      
      // Create a trial purchase record
      const { data, error } = await supabase.functions.invoke('stripe-connect', {
        body: {
          action: 'create-trial-access',
          program_id: programId,
          trial_period_days: trialPeriodDays,
          tradingview_username: tradingviewUsername.trim()
        },
      });

      if (error) {
        console.error('Trial creation error:', error);
        throw error;
      }

      console.log('Trial created successfully:', data);

      // Record trial usage
      await supabase.rpc('record_trial_usage', {
        p_user_id: user.id,
        p_program_id: programId
      });

      toast({
        title: 'Free trial started!',
        description: `Your ${trialPeriodDays}-day free trial has begun. Script access is being set up.`,
      });

      // Clear the form
      setTradingviewUsername('');
      
      // Refresh the page after successful trial start
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error: any) {
      console.error('Trial start error:', error);
      toast({
        title: 'Failed to start trial',
        description: error.message || 'An unexpected error occurred while starting your trial.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isTrialEligible) {
    return (
      <Alert>
        <Clock className="h-4 w-4" />
        <AlertDescription>
          You have already used the free trial for this program.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <CardContent className="p-6">
        <div className="text-center mb-6">
          <div className="text-3xl font-bold text-blue-600 mb-2">
            Free Trial
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <div className="flex items-center justify-center gap-1">
              <Clock className="w-4 h-4" />
              <span>{trialPeriodDays} days free access</span>
            </div>
            <p className="text-xs">Try before you buy</p>
          </div>
        </div>
        
        <div className="space-y-4 mb-6">
          <div>
            <Label htmlFor="trial-tradingview-username">TradingView Username</Label>
            <Input
              id="trial-tradingview-username"
              placeholder="Enter your TradingView username"
              value={tradingviewUsername}
              onChange={(e) => setTradingviewUsername(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Required to grant you trial access to the script
            </p>
          </div>
        </div>
        
        <Button 
          className="w-full mb-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
          onClick={handleTrialStart}
          disabled={loading || !tradingviewUsername.trim()}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <>
              <Shield className="w-4 h-4 mr-2" />
              <Clock className="w-4 h-4 mr-2" />
            </>
          )}
          {loading ? 'Starting Trial...' : `Start ${trialPeriodDays}-Day Free Trial`}
        </Button>
        
        <div className="text-xs text-muted-foreground text-center">
          <p className="flex items-center justify-center gap-1">
            <Shield className="w-3 h-3" />
            No payment required for trial
          </p>
          <p className="mt-1">Trial automatically expires after {trialPeriodDays} days</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default TrialPurchaseCard;
