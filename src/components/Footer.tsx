
import React from 'react';
import { Github, Twitter, Linkedin, Mail } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-muted border-t border-border">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-green-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">PS</span>
              </div>
              <h3 className="text-lg font-bold">PineMarket</h3>
            </div>
            <p className="text-muted-foreground mb-4">
              The premier marketplace for TradingView Pine Script programs, connecting traders with professional indicators and strategies.
            </p>
            <div className="flex space-x-4">
              <Twitter className="w-5 h-5 text-muted-foreground hover:text-foreground cursor-pointer transition-colors" />
              <Github className="w-5 h-5 text-muted-foreground hover:text-foreground cursor-pointer transition-colors" />
              <Linkedin className="w-5 h-5 text-muted-foreground hover:text-foreground cursor-pointer transition-colors" />
              <Mail className="w-5 h-5 text-muted-foreground hover:text-foreground cursor-pointer transition-colors" />
            </div>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">Marketplace</h4>
            <ul className="space-y-2 text-muted-foreground">
              <li><a href="#" className="hover:text-foreground transition-colors">Browse Scripts</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Categories</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Top Sellers</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">New Releases</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">Sellers</h4>
            <ul className="space-y-2 text-muted-foreground">
              <li><a href="#" className="hover:text-foreground transition-colors">Start Selling</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Seller Guidelines</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Documentation</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Support</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">Support</h4>
            <ul className="space-y-2 text-muted-foreground">
              <li><a href="#" className="hover:text-foreground transition-colors">Help Center</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Contact Us</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Terms of Service</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-border mt-8 pt-8 text-center text-muted-foreground">
          <p>&copy; 2024 PineMarket. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
