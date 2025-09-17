import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Star, TrendingUp, Users, DollarSign, Settings } from 'lucide-react';

interface Creator {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  bio: string;
  role: string;
  is_featured: boolean;
  featured_at: string;
  featured_priority: number;
  featured_description: string;
  total_programs: number;
  avg_rating: number;
  total_sales: number;
  total_revenue: number;
}

const AdminFeaturedCreators = () => {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [allCreators, setAllCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCreator, setSelectedCreator] = useState<Creator | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchCreators();
    fetchAllCreators();
  }, []);

  const fetchCreators = async () => {
    try {
      const { data, error } = await supabase.rpc('get_featured_creators_with_stats');

      if (error) throw error;
      setCreators(data || []);
    } catch (error) {
      console.error('Error fetching featured creators:', error);
      toast({
        title: "Error",
        description: "Failed to fetch featured creators",
        variant: "destructive",
      });
    }
  };

  const fetchAllCreators = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          programs!programs_seller_id_fkey(count),
          purchases!purchases_seller_id_fkey(count, amount)
        `)
        .eq('role', 'seller')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Transform data to match Creator interface
      const transformedData = data?.map(profile => ({
        ...profile,
        total_programs: profile.programs?.length || 0,
        avg_rating: 0, // Would need separate query for this
        total_sales: profile.purchases?.length || 0,
        total_revenue: profile.purchases?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0,
      })) || [];
      
      setAllCreators(transformedData);
    } catch (error) {
      console.error('Error fetching all creators:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFeaturedStatus = async (creatorId: string, featured: boolean, priority = 0, description = '') => {
    try {
      const { error } = await supabase.rpc('toggle_creator_featured_status', {
        creator_id: creatorId,
        featured,
        priority,
        description
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Creator ${featured ? 'featured' : 'unfeatured'} successfully`,
      });

      fetchCreators();
      fetchAllCreators();
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error toggling featured status:', error);
      toast({
        title: "Error",
        description: "Failed to update creator status",
        variant: "destructive",
      });
    }
  };

  const handleFeatureCreator = (creator: Creator) => {
    setSelectedCreator(creator);
    setIsDialogOpen(true);
  };

  const FeaturedCreatorForm = ({ creator }: { creator: Creator }) => {
    const [priority, setPriority] = useState(creator.featured_priority || 1);
    const [description, setDescription] = useState(creator.featured_description || '');
    const [isFeatured, setIsFeatured] = useState(creator.is_featured);

    const handleSubmit = () => {
      toggleFeaturedStatus(creator.id, isFeatured, priority, description);
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Switch
            checked={isFeatured}
            onCheckedChange={setIsFeatured}
            id="featured-toggle"
          />
          <Label htmlFor="featured-toggle">Featured Creator</Label>
        </div>

        {isFeatured && (
          <>
            <div className="space-y-2">
              <Label htmlFor="priority">Priority (1-10, higher = more prominent)</Label>
              <Input
                id="priority"
                type="number"
                min="1"
                max="10"
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value) || 1)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Featured Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="Add a custom description for why this creator is featured..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
          </>
        )}

        <Button onClick={handleSubmit} className="w-full">
          {isFeatured ? 'Update Featured Status' : 'Remove from Featured'}
        </Button>
      </div>
    );
  };

  const CreatorStatsCard = ({ creator }: { creator: Creator }) => (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center space-x-4">
          <Avatar className="h-12 w-12">
            <AvatarImage src={creator.avatar_url} />
            <AvatarFallback>{creator.display_name?.[0] || creator.username?.[0] || '?'}</AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <h3 className="font-semibold truncate">{creator.display_name || creator.username}</h3>
              {creator.is_featured && (
                <Badge variant="default" className="bg-gradient-to-r from-amber-500 to-orange-500">
                  <Star className="w-3 h-3 mr-1" />
                  Featured
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">@{creator.username}</p>
          </div>

          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center space-x-1">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              <span>{creator.total_programs} programs</span>
            </div>
            <div className="flex items-center space-x-1">
              <Users className="w-4 h-4 text-green-500" />
              <span>{creator.total_sales} sales</span>
            </div>
            <div className="flex items-center space-x-1">
              <DollarSign className="w-4 h-4 text-purple-500" />
              <span>${creator.total_revenue?.toFixed(0) || 0}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Star className="w-4 h-4 text-yellow-500" />
              <span>{creator.avg_rating?.toFixed(1) || 'N/A'}</span>
            </div>
          </div>

          <Dialog open={isDialogOpen && selectedCreator?.id === creator.id} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleFeatureCreator(creator)}
              >
                <Settings className="w-4 h-4 mr-1" />
                Manage
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Manage Featured Status</DialogTitle>
              </DialogHeader>
              <FeaturedCreatorForm creator={creator} />
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-pulse">Loading creators...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Featured Creators Management</h2>
          <p className="text-muted-foreground">
            Promote high-performing creators to boost their visibility and sales
          </p>
        </div>
        <Badge variant="outline" className="px-3 py-1">
          {creators.length} Featured
        </Badge>
      </div>

      {creators.length > 0 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Star className="w-5 h-5 text-amber-500" />
                <span>Currently Featured Creators</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {creators.map((creator) => (
                <CreatorStatsCard key={creator.id} creator={creator} />
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Creators</CardTitle>
          <p className="text-sm text-muted-foreground">
            Manage featured status for all creators on the platform
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {allCreators.map((creator) => (
            <CreatorStatsCard key={creator.id} creator={creator} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminFeaturedCreators;