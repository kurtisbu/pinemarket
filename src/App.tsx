
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import AdminRoute from "@/components/AdminRoute";
import Index from "./pages/Index";
import Browse from "./pages/Browse";
import ProgramDetail from "./pages/ProgramDetail";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import ProfileSettings from "./pages/ProfileSettings";
import SellScript from "./pages/SellScript";
import MyPrograms from "./pages/MyPrograms";
import MyPurchases from "./pages/MyPurchases";
import SellerDashboard from "./pages/SellerDashboard";
import SellerOnboardingPage from "./pages/SellerOnboarding";
import EditProgram from "./pages/EditProgram";
import AdminDashboard from "./pages/AdminDashboard";
import Creators from "./pages/Creators";
import CreatePackage from "./pages/CreatePackage";
import ResetPassword from "./pages/ResetPassword";
import Interest from "./pages/Interest";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <Toaster />
    <Sonner />
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/interest" element={<Interest />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Admin-only routes */}
          <Route path="/" element={<AdminRoute><Index /></AdminRoute>} />
          <Route path="/browse" element={<AdminRoute><Browse /></AdminRoute>} />
          <Route path="/program/:id" element={<AdminRoute><ProgramDetail /></AdminRoute>} />
          <Route path="/create-package" element={<AdminRoute><CreatePackage /></AdminRoute>} />
          <Route path="/profile/:username" element={<AdminRoute><Profile /></AdminRoute>} />
          <Route path="/settings/profile" element={<AdminRoute><ProfileSettings /></AdminRoute>} />
          <Route path="/dashboard" element={<AdminRoute><SellerDashboard /></AdminRoute>} />
          <Route path="/seller/onboarding" element={<AdminRoute><SellerOnboardingPage /></AdminRoute>} />
          <Route path="/sell-script" element={<AdminRoute><SellScript /></AdminRoute>} />
          <Route path="/my-programs" element={<AdminRoute><MyPrograms /></AdminRoute>} />
          <Route path="/my-purchases" element={<AdminRoute><MyPurchases /></AdminRoute>} />
          <Route path="/edit-program/:id" element={<AdminRoute><EditProgram /></AdminRoute>} />
          <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          <Route path="/creators" element={<AdminRoute><Creators /></AdminRoute>} />

          {/* Catch-all redirects to interest page */}
          <Route path="*" element={<Interest />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
