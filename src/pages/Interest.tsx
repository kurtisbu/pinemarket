
import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { TrendingUp, Shield, Zap, DollarSign, BarChart3, Users, ChevronRight, Check } from 'lucide-react';

const Interest = () => {
  const [email, setEmail] = useState('');
  const [tradingviewUsername, setTradingviewUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !tradingviewUsername.trim()) {
      toast({ title: 'Please fill in all fields', variant: 'destructive' });
      return;
    }

    setLoading(true);
    const { error } = await supabase.from('interest_signups').insert({
      email: email.trim(),
      tradingview_username: tradingviewUsername.trim(),
    });

    setLoading(false);

    if (error) {
      if (error.code === '23505') {
        toast({ title: 'You\'re already on the list!', description: 'We\'ll be in touch soon.' });
        setSubmitted(true);
      } else {
        toast({ title: 'Something went wrong', description: 'Please try again later.', variant: 'destructive' });
      }
      return;
    }

    setSubmitted(true);
    toast({ title: 'You\'re in! 🎉', description: 'We\'ll notify you when we launch.' });
  };

  const features = [
    { icon: DollarSign, title: 'Monetize Your Scripts', description: 'Sell your TradingView indicators and strategies with one-time or subscription pricing.' },
    { icon: Shield, title: 'Automated Access Control', description: 'We handle TradingView script access automatically — grant and revoke with zero effort.' },
    { icon: Zap, title: 'Instant Delivery', description: 'Buyers get access to your scripts immediately after purchase. No manual work.' },
    { icon: BarChart3, title: 'Analytics Dashboard', description: 'Track your sales, revenue, and customer engagement in real-time.' },
    { icon: Users, title: 'Built-in Audience', description: 'Get discovered by traders looking for quality indicators and strategies.' },
    { icon: TrendingUp, title: 'Flexible Pricing', description: 'Set one-time prices, monthly subscriptions, or bundle multiple scripts into packages.' },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10" />
        <div className="relative max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border bg-muted/50 text-sm text-muted-foreground mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/60 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            Coming Soon
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-foreground mb-6 leading-tight">
            Turn Your TradingView Scripts<br />
            <span className="text-primary/80">Into a Business</span>
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-12">
            PineMarket is the marketplace for TradingView creators. Sell your indicators, strategies, and tools — we handle payments, access control, and delivery automatically.
          </p>

          {/* Signup Form */}
          {!submitted ? (
            <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-3">
              <Input
                type="email"
                placeholder="Your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 text-base"
              />
              <Input
                placeholder="Your TradingView username"
                value={tradingviewUsername}
                onChange={(e) => setTradingviewUsername(e.target.value)}
                required
                className="h-12 text-base"
              />
              <Button type="submit" disabled={loading} className="w-full h-12 text-base font-semibold">
                {loading ? 'Joining...' : 'Get Early Access'}
                {!loading && <ChevronRight className="ml-1 h-4 w-4" />}
              </Button>
              <p className="text-xs text-muted-foreground">
                Join the waitlist. No spam, just launch updates.
              </p>
            </form>
          ) : (
            <div className="max-w-md mx-auto p-8 rounded-xl border border-border bg-card">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Check className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">You're on the list!</h3>
              <p className="text-muted-foreground">We'll reach out when PineMarket is ready for sellers.</p>
            </div>
          )}
        </div>
      </section>

      {/* Features Grid */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-4">
          Everything You Need to Sell Scripts
        </h2>
        <p className="text-muted-foreground text-center mb-12 max-w-xl mx-auto">
          Focus on building great indicators. We handle the rest.
        </p>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div key={feature.title} className="p-6 rounded-xl border border-border bg-card hover:shadow-md transition-shadow">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <feature.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-muted/30 py-20">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-12">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'List Your Script', description: 'Connect your TradingView account, select your published scripts, and set your price.' },
              { step: '02', title: 'Buyers Purchase', description: 'Traders discover and buy your scripts through our marketplace. We process payments via Stripe.' },
              { step: '03', title: 'We Handle the Rest', description: 'Access is granted automatically on TradingView. You get paid. No manual work required.' },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="text-4xl font-bold text-primary/20 mb-3">{item.step}</div>
                <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="max-w-5xl mx-auto px-6 py-20 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
          Ready to Start Selling?
        </h2>
        <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
          Join the waitlist and be the first to know when PineMarket launches.
        </p>
        {!submitted ? (
          <Button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} size="lg" className="font-semibold">
            Sign Up for Early Access <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <p className="text-muted-foreground">✅ You're already signed up!</p>
        )}
      </section>

      {/* Minimal Footer */}
      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} PineMarket. All rights reserved.
      </footer>
    </div>
  );
};

export default Interest;
