
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Mail, Chrome } from 'lucide-react';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tradingviewUsername, setTradingviewUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [wantsToSell, setWantsToSell] = useState(false);
  const [forgotPassword, setForgotPassword] = useState(false);
  
  const { signIn, signUp, signInWithProvider, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({
        title: 'Email required',
        description: 'Please enter your email address.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Check your email',
          description: 'A password reset link has been sent to your email.',
        });
        setForgotPassword(false);
      }
    } catch {
      toast({
        title: 'An error occurred',
        description: 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          toast({
            title: "Error signing in",
            description: error.message,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Welcome back!",
            description: "You've been signed in successfully.",
          });
        }
      } else {
        const { error } = await signUp(email, password, tradingviewUsername || undefined);
        if (error) {
          toast({
            title: "Error signing up",
            description: error.message,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Account created!",
            description: wantsToSell 
              ? "Please check your email to verify your account, then you'll be guided through the seller setup."
              : "Please check your email to verify your account.",
          });
          
          if (wantsToSell) {
            localStorage.setItem('pendingSellerOnboarding', 'true');
          }
        }
      }
    } catch {
      toast({
        title: "An error occurred",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const { error } = await signInWithProvider('google');
      if (error) {
        toast({
          title: "Error signing in with Google",
          description: error.message,
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "An error occurred",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (forgotPassword) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-6">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-green-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">PS</span>
              </div>
              <h1 className="text-2xl font-bold">PineMarket</h1>
            </div>
            <h2 className="text-3xl font-bold">Reset Password</h2>
            <p className="mt-2 text-muted-foreground">
              Enter your email and we'll send you a reset link.
            </p>
          </div>

          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <label htmlFor="reset-email" className="block text-sm font-medium mb-2">
                Email address
              </label>
              <Input
                id="reset-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </Button>
            <div className="text-center">
              <button
                type="button"
                onClick={() => setForgotPassword(false)}
                className="text-primary hover:underline"
              >
                Back to Sign In
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex items-center justify-center space-x-2 mb-6">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-green-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">PS</span>
            </div>
            <h1 className="text-2xl font-bold">PineMarket</h1>
          </div>
          <h2 className="text-3xl font-bold">
            {isLogin ? 'Sign in to your account' : 'Create your account'}
          </h2>
          <p className="mt-2 text-muted-foreground">
            {isLogin 
              ? 'Welcome back to the Pine Script marketplace' 
              : 'Join the Pine Script community'}
          </p>
        </div>

        <Button
          variant="outline"
          className="w-full"
          disabled={loading}
          onClick={handleGoogleLogin}
        >
          <Chrome className="mr-2 h-4 w-4" />
          Continue with Google
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <Separator className="w-full" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Or continue with
            </span>
          </div>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                Email address
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-sm font-medium">
                  Password
                </label>
                {isLogin && (
                  <button
                    type="button"
                    onClick={() => setForgotPassword(true)}
                    className="text-sm text-primary hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
            </div>
            {!isLogin && (
              <>
                <div className="bg-muted border border-border rounded-lg p-4">
                  <label htmlFor="tradingviewUsername" className="block text-sm font-semibold mb-2">
                    TradingView Username (Optional)
                  </label>
                  <Input
                    id="tradingviewUsername"
                    type="text"
                    value={tradingviewUsername}
                    onChange={(e) => setTradingviewUsername(e.target.value)}
                    placeholder="Your TradingView username"
                  />
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">
                      ✓ Auto-fills at checkout for faster purchases
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ✓ Required to receive access to Pine Scripts you purchase
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ✓ Can be added later in Profile Settings
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="wantsToSell"
                    checked={wantsToSell}
                    onChange={(e) => setWantsToSell(e.target.checked)}
                    className="rounded border-border"
                  />
                  <label htmlFor="wantsToSell" className="text-sm">
                    I want to sell Pine Scripts (we'll guide you through the setup)
                  </label>
                </div>
              </>
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading}
          >
            {loading ? 'Please wait...' : (isLogin ? 'Sign in' : 'Sign up')}
          </Button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary hover:underline"
            >
              {isLogin 
                ? "Don't have an account? Sign up" 
                : 'Already have an account? Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Auth;
