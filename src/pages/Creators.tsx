import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Star, TrendingUp, Users, ArrowRight, Award, Search, Filter } from 'lucide-react';

interface FeaturedCreator {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  bio: string;
  featured_description: string;
  total_programs: number;
  avg_rating: number;
  total_sales: number;
  total_revenue: number;
  featured_priority: number;
}

const Creators = () => {
  const [creators, setCreators] = useState<FeaturedCreator[]>([]);
  const [filteredCreators, setFilteredCreators] = useState<FeaturedCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('priority');
  const navigate = useNavigate();

  useEffect(() => {
    fetchFeaturedCreators();
  }, []);

  useEffect(() => {
    filterAndSortCreators();
  }, [creators, searchQuery, sortBy]);

  const fetchFeaturedCreators = async () => {
    try {
      const { data, error } = await supabase
        .from('featured_creators_with_stats')
        .select('*')
        .order('featured_priority', { ascending: false });

      if (error) throw error;
      setCreators(data || []);
    } catch (error) {
      console.error('Error fetching featured creators:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortCreators = () => {
    let filtered = creators.filter(creator => {
      const searchLower = searchQuery.toLowerCase();
      return (
        creator.username.toLowerCase().includes(searchLower) ||
        creator.display_name?.toLowerCase().includes(searchLower) ||
        creator.bio?.toLowerCase().includes(searchLower)
      );
    });

    // Sort creators
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'priority':
          return b.featured_priority - a.featured_priority;
        case 'rating':
          return b.avg_rating - a.avg_rating;
        case 'sales':
          return b.total_sales - a.total_sales;
        case 'programs':
          return b.total_programs - a.total_programs;
        case 'revenue':
          return b.total_revenue - a.total_revenue;
        case 'name':
          return (a.display_name || a.username).localeCompare(b.display_name || b.username);
        default:
          return 0;
      }
    });

    setFilteredCreators(filtered);
  };

  const handleViewProfile = (username: string) => {
    navigate(`/profile/${username}`);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header onSearch={handleSearch} searchQuery={searchQuery} />
        <main className="container mx-auto px-4 py-8">
          <div className="space-y-8">
            <div className="text-center space-y-4">
              <div className="animate-pulse">
                <div className="h-12 bg-muted rounded w-64 mx-auto mb-4" />
                <div className="h-4 bg-muted rounded w-96 mx-auto" />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, index) => (
                <Card key={index} className="animate-pulse">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-muted rounded-full" />
                      <div className="space-y-2 flex-1">
                        <div className="h-4 bg-muted rounded w-3/4" />
                        <div className="h-3 bg-muted rounded w-1/2" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-3 bg-muted rounded w-full" />
                      <div className="h-3 bg-muted rounded w-2/3" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header onSearch={handleSearch} searchQuery={searchQuery} />
      
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Hero Section */}
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <Award className="w-8 h-8 text-amber-500" />
              <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
                Featured Creators
              </h1>
              <Award className="w-8 h-8 text-amber-500" />
            </div>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Meet our community of exceptional creators who consistently deliver high-quality trading scripts, 
              innovative strategies, and outstanding customer satisfaction.
            </p>
            <Badge variant="outline" className="px-4 py-2 text-lg">
              {creators.length} Featured Creators
            </Badge>
          </div>

          {/* Filters and Search */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-muted/20 p-6 rounded-lg">
            <div className="flex items-center space-x-2 flex-1 max-w-md">
              <Search className="w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Search creators by name or bio..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-muted-foreground" />
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Sort by..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="priority">Featured Priority</SelectItem>
                  <SelectItem value="rating">Highest Rated</SelectItem>
                  <SelectItem value="sales">Most Sales</SelectItem>
                  <SelectItem value="programs">Most Programs</SelectItem>
                  <SelectItem value="revenue">Highest Revenue</SelectItem>
                  <SelectItem value="name">Name A-Z</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Results Count */}
          {searchQuery && (
            <div className="text-center">
              <p className="text-muted-foreground">
                Found {filteredCreators.length} creator{filteredCreators.length !== 1 ? 's' : ''} 
                {searchQuery && ` matching "${searchQuery}"`}
              </p>
            </div>
          )}

          {/* Creators Grid */}
          {filteredCreators.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredCreators.map((creator, index) => (
                <Card 
                  key={creator.id}
                  className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-2 bg-gradient-to-br from-background to-muted/30"
                >
                  <CardContent className="p-6 space-y-4">
                    {/* Priority Badge */}
                    {creator.featured_priority > 5 && (
                      <div className="flex justify-end">
                        <Badge 
                          variant="default" 
                          className="bg-gradient-to-r from-amber-500 to-orange-500 text-xs"
                        >
                          Top Creator
                        </Badge>
                      </div>
                    )}

                    {/* Creator Header */}
                    <div className="flex items-start space-x-3">
                      <div className="relative">
                        <Avatar className="h-14 w-14 ring-2 ring-amber-500/30">
                          <AvatarImage src={creator.avatar_url} />
                          <AvatarFallback className="bg-gradient-to-br from-amber-500 to-orange-500 text-white text-lg font-semibold">
                            {creator.display_name?.[0] || creator.username?.[0] || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <Badge 
                          variant="default" 
                          className="absolute -top-1 -right-1 p-0 h-6 w-6 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 border-2 border-background"
                        >
                          <Star className="w-3 h-3" />
                        </Badge>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-lg group-hover:text-primary transition-colors line-clamp-1">
                          {creator.display_name || creator.username}
                        </h3>
                        <p className="text-sm text-muted-foreground">@{creator.username}</p>
                      </div>
                    </div>

                    {/* Featured Description */}
                    {creator.featured_description && (
                      <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                        <p className="text-sm font-medium text-amber-800 dark:text-amber-200 line-clamp-2">
                          {creator.featured_description}
                        </p>
                      </div>
                    )}

                    {/* Bio */}
                    {creator.bio && (
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {creator.bio}
                      </p>
                    )}

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-3 py-3 border-t border-border">
                      <div className="text-center space-y-1">
                        <div className="flex items-center justify-center space-x-1">
                          <TrendingUp className="w-4 h-4 text-blue-500" />
                          <span className="text-lg font-semibold">{creator.total_programs}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Programs</p>
                      </div>
                      
                      <div className="text-center space-y-1">
                        <div className="flex items-center justify-center space-x-1">
                          <Users className="w-4 h-4 text-green-500" />
                          <span className="text-lg font-semibold">{creator.total_sales}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Sales</p>
                      </div>
                    </div>

                    {/* Rating */}
                    {creator.avg_rating > 0 && (
                      <div className="flex items-center justify-center space-x-1 py-2">
                        <div className="flex items-center space-x-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`w-4 h-4 ${
                                i < Math.floor(creator.avg_rating)
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-muted-foreground'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-sm font-medium">{creator.avg_rating.toFixed(1)}</span>
                      </div>
                    )}

                    {/* View Profile Button */}
                    <Button
                      variant="outline"
                      className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                      onClick={() => handleViewProfile(creator.username)}
                    >
                      View Profile
                      <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="space-y-4">
                <Users className="w-16 h-16 text-muted-foreground mx-auto" />
                <h3 className="text-xl font-semibold">No creators found</h3>
                <p className="text-muted-foreground">
                  {searchQuery 
                    ? `No creators match your search for "${searchQuery}"`
                    : "No featured creators available at the moment"
                  }
                </p>
                {searchQuery && (
                  <Button variant="outline" onClick={() => setSearchQuery('')}>
                    Clear Search
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Creators;