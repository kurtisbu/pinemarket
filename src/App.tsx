
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
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
import Subscriptions from "./pages/Subscriptions";
import SubscriptionSuccess from "./pages/SubscriptionSuccess";
import SubscriptionCancel from "./pages/SubscriptionCancel";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <Toaster />
    <Sonner />
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/program/:id" element={<ProgramDetail />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/profile/:username" element={<Profile />} />
          <Route path="/settings/profile" element={<ProfileSettings />} />
          <Route path="/dashboard" element={<SellerDashboard />} />
          <Route path="/seller/onboarding" element={<SellerOnboardingPage />} />
          <Route path="/sell-script" element={<SellScript />} />
          <Route path="/my-programs" element={<MyPrograms />} />
          <Route path="/my-purchases" element={<MyPurchases />} />
          <Route path="/edit-program/:id" element={<EditProgram />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/subscriptions" element={<Subscriptions />} />
          <Route path="/subscription/success" element={<SubscriptionSuccess />} />
          <Route path="/subscription/cancel" element={<SubscriptionCancel />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
