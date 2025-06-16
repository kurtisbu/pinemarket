
import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ImageGallery from '@/components/ImageGallery';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Star, Download, Eye, User, Calendar, ShoppingCart, Check, Clock, AlertTriangle } from 'lucide-react';
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
            bio,
            is_tradingview_connected,
            tradingview_username
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

  const getAssignmentMethod = () => {
    if (program?.tradingview_script_id && program?.profiles?.is_tradingview_connected) {
      return 'automatic';
    }
    return 'manual';
  };

  const getDeliveryInfo = () => {
    const assignmentMethod = getAssignmentMethod();
    const hasScript = program?.tradingview_script_id;
    const sellerConnected = program?.profiles?.is_tradingview_connected;

    if (assignmentMethod === 'automatic') {
      return {
        type: 'success',
        icon: <Check className="w-4 h-4" />,
        title: 'Instant Access',
        description: 'This script will be automatically assigned to your TradingView account immediately after purchase.',
        details: [
          'Automatic assignment within seconds',
          'No manual steps required',
          'Direct access through TradingView'
        ]
      };
    } else if (hasScript && !sellerConnected) {
      return {
        type: 'warning',
        icon: <Clock className="w-4 h-4" />,
        title: 'Manual Assignment',
        description: 'The seller will manually assign this script to your TradingView account.',
        details: [
          'Assignment typically within 24 hours',
          'You will receive email notification',
          'Seller will contact you for TradingView username'
        ]
      };
    } else {
      return {
        type: 'info',
        icon: <AlertTriangle className="w-4 h-4" />,
        title: 'File Download',
        description: 'This program will be delivered as a downloadable Pine Script file.',
        details: [
          'Instant download after purchase',
          'Pine Script source code included',
          'Manual import to TradingView required'
        ]
      };
    }
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

  const deliveryInfo = getDeliveryInfo();

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
            {/* Delivery Information */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  {deliveryInfo.icon}
                  {deliveryInfo.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {deliveryInfo.description}
                </p>
                <ul className="space-y-2">
                  {deliveryInfo.details.map((detail, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm">
                      <div className="w-1.5 h-1.5 bg-current rounded-full opacity-60" />
                      {detail}
                    </li>
                  ))}
                </ul>
                
                {program.tradingview_script_id && (
                  <Alert className="mt-4">
                    <AlertDescription className="text-xs">
                      <strong>TradingView Script ID:</strong> {program.tradingview_script_id}
                      {program.tradingview_publication_url && (
                        <div className="mt-1">
                          <a 
                            href={program.tradingview_publication_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            View on TradingView
                          </a>
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

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

                {/* TradingView Connection Status */}
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-2 h-2 rounded-full ${
                      program.profiles?.is_tradingview_connected ? 'bg-green-500' : 'bg-gray-400'
                    }`} />
                    <span className="text-sm font-medium">
                      TradingView {program.profiles?.is_tradingview_connected ? 'Connected' : 'Not Connected'}
                    </span>
                  </div>
                  {program.profiles?.is_tradingview_connected && program.profiles?.tradingview_username && (
                    <p className="text-xs text-muted-foreground ml-4">
                      Profile: @{program.profiles.tradingview_username}
                    </p>
                  )}
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
