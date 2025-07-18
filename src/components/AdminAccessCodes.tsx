
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Search, Filter, Download, Eye, Trash2, Edit, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import CreateAccessCodeForm from './CreateAccessCodeForm';
import AccessCodeDetails from './AccessCodeDetails';

interface AccessCode {
  id: string;
  code: string;
  is_used: boolean;
  current_uses: number;
  max_uses: number;
  expires_at: string | null;
  created_at: string;
  used_by_user_id: string | null;
  used_at: string | null;
}

const AdminAccessCodes: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [accessCodes, setAccessCodes] = useState<AccessCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedCode, setSelectedCode] = useState<AccessCode | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  useEffect(() => {
    fetchAccessCodes();
  }, []);

  const fetchAccessCodes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('seller_access_codes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAccessCodes(data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to fetch access codes',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteAccessCode = async (id: string) => {
    try {
      const { error } = await supabase
        .from('seller_access_codes')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Access code deleted successfully',
      });
      
      fetchAccessCodes();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to delete access code',
        variant: 'destructive',
      });
    }
  };

  const exportToCSV = () => {
    const csvContent = [
      ['Code', 'Status', 'Uses', 'Max Uses', 'Expires', 'Created'],
      ...filteredCodes.map(code => [
        code.code,
        getStatusLabel(code),
        code.current_uses.toString(),
        code.max_uses.toString(),
        code.expires_at ? new Date(code.expires_at).toLocaleDateString() : 'Never',
        new Date(code.created_at).toLocaleDateString()
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `access-codes-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getStatusLabel = (code: AccessCode) => {
    if (code.current_uses >= code.max_uses) return 'Fully Used';
    if (code.expires_at && new Date(code.expires_at) < new Date()) return 'Expired';
    if (code.current_uses > 0) return 'Partially Used';
    return 'Unused';
  };

  const getStatusVariant = (code: AccessCode): "default" | "secondary" | "destructive" | "outline" => {
    const status = getStatusLabel(code);
    switch (status) {
      case 'Fully Used': return 'secondary';
      case 'Expired': return 'destructive';
      case 'Partially Used': return 'outline';
      default: return 'default';
    }
  };

  const filteredCodes = accessCodes.filter(code => {
    const matchesSearch = code.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || getStatusLabel(code).toLowerCase().includes(statusFilter);
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="w-6 h-6 animate-spin" />
        <span className="ml-2">Loading access codes...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Seller Access Codes</h2>
          <p className="text-muted-foreground">
            Manage access codes for seller registration
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportToCSV} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Code
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Access Code</DialogTitle>
              </DialogHeader>
              <CreateAccessCodeForm 
                onSuccess={() => {
                  setShowCreateDialog(false);
                  fetchAccessCodes();
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search codes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="unused">Unused</SelectItem>
                <SelectItem value="partially">Partially Used</SelectItem>
                <SelectItem value="fully">Fully Used</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredCodes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {accessCodes.length === 0 
                ? "No access codes created yet. Create your first one above."
                : "No codes match your search criteria."
              }
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCodes.map((code) => (
                  <TableRow key={code.id}>
                    <TableCell className="font-mono font-medium">
                      {code.code}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(code)}>
                        {getStatusLabel(code)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {code.current_uses} / {code.max_uses}
                    </TableCell>
                    <TableCell>
                      {code.expires_at 
                        ? new Date(code.expires_at).toLocaleDateString()
                        : 'Never'
                      }
                    </TableCell>
                    <TableCell>
                      {new Date(code.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedCode(code);
                            setShowDetailsDialog(true);
                          }}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteAccessCode(code.id)}
                          disabled={code.current_uses > 0}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Access Code Details</DialogTitle>
          </DialogHeader>
          {selectedCode && (
            <AccessCodeDetails 
              code={selectedCode}
              onClose={() => setShowDetailsDialog(false)}
              onUpdate={fetchAccessCodes}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminAccessCodes;
