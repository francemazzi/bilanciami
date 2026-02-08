import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';

const ADMIN_EMAIL = 'francemazzi@gmail.com';

interface AdminRouteProps {
  children: React.ReactNode;
}

export function isAdmin(email: string | undefined): boolean {
  return email === ADMIN_EMAIL;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { user, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!user || !isAdmin(user.email)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
