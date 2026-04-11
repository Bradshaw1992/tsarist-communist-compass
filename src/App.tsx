import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { InstallPrompt } from "@/components/InstallPrompt";
import { AnonymousBanner } from "@/components/AnonymousBanner";
import { UserMenu } from "@/components/UserMenu";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index.tsx";
import LoginPage from "./pages/LoginPage.tsx";
import TopicPage from "./pages/TopicPage.tsx";
import ReviewPage from "./pages/ReviewPage.tsx";
import SpecPage from "./pages/SpecPage.tsx";
import SpecActivityPage from "./pages/SpecActivityPage.tsx";
import ChronologyPage from "./pages/ChronologyPage.tsx";
import ChronologyModePage from "./pages/ChronologyModePage.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AnonymousBanner />
          <UserMenu />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/spec/:specId" element={<SpecPage />} />
            <Route path="/spec/:specId/:activity" element={<SpecActivityPage />} />
            <Route path="/chronology" element={<ChronologyPage />} />
            <Route path="/chronology/:mode" element={<ChronologyModePage />} />
            <Route path="/topic/:slug" element={<TopicPage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
      <InstallPrompt />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
