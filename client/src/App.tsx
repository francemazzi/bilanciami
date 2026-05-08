import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { MainLayout } from '@/components/layout/MainLayout';
import { HomePage } from '@/pages/HomePage';
import { UploadPage } from '@/pages/UploadPage';
import { ExtractionResultsPage } from '@/pages/ExtractionResultsPage';
import { DocumentsPage } from '@/pages/DocumentsPage';
import { DdtPage } from '@/pages/DdtPage';
import { DocumentDetailPage } from '@/pages/DocumentDetailPage';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { AdminPage } from '@/pages/AdminPage';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AdminRoute } from '@/components/auth/AdminRoute';
import { useAuthStore } from '@/stores/auth.store';
import { getMe } from '@/api/auth';

function AuthInitializer({ children }: { children: React.ReactNode }) {
  const { setLoading, setAuth } = useAuthStore();
  const initRef = useRef(false);

  useEffect(() => {
    async function initAuth() {
      // Prevent double initialization in React Strict Mode
      if (initRef.current) return;
      initRef.current = true;

      // Try to restore session from httpOnly cookie
      try {
        const { user } = await getMe();
        setAuth(user);
      } catch {
        // Not authenticated or session expired
        setLoading(false);
      }
    }

    initAuth();
  }, [setLoading, setAuth]);

  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <AuthInitializer>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected routes */}
          <Route
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<HomePage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/results" element={<ExtractionResultsPage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/ddt" element={<DdtPage />} />
            <Route path="/documents/:id" element={<DocumentDetailPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminPage />
                </AdminRoute>
              }
            />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster position="top-right" richColors />
      </AuthInitializer>
    </BrowserRouter>
  );
}

export default App;
