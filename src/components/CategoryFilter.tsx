
import React from 'react';
import { Button } from '@/components/ui/button';
import { TrendingUp, Target, Bell, Zap, BarChart3, PieChart } from 'lucide-react';

const categories = [
  { name: 'All', icon: BarChart3, count: 1247 },
  { name: 'Indicators', icon: TrendingUp, count: 523 },
  { name: 'Strategies', icon: Target, count: 342 },
  { name: 'Alerts', icon: Bell, count: 198 },
  { name: 'Screeners', icon: PieChart, count: 156 },
  { name: 'Utilities', icon: Zap, count: 28 },
];

const CategoryFilter = () => {
  const [activeCategory, setActiveCategory] = React.useState('All');

  return (
    <section className="py-8 border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap gap-3 justify-center">
          {categories.map((category) => {
            const Icon = category.icon;
            const isActive = activeCategory === category.name;
            
            return (
              <Button
                key={category.name}
                variant={isActive ? "default" : "outline"}
                onClick={() => setActiveCategory(category.name)}
                className={`flex items-center space-x-2 ${
                  isActive 
                    ? 'bg-gradient-to-r from-blue-500 to-green-500' 
                    : 'hover:bg-muted'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{category.name}</span>
                <span className="text-xs bg-muted-foreground/20 px-2 py-1 rounded-full">
                  {category.count}
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
