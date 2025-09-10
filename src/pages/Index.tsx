
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import Hero from '@/components/Hero';
import CategoryFilter from '@/components/CategoryFilter';
import FeaturedPrograms from '@/components/FeaturedPrograms';
import FeaturedCreators from '@/components/FeaturedCreators';
import Footer from '@/components/Footer';

const Index = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const handleCategoryChange = (category: string) => {
    // Navigate to browse page with the selected category
    const params = new URLSearchParams();
    if (category !== 'All') params.set('category', category);
    navigate(`/browse${params.toString() ? `?${params.toString()}` : ''}`);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    // Navigate to browse page with search query
    const params = new URLSearchParams();
    if (query) params.set('search', query);
    navigate(`/browse${params.toString() ? `?${params.toString()}` : ''}`);
  };

  // Mock category counts for the homepage (could be fetched from API in real implementation)
  const categoryCounts = {
    'All': 0,
    'Indicator': 0,
    'Strategy': 0,
    'Utility': 0,
    'Screener': 0,
    'Library': 0,
    'Educational': 0,
  };

  return (
    <div className="min-h-screen bg-background">
      <Header onSearch={handleSearch} searchQuery={searchQuery} />
      <main>
        <Hero />
        <CategoryFilter 
          activeCategory="All"
          onCategoryChange={handleCategoryChange}
          categoryCounts={categoryCounts}
        />
        <FeaturedCreators limit={6} />
        <FeaturedPrograms />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
