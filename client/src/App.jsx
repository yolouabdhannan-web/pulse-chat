import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminRoute, GuestRoute, ProtectedRoute, UserRoute } from './routes/guards.jsx';
import Aurora from './components/Aurora.jsx';
import AuthPage from './pages/AuthPage.jsx';
import ChatShell from './pages/ChatShell.jsx';
import ChatPage from './pages/ChatPage.jsx';
import Admin from './pages/Admin.jsx';
import Home from './pages/Home.jsx';
import SettingsPage from './pages/Settings.jsx';
import { useAuth } from './context/AuthContext.jsx';

export default function App() {
  const { preferences } = useAuth();

  return (
    <div className={`theme-root min-h-full ${preferences.theme === 'dark' ? 'theme-dark' : ''}`}>
      <Aurora />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<Admin />} />
          </Route>
          <Route element={<UserRoute />}>
            <Route element={<ChatShell />}>
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/chat/:id" element={<ChatPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/chat" replace />} />
      </Routes>
    </div>
  );
}
