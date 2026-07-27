import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import ProtectedRoute from '@/components/layout/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import DashboardPage from '@/pages/Dashboard';
import SubjectsPage from '@/pages/Subjects';
import SessionsPage from '@/pages/Sessions';
import PlannerPage from '@/pages/Planner';
import ExamsPage from '@/pages/Exams';
import SettingsPage from '@/pages/Settings';
import PlansPage from '@/pages/Plans';
import QuestionsPage from '@/pages/Questions';
import ReviewsPage from '@/pages/Reviews';
import StudyCyclePage from '@/pages/StudyCycle';
import { PlanProvider } from '@/contexts/PlanContext';

export default function App() {
  return (
    <ThemeProvider>
      <TooltipProvider>
        <AuthProvider>
          <PlanProvider>
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Protected routes */}
              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/subjects" element={<SubjectsPage />} />
                  <Route path="/sessions" element={<SessionsPage />} />
                  <Route path="/planner" element={<PlannerPage />} />
                  <Route path="/cycle" element={<StudyCyclePage />} />
                  <Route path="/exams" element={<ExamsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/plans" element={<PlansPage />} />
                  <Route path="/questions" element={<QuestionsPage />} />
                  <Route path="/reviews" element={<ReviewsPage />} />
                </Route>
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <Toaster richColors position="top-right" />
          </BrowserRouter>
          </PlanProvider>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
