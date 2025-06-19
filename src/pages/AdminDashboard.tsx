
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AdminScriptAssignments from '@/components/AdminScriptAssignments';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const AdminDashboard: React.FC = () => {
  const { user, profile } = useAuth();

  // Redirect if not authenticated or not admin
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!profile || profile.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>
          
          <Tabs defaultValue="assignments" className="space-y-6">
            <TabsList>
              <TabsTrigger value="assignments">Script Assignments</TabsTrigger>
              <TabsTrigger value="users">User Management</TabsTrigger>
              <TabsTrigger value="programs">Program Management</TabsTrigger>
            </TabsList>

            <TabsContent value="assignments">
              <AdminScriptAssignments />
            </TabsContent>

            <TabsContent value="users">
              <div className="text-center py-8 text-muted-foreground">
                User management interface coming soon...
              </div>
            </TabsContent>

            <TabsContent value="programs">
              <div className="text-center py-8 text-muted-foreground">
                Program management interface coming soon...
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AdminDashboard;
