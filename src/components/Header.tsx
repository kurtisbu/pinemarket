
import React from 'react';
import { Search, User, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const Header = () => {
  return (
    <header className="bg-background border-b border-border sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-green-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">PS</span>
              </div>
              <h1 className="text-xl font-bold">PineMarket</h1>
            </div>
            
            <nav className="hidden md:flex space-x-6">
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Browse</a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Categories</a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Top Sellers</a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">New</a>
            </nav>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input 
                placeholder="Search Pine Script programs..." 
                className="pl-10 w-64"
              />
            </div>
            
            <Button variant="ghost" size="icon">
              <ShoppingCart className="w-5 h-5" />
            </Button>
            
            <Button variant="ghost" size="icon">
              <User className="w-5 h-5" />
            </Button>
            
            <Button>Sell Your Script</Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
