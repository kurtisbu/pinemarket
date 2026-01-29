
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Header from '@/components/Header';
import { XCircle } from 'lucide-react';

const SubscriptionCancel = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <Card>
            <CardHeader className="text-center">
              <XCircle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
              <CardTitle>Subscription Cancelled</CardTitle>
              <CardDescription>
                Your subscription process was cancelled.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-center text-muted-foreground">
                No charges were made. You can try again anytime or explore our free options.
              </p>
              <div className="flex flex-col gap-2">
                <Button onClick={() => navigate('/subscriptions')} className="w-full">
                  View Plans Again
                </Button>
                <Button 
                  onClick={() => navigate('/browse')} 
                  variant="outline" 
                  className="w-full"
                >
                  Browse Free Scripts
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionCancel;
