
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Header from '@/components/Header';
import { CheckCircle } from 'lucide-react';

const SubscriptionSuccess = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    toast({
      title: 'Subscription Successful!',
      description: 'Welcome to your new subscription plan. You now have access to premium features.',
    });
  }, [toast]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <Card>
            <CardHeader className="text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <CardTitle>Subscription Successful!</CardTitle>
              <CardDescription>
                Your subscription has been activated successfully.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-center text-muted-foreground">
                You now have access to your subscription benefits. Start exploring premium scripts and features.
              </p>
              <div className="flex flex-col gap-2">
                <Button onClick={() => navigate('/browse')} className="w-full">
                  Browse Scripts
                </Button>
                <Button 
                  onClick={() => navigate('/subscriptions')} 
                  variant="outline" 
                  className="w-full"
                >
                  Manage Subscription
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionSuccess;
