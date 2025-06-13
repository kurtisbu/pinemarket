
import React from 'react';
import { Button } from '@/components/ui/button';
import { TrendingUp, Target, Bell, Zap, BarChart3, PieChart } from 'lucide-react';

const categoryIcons = {
  'All': BarChart3,
  'Indicator': TrendingUp,
  'Strategy': Target,
  'Utility': Zap,
  'Screener': PieChart,
  'Library': Bell,
  'Educational': BarChart3,
};

interface CategoryFilterProps {
  activeCategory: string;
  onCategoryChange: (category: string) => void;
  categoryCounts: Record<string, number>;
}

const CategoryFilter: React.FC<CategoryFilterProps> = ({
  activeCategory,
  onCategoryChange,
  categoryCounts
}) => {
  const categories = ['All', 'Indicator', 'Strategy', 'Utility', 'Screener', 'Library', 'Educational'];

  return (
    <section className="py-8 border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap gap-3 justify-center">
          {categories.map((category) => {
            const Icon = categoryIcons[category] || BarChart3;
            const isActive = activeCategory === category;
            const count = categoryCounts[category] || 0;
            
            return (
              <Button
                key={category}
                variant={isActive ? "default" : "outline"}
                onClick={() => onCategoryChange(category)}
                className={`flex items-center space-x-2 ${
                  isActive 
                    ? 'bg-gradient-to-r from-blue-500 to-green-500' 
                    : 'hover:bg-muted'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{category}</span>
                <span className="text-xs bg-muted-foreground/20 px-2 py-1 rounded-full">
                  {count}
                </span>
              </Button>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default CategoryFilter;
