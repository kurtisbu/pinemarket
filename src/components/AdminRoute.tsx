import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Navigate, useSearchParams } from 'react-router-dom';

interface AdminRouteProps {
  children: React.ReactNode;
}

// Bypass logic: preview hosts always pass; production passes if a valid
// preview token is present (?preview=TOKEN), persisted in localStorage.
const PREVIEW_TOKEN = 'pinemarket-preview-2026';
const PREVIEW_STORAGE_KEY = 'pm_preview_access';

const isPreviewHost = () => {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return (
    host.endsWith('.lovable.app') ||
    host.endsWith('.lovableproject.com') ||
    host === 'localhost' ||
    host === '127.0.0.1'
  );
};

const hasPreviewAccess = () => {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(PREVIEW_STORAGE_KEY) === PREVIEW_TOKEN;
  } catch {
    return false;
  }
};

const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();

  // Capture ?preview=TOKEN into localStorage for persistent access
  useEffect(() => {
    const token = searchParams.get('preview');
    if (token && typeof window !== 'undefined') {
      try {
        if (token === PREVIEW_TOKEN) {
          localStorage.setItem(PREVIEW_STORAGE_KEY, PREVIEW_TOKEN);
        } else if (token === 'off') {
          localStorage.removeItem(PREVIEW_STORAGE_KEY);
        }
      } catch {
        // ignore
      }
    }
  }, [searchParams]);

  const bypass = isPreviewHost() || hasPreviewAccess() || searchParams.get('preview') === PREVIEW_TOKEN;

  const { data: isAdmin, isLoading } = useQuery({
    queryKey: ['is-admin', user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase.rpc('is_current_user_admin');
      return data === true;
    },
    enabled: !!user && !bypass,
  });

  if (bypass) {
    return <>{children}</>;
  }

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return <Navigate to="/interest" replace />;
  }

  return <>{children}</>;
};

export default AdminRoute;
