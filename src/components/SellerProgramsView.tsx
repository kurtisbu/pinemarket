
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Edit, Eye, Archive, MoreHorizontal, Plus } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Program {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  tags: string[];
  status: string;
  created_at: string;
  image_urls: string[];
  pricing_model: string;
  monthly_price?: number;
  yearly_price?: number;
}

const SellerProgramsView: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    if (user) {
      fetchPrograms();
    }
  }, [user]);

  const fetchPrograms = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('programs')
        .select('*')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPrograms(data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to fetch programs',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateProgramStatus = async (programId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('programs')
        .update({ status: newStatus })
        .eq('id', programId);

      if (error) throw error;

      setPrograms(prev => 
        prev.map(program => 
          program.id === programId 
            ? { ...program, status: newStatus }
            : program
        )
      );

      toast({
        title: 'Status updated',
        description: `Program ${newStatus === 'published' ? 'published' : newStatus} successfully.`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to update program status',
        variant: 'destructive',
      });
    }
  };

  const filteredPrograms = programs.filter(program => 
    statusFilter === 'all' || program.status === statusFilter
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
        return 'bg-green-100 text-green-800';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800';
      case 'archived':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">My Programs</h2>
          <p className="text-muted-foreground">Manage your Pine Script programs</p>
        </div>
        <Button onClick={() => navigate('/sell-script')}>
          <Plus className="w-4 h-4 mr-2" />
          New Program
        </Button>
      </div>

      <div className="flex gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Programs</SelectItem>
            <SelectItem value="draft">Drafts</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : filteredPrograms.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">
              {statusFilter === 'all' 
                ? "You haven't created any programs yet." 
                : `No ${statusFilter} programs found.`}
            </p>
            <Button 
              className="mt-4" 
              onClick={() => navigate('/sell-script')}
            >
              Create Your First Program
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPrograms.map((program) => (
            <Card key={program.id} className="overflow-hidden">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{program.title}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {program.category} • ${program.price}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigate(`/edit-program/${program.id}`)}>
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      {program.status === 'draft' && (
                        <DropdownMenuItem onClick={() => updateProgramStatus(program.id, 'published')}>
                          <Eye className="w-4 h-4 mr-2" />
                          Publish
                        </DropdownMenuItem>
                      )}
                      {program.status === 'published' && (
                        <DropdownMenuItem onClick={() => updateProgramStatus(program.id, 'archived')}>
                          <Archive className="w-4 h-4 mr-2" />
                          Archive
                        </DropdownMenuItem>
                      )}
                      {program.status === 'archived' && (
                        <DropdownMenuItem onClick={() => updateProgramStatus(program.id, 'published')}>
                          <Eye className="w-4 h-4 mr-2" />
                          Republish
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                {program.image_urls.length > 0 && (
                  <img
                    src={program.image_urls[0]}
                    alt={program.title}
                    className="w-full h-32 object-cover rounded mb-4"
                  />
                )}
                <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                  {program.description}
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {program.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  {program.tags.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{program.tags.length - 3} more
                    </Badge>
                  )}
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(program.status)}>
                      {program.status}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(program.created_at).toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default SellerProgramsView;
