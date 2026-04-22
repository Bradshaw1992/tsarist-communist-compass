import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { InstallPrompt } from "@/components/InstallPrompt";
import { AppShell } from "@/components/AppShell";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index.tsx";
import LoginPage from "./pages/LoginPage.tsx";
import TopicPage from "./pages/TopicPage.tsx";
import TopicsPage from "./pages/TopicsPage.tsx";
import ReviewPage from "./pages/ReviewPage.tsx";
import RandomPage from "./pages/RandomPage.tsx";
import SpecPage from "./pages/SpecPage.tsx";
import SpecActivityPage from "./pages/SpecActivityPage.tsx";
import ChronologyPage from "./pages/ChronologyPage.tsx";
import ChronologyModePage from "./pages/ChronologyModePage.tsx";
import ExtractPracticePage from "./pages/ExtractPracticePage.tsx";
import ExtractSessionPage from "./pages/ExtractSessionPage.tsx";
import TeacherDashboard from "./pages/TeacherDashboard.tsx";
import TeacherClassPage from "./pages/TeacherClassPage.tsx";
import TeacherStudentPage from "./pages/TeacherStudentPage.tsx";
import TeacherQuestionsPage from "./pages/TeacherQuestionsPage.tsx";
import TeacherFeedbackPage from "./pages/TeacherFeedbackPage.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Pages inside the top-nav shell */}
            <Route element={<AppShell />}>
              <Route path="/" element={<Index />} />
              <Route path="/topics" element={<TopicsPage />} />
              <Route path="/general" element={<ChronologyPage />} />
              {/* Legacy alias — old links still work */}
              <Route
                path="/chronology"
                element={<Navigate to="/general" replace />}
              />
              <Route path="/random" element={<RandomPage />} />
              <Route path="/extracts" element={<ExtractPracticePage />} />
              <Route path="/review" element={<ReviewPage />} />
              <Route path="/spec/:specId" element={<SpecPage />} />
              <Route path="/topic/:slug" element={<TopicPage />} />
              {/* Teacher routes */}
              <Route path="/teacher" element={<TeacherDashboard />} />
              <Route
                path="/teacher/class/:classId"
                element={<TeacherClassPage />}
              />
              <Route
                path="/teacher/class/:classId/student/:studentId"
                element={<TeacherStudentPage />}
              />
              <Route
                path="/teacher/questions"
                element={<TeacherQuestionsPage />}
              />
              <Route
                path="/teacher/feedback"
                element={<TeacherFeedbackPage />}
              />
            </Route>

            {/* Full-bleed pages — no shell */}
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/spec/:specId/:activity"
              element={<SpecActivityPage />}
            />
            <Route
              path="/chronology/:mode"
              element={<ChronologyModePage />}
            />
            <Route
              path="/extracts/:setId"
              element={<ExtractSessionPage />}
            />
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
