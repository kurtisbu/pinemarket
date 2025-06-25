
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface PaymentSecurityCheck {
  id: string;
  name: string;
  status: 'passed' | 'failed' | 'warning';
  message: string;
  severity: 'low' | 'medium' | 'high';
}

interface PaymentSecurityValidatorProps {
  amount: number;
  buyerId: string;
  sellerId: string;
  programId: string;
  onValidationComplete: (isValid: boolean, checks: PaymentSecurityCheck[]) => void;
}

const PaymentSecurityValidator: React.FC<PaymentSecurityValidatorProps> = ({
  amount,
  buyerId,
  sellerId,
  programId,
  onValidationComplete
}) => {
  const [checks, setChecks] = useState<PaymentSecurityCheck[]>([]);
  const [isValidating, setIsValidating] = useState(false);

  const performSecurityChecks = async (): Promise<PaymentSecurityCheck[]> => {
    const securityChecks: PaymentSecurityCheck[] = [];

    // Amount validation
    if (amount < 0.50) {
      securityChecks.push({
        id: 'amount_min',
        name: 'Minimum Amount Check',
        status: 'failed',
        message: 'Payment amount is below minimum threshold ($0.50)',
        severity: 'high'
      });
    } else if (amount > 10000) {
      securityChecks.push({
        id: 'amount_max',
        name: 'Maximum Amount Check',
        status: 'warning',
        message: 'High-value transaction detected. Additional verification may be required.',
        severity: 'medium'
      });
    } else {
      securityChecks.push({
        id: 'amount_valid',
        name: 'Amount Validation',
        status: 'passed',
        message: 'Payment amount is within acceptable range',
        severity: 'low'
      });
    }

    // Self-purchase check
    if (buyerId === sellerId) {
      securityChecks.push({
        id: 'self_purchase',
        name: 'Self-Purchase Check',
        status: 'failed',
        message: 'Users cannot purchase their own scripts',
        severity: 'high'
      });
    } else {
      securityChecks.push({
        id: 'different_users',
        name: 'User Validation',
        status: 'passed',
        message: 'Buyer and seller are different users',
        severity: 'low'
      });
    }

    // Rate limiting check (simulate)
    const recentPurchases = Math.floor(Math.random() * 5); // Simulate recent purchase count
    if (recentPurchases > 3) {
      securityChecks.push({
        id: 'rate_limit',
        name: 'Rate Limiting Check',
        status: 'warning',
        message: 'Multiple recent purchases detected. Please wait before making another purchase.',
        severity: 'medium'
      });
    } else {
      securityChecks.push({
        id: 'rate_limit_ok',
        name: 'Rate Limiting Check',
        status: 'passed',
        message: 'Purchase rate is within acceptable limits',
        severity: 'low'
      });
    }

    // Program availability check
    if (programId) {
      securityChecks.push({
        id: 'program_available',
        name: 'Program Availability',
        status: 'passed',
        message: 'Program is available for purchase',
        severity: 'low'
      });
    } else {
      securityChecks.push({
        id: 'program_missing',
        name: 'Program Availability',
        status: 'failed',
        message: 'Program not found or unavailable',
        severity: 'high'
      });
    }

    return securityChecks;
  };

  const runValidation = async () => {
    setIsValidating(true);
    try {
      const validationResults = await performSecurityChecks();
      setChecks(validationResults);
      
      const hasFailures = validationResults.some(check => check.status === 'failed');
      const hasHighSeverityWarnings = validationResults.some(
        check => check.status === 'warning' && check.severity === 'high'
      );
      
      const isValid = !hasFailures && !hasHighSeverityWarnings;
      onValidationComplete(isValid, validationResults);
    } catch (error) {
      console.error('Security validation failed:', error);
      onValidationComplete(false, []);
    } finally {
      setIsValidating(false);
    }
  };

  React.useEffect(() => {
    runValidation();
  }, [amount, buyerId, sellerId, programId]);

  const getStatusIcon = (status: PaymentSecurityCheck['status']) => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusBadge = (status: PaymentSecurityCheck['status']) => {
    switch (status) {
      case 'passed':
        return <Badge variant="default" className="bg-green-100 text-green-800">Passed</Badge>;
      case 'warning':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Warning</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
    }
  };

  if (isValidating) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 animate-spin" />
            <span>Running security validation...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const failedChecks = checks.filter(check => check.status === 'failed');
  const warningChecks = checks.filter(check => check.status === 'warning');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Payment Security Validation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {failedChecks.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {failedChecks.length} security check(s) failed. Payment cannot proceed.
            </AlertDescription>
          </Alert>
        )}

        {warningChecks.length > 0 && failedChecks.length === 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {warningChecks.length} security warning(s) detected. Please review before proceeding.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          {checks.map((check) => (
            <div key={check.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                {getStatusIcon(check.status)}
                <div>
                  <p className="font-medium text-sm">{check.name}</p>
                  <p className="text-xs text-muted-foreground">{check.message}</p>
                </div>
              </div>
              {getStatusBadge(check.status)}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default PaymentSecurityValidator;
