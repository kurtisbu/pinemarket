
import React from 'react';
import { Button } from '@/components/ui/button';
import { TrendingUp, Shield, Zap } from 'lucide-react';

const Hero = () => {
  return (
    <section className="relative bg-gradient-to-br from-background via-background to-muted py-20">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-500 to-green-500 bg-clip-text text-transparent">
            Premium Pine Script Marketplace
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Discover, purchase, and deploy professional TradingView indicators and strategies created by expert traders worldwide.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button size="lg" className="bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600">
              Browse Scripts
            </Button>
            <Button size="lg" variant="outline">
              Start Selling
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
            <div className="text-center">
              <div className="bg-blue-500/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8 text-blue-500" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Proven Strategies</h3>
              <p className="text-muted-foreground">Access battle-tested trading strategies with verified performance metrics</p>
            </div>
            
            <div className="text-center">
              <div className="bg-green-500/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Secure & Verified</h3>
              <p className="text-muted-foreground">All scripts are reviewed and verified for quality and security</p>
            </div>
            
            <div className="text-center">
              <div className="bg-purple-500/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-purple-500" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Instant Access</h3>
              <p className="text-muted-foreground">Purchase and deploy scripts to TradingView instantly</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
