import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export function Splash() {
  return (
    <div className="grid h-full place-items-center">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-100 border-t-emerald-700" />
    </div>
  );
}

// Accès réservé aux utilisateurs connectés
export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <Splash />;
  return user ? <Outlet /> : <Navigate to="/login" replace state={{ from: loc.pathname }} />;
}

// Accès réservé aux administrateurs (le serveur re-vérifie de toute façon)
export function AdminRoute() {
  const { user } = useAuth();
  return user?.role === 'admin' ? <Outlet /> : <Navigate to="/chat" replace />;
}

export function UserRoute() {
  const { user } = useAuth();
  return user?.role === 'user' ? <Outlet /> : <Navigate to="/admin" replace />;
}

// Login / Register : inaccessibles une fois connecté
export function GuestRoute() {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  return user ? <Navigate to={user.role === 'admin' ? '/admin' : '/chat'} replace /> : <Outlet />;
}
