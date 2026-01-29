
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock, Shield, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
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
  const [trialStatus, setTrialStatus] = useState<'idle' | 'creating' | 'success' | 'error'>('idle');

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
    setTrialStatus('creating');
    
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

      console.log('Trial creation response:', data);

      if (data.success) {
        setTrialStatus('success');
        
        // Show appropriate success message based on assignment status
        if (data.assignment_status === 'assigned') {
          toast({
            title: 'Free trial started successfully!',
            description: `Your ${trialPeriodDays}-day free trial has begun and script access has been granted.`,
          });
        } else if (data.assignment_status === 'failed') {
          toast({
            title: 'Trial created with assignment issue',
            description: `Your trial is active, but there was an issue assigning the script. Please check your dashboard.`,
            variant: 'default',
          });
        } else {
          toast({
            title: 'Free trial started!',
            description: `Your ${trialPeriodDays}-day free trial has begun. Script access is being processed.`,
          });
        }

        // Clear the form
        setTradingviewUsername('');
        
        // Refresh the page after successful trial start
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        throw new Error(data.message || 'Failed to create trial');
      }
    } catch (error: any) {
      console.error('Trial start error:', error);
      setTrialStatus('error');
      
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

  if (trialStatus === 'success') {
    return (
      <Card className="border-green-200 bg-green-50/30">
        <CardContent className="p-6">
          <div className="text-center">
            <CheckCircle className="w-12 h-12 mx-auto text-green-600 mb-4" />
            <h3 className="text-lg font-semibold text-green-800 mb-2">
              Trial Started Successfully!
            </h3>
            <p className="text-sm text-green-700">
              Your {trialPeriodDays}-day free trial is now active. The page will refresh shortly.
            </p>
          </div>
        </CardContent>
      </Card>
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

        {trialStatus === 'error' && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              There was an issue starting your trial. Please try again or contact support.
            </AlertDescription>
          </Alert>
        )}
        
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
