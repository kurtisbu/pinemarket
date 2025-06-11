
import React from 'react';
import Header from '@/components/Header';
import Hero from '@/components/Hero';
import CategoryFilter from '@/components/CategoryFilter';
import FeaturedPrograms from '@/components/FeaturedPrograms';
import Footer from '@/components/Footer';

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <Hero />
        <CategoryFilter />
        <FeaturedPrograms />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
