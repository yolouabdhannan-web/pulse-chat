import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { socket } from '../lib/socket.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export const DEFAULT_PREFERENCES = {
  sendOnEnter: true,
  compactMessages: false,
  textSize: 'normal',
  desktopNotifications: false,
  reduceMotion: false,
  theme: 'light',
};

function readPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem('hecm-preferences') || '{}');
    return {
      ...DEFAULT_PREFERENCES,
      ...saved,
      sendOnEnter: saved.sendOnEnter !== false,
      compactMessages: saved.compactMessages === true,
      desktopNotifications: saved.desktopNotifications === true,
      reduceMotion: saved.reduceMotion === true,
      theme: ['light', 'dark'].includes(saved.theme) ? saved.theme : 'light',
      textSize: ['small', 'normal', 'large'].includes(saved.textSize) ? saved.textSize : 'normal',
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState(readPreferences);

  useEffect(() => {
    api.get('/auth/me').then((r) => setUser(r.data.user)).catch(() => setUser(null)).finally(() => setLoading(false));
    // Session expirée ou compte bloqué : retour automatique à la connexion.
    const id = api.interceptors.response.use(
      (r) => r,
      (e) => {
        if (e.response?.status === 401 && !e.config.url.startsWith('/auth/')) setUser(null);
        return Promise.reject(e);
      }
    );
    return () => api.interceptors.response.eject(id);
  }, []);

  useEffect(() => {
    localStorage.setItem('hecm-preferences', JSON.stringify(preferences));
    document.documentElement.dataset.reduceMotion = String(preferences.reduceMotion);
    document.documentElement.dataset.theme = preferences.theme;
  }, [preferences]);

  const value = useMemo(() => ({
    user, loading, preferences,
    updatePreference: (key, nextValue) => setPreferences((current) => ({ ...current, [key]: nextValue })),
    updateUser: (nextUser) => setUser(nextUser),
    login: async (email, password) => {
      const { data } = await api.post('/auth/login', { email, password });
      setUser(data.user);
      return data.user;
    },
    register: async (body) => {
      const { data } = await api.post('/auth/register', body);
      setUser(data.user);
      return data.user;
    },
    logout: async () => { await api.post('/auth/logout'); socket.disconnect(); setUser(null); },
  }), [user, loading, preferences]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
