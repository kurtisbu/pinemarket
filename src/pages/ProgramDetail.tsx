
import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ImageGallery from '@/components/ImageGallery';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Star, Download, Eye, User, Calendar, ShoppingCart } from 'lucide-react';
import { Loader2 } from 'lucide-react';

const ProgramDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: program, isLoading, error } = useQuery({
    queryKey: ['program', id],
    queryFn: async () => {
      if (!id) throw new Error('Program ID is required');

      const { data, error } = await supabase
        .from('programs')
        .select(`
          *,
          profiles!seller_id (
            display_name,
            username,
            avatar_url,
            bio
          )
        `)
        .eq('id', id)
        .eq('status', 'published')
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Increment view count when program is loaded
  useEffect(() => {
    if (program && id) {
      supabase.rpc('increment_program_view_count', { program_uuid: id });
    }
  }, [program, id]);

  const handleViewProfile = () => {
    if (program?.profiles?.username) {
      navigate(`/profile/${program.profiles.username}`);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex justify-center items-center py-12">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !program) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-12 text-center">
          <h1 className="text-2xl font-bold mb-4">Program Not Found</h1>
          <p className="text-muted-foreground mb-4">
            The program you're looking for doesn't exist or has been removed.
          </p>
          <Button onClick={() => navigate('/browse')}>
            Browse All Programs
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Image Gallery */}
            <ImageGallery images={program.image_urls || []} />
            
            {/* Program Details */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Badge className="bg-blue-500 hover:bg-blue-600">
                  {program.category}
                </Badge>
                <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span>{program.average_rating.toFixed(1)}</span>
                  <span>({program.rating_count} reviews)</span>
                </div>
              </div>
              
              <h1 className="text-3xl font-bold mb-4">{program.title}</h1>
              
              <div className="flex items-center gap-6 text-sm text-muted-foreground mb-6">
                <div className="flex items-center space-x-1">
                  <Download className="w-4 h-4" />
                  <span>{program.download_count} downloads</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Eye className="w-4 h-4" />
                  <span>{program.view_count} views</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Calendar className="w-4 h-4" />
                  <span>Published {formatDate(program.created_at)}</span>
                </div>
              </div>
              
              <Separator className="my-6" />
              
              <div>
                <h2 className="text-xl font-semibold mb-4">Description</h2>
                <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {program.description}
                </p>
              </div>
              
              {program.tags && program.tags.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-3">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {program.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Sidebar */}
          <div className="space-y-6">
            {/* Purchase Card */}
            <Card>
              <CardContent className="p-6">
                <div className="text-center mb-6">
                  <div className="text-3xl font-bold text-green-600 mb-2">
                    ${program.price}
                  </div>
                  <p className="text-sm text-muted-foreground">One-time purchase</p>
                </div>
                
                <Button className="w-full mb-4 bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600">
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Buy Now
                </Button>
                
                <Button variant="outline" className="w-full">
                  Add to Cart
                </Button>
              </CardContent>
            </Card>
            
            {/* Seller Info */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">Seller Information</h3>
                
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-green-500 flex items-center justify-center">
                    {program.profiles?.avatar_url ? (
                      <img 
                        src={program.profiles.avatar_url} 
                        alt={program.profiles.display_name || 'Seller'} 
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <User className="w-6 h-6 text-white" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-medium">
                      {program.profiles?.display_name || 'Unknown Seller'}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      @{program.profiles?.username || 'unknown'}
                    </p>
                  </div>
                </div>
                
                {program.profiles?.bio && (
                  <p className="text-sm text-muted-foreground mb-4">
                    {program.profiles.bio}
                  </p>
                )}
                
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={handleViewProfile}
                >
                  View Profile
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default ProgramDetail;
