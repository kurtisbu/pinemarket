
import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';

interface SearchAndSortProps {
  sortBy: string;
  onSortChange: (value: string) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
}

const SearchAndSort: React.FC<SearchAndSortProps> = ({
  sortBy,
  onSortChange,
  searchQuery,
  onSearchChange,
}) => {
  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-6">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          placeholder="Search Pine Script programs..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>
      
      <Select value={sortBy} onValueChange={onSortChange}>
        <SelectTrigger className="w-full sm:w-48">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="newest">Newest</SelectItem>
          <SelectItem value="popular">Most Popular</SelectItem>
          <SelectItem value="rated">Top Rated</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};

export default SearchAndSort;
