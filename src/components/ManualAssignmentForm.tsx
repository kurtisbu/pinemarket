
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, RefreshCw, Send } from 'lucide-react';

interface ManualAssignmentFormProps {
  initialUsername: string;
  onSubmit: (username: string, notes: string) => Promise<void>;
  processing: boolean;
}

const ManualAssignmentForm: React.FC<ManualAssignmentFormProps> = ({
  initialUsername,
  onSubmit,
  processing
}) => {
  const [username, setUsername] = useState(initialUsername);
  const [notes, setNotes] = useState('');

  const handleSubmit = async () => {
    await onSubmit(username, notes);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="w-5 h-5" />
          Manual Script Assignment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="username">TradingView Username</Label>
          <Input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter TradingView username"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="notes">Notes (Optional)</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any notes about this manual assignment..."
            rows={3}
          />
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This will trigger a manual script assignment. Make sure the TradingView username is correct.
          </AlertDescription>
        </Alert>

        <Button 
          onClick={handleSubmit}
          disabled={processing || !username.trim()}
          className="w-full"
        >
          {processing ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Trigger Manual Assignment
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default ManualAssignmentForm;
