
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import SellerOnboarding from '@/components/SellerOnboarding';

const SellerOnboardingPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    navigate('/auth');
    return null;
  }

  const handleComplete = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <SellerOnboarding onComplete={handleComplete} />
      </div>
    </div>
  );
};

export default SellerOnboardingPage;
