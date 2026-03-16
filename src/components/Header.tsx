import React, { useState, useEffect } from 'react';
import { Search, User, LogOut, LayoutDashboard, Settings, UserCircle, Shield, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

interface HeaderProps {
  onSearch?: (query: string) => void;
  searchQuery?: string;
}

const Header: React.FC<HeaderProps> = ({ onSearch, searchQuery = '' }) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState<{ username: string; avatar_url: string; display_name: string; is_tradingview_connected: boolean; role?: string } | null>(null);
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (user) {
      const fetchProfile = async () => {
        try {
          const { data } = await supabase
            .from('profiles')
            .select('username, avatar_url, display_name, is_tradingview_connected')
            .eq('id', user.id)
            .single();
          
          if (data) {
            const { data: isAdmin } = await supabase
              .rpc('is_current_user_admin');
            
            setProfile({ ...data, role: isAdmin ? 'admin' : 'user' });
          }
        } catch (error) {
          // Silently handle profile fetch errors
        }
      };
      fetchProfile();
    }
  }, [user]);

  useEffect(() => {
    setLocalSearchQuery(searchQuery);
  }, [searchQuery]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleDashboard = () => {
    if (profile?.is_tradingview_connected) {
      navigate('/dashboard');
    } else {
      navigate('/settings/profile');
    }
  };

  const handleSellScript = () => {
    if (profile?.is_tradingview_connected) {
      navigate('/sell-script');
    } else {
      navigate('/seller/onboarding');
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(localSearchQuery);
    } else {
      const params = new URLSearchParams();
      if (localSearchQuery) params.set('search', localSearchQuery);
      navigate(`/browse?${params.toString()}`);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalSearchQuery(value);
    if (onSearch && location.pathname === '/browse') {
      onSearch(value);
    }
  };

  const handleMyProfile = () => {
    if (profile?.username) {
      navigate(`/profile/${profile.username}`);
    }
  };

  const handleMyPurchases = () => {
    navigate('/my-purchases');
  };

  const handleAdminDashboard = () => {
    navigate('/admin');
  };

  const navLinks = [
    { label: 'Browse', onClick: () => navigate('/browse') },
    { label: 'Creators', onClick: () => navigate('/creators') },
    { label: 'New', onClick: () => navigate('/browse?sort=newest') },
  ];

  return (
    <header className="bg-background border-b border-border sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <div className="flex items-center space-x-2 cursor-pointer" onClick={() => navigate('/')}>
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-green-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">PS</span>
              </div>
              <h1 className="text-xl font-bold">PineMarket</h1>
            </div>
            
            <nav className="hidden md:flex space-x-6">
              {navLinks.map((link) => (
                <button
                  key={link.label}
                  onClick={link.onClick}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {link.label}
                </button>
              ))}
            </nav>
          </div>
          
          <div className="flex items-center space-x-4">
            <form onSubmit={handleSearchSubmit} className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input 
                placeholder="Search Pine Script programs..." 
                className="pl-10 w-64"
                value={localSearchQuery}
                onChange={handleSearchChange}
              />
            </form>
            
            {/* Mobile menu */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72">
                <div className="flex flex-col space-y-4 mt-8">
                  <form onSubmit={(e) => { handleSearchSubmit(e); setMobileMenuOpen(false); }}>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                      <Input 
                        placeholder="Search..." 
                        className="pl-10"
                        value={localSearchQuery}
                        onChange={handleSearchChange}
                      />
                    </div>
                  </form>
                  {navLinks.map((link) => (
                    <button
                      key={link.label}
                      onClick={() => { link.onClick(); setMobileMenuOpen(false); }}
                      className="text-left text-foreground hover:text-primary transition-colors py-2 text-lg"
                    >
                      {link.label}
                    </button>
                  ))}
                  {user && (
                    <>
                      <hr className="border-border" />
                      <button onClick={() => { handleMyPurchases(); setMobileMenuOpen(false); }} className="text-left py-2">My Purchases</button>
                      {profile?.is_tradingview_connected && (
                        <button onClick={() => { handleDashboard(); setMobileMenuOpen(false); }} className="text-left py-2">Seller Dashboard</button>
                      )}
                    </>
                  )}
                </div>
              </SheetContent>
            </Sheet>

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={profile?.avatar_url} alt={profile?.display_name || 'User'} />
                      <AvatarFallback>
                        <User className="w-4 h-4" />
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={handleMyProfile}>
                    <UserCircle className="w-4 h-4 mr-2" />
                    My Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleMyPurchases}>
                    <LayoutDashboard className="w-4 h-4 mr-2" />
                    My Purchases
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/settings/profile')}>
                    <Settings className="w-4 h-4 mr-2" />
                    Profile Settings
                  </DropdownMenuItem>
                  {profile?.is_tradingview_connected && (
                    <DropdownMenuItem onClick={handleDashboard}>
                      <LayoutDashboard className="w-4 h-4 mr-2" />
                      Seller Dashboard
                    </DropdownMenuItem>
                  )}
                  {profile?.role === 'admin' && (
                    <DropdownMenuItem onClick={handleAdminDashboard}>
                      <Shield className="w-4 h-4 mr-2" />
                      Admin Dashboard
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="ghost" size="icon" onClick={() => navigate('/auth')}>
                <User className="w-5 h-5" />
              </Button>
            )}
            
            {user ? (
              <Button onClick={handleSellScript} className="hidden sm:inline-flex">
                {profile?.is_tradingview_connected ? 'Sell Your Script' : 'Become a Seller'}
              </Button>
            ) : (
              <Button onClick={() => navigate('/auth')} className="hidden sm:inline-flex">Join PineMarket</Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
