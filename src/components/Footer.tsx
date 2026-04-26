import React from 'react';
import { Github, Twitter, Linkedin, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import logo from '@/assets/logo.png';

const Footer = () => {
  const navigate = useNavigate();

  return (
    <footer className="bg-muted border-t border-border">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <img src={logo} alt="PineMarket logo" className="w-8 h-8 object-contain" />
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
              <li><button onClick={() => navigate('/browse')} className="hover:text-foreground transition-colors">Browse Scripts</button></li>
              <li><button onClick={() => navigate('/browse')} className="hover:text-foreground transition-colors">Categories</button></li>
              <li><button onClick={() => navigate('/creators')} className="hover:text-foreground transition-colors">Top Sellers</button></li>
              <li><button onClick={() => navigate('/browse?sort=newest')} className="hover:text-foreground transition-colors">New Releases</button></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">Sellers</h4>
            <ul className="space-y-2 text-muted-foreground">
              <li><button onClick={() => navigate('/seller/onboarding')} className="hover:text-foreground transition-colors">Start Selling</button></li>
              <li><button onClick={() => navigate('/dashboard')} className="hover:text-foreground transition-colors">Seller Dashboard</button></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">Account</h4>
            <ul className="space-y-2 text-muted-foreground">
              <li><button onClick={() => navigate('/auth')} className="hover:text-foreground transition-colors">Sign In</button></li>
              <li><button onClick={() => navigate('/my-purchases')} className="hover:text-foreground transition-colors">My Purchases</button></li>
              <li><button onClick={() => navigate('/settings/profile')} className="hover:text-foreground transition-colors">Profile Settings</button></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-border mt-8 pt-8 text-center text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} PineMarket. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
