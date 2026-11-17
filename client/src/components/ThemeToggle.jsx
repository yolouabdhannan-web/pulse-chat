import { Moon, Sun } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function ThemeToggle({ className = '' }) {
  const { preferences, updatePreference } = useAuth();
  const dark = preferences.theme === 'dark';

  return (
    <button
      type="button"
      onClick={() => updatePreference('theme', dark ? 'light' : 'dark')}
      aria-label={`Activer le thème ${dark ? 'clair' : 'sombre'}`}
      aria-pressed={dark}
      title={`Thème ${dark ? 'clair' : 'sombre'}`}
      className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-emerald-900/10 bg-white text-emerald-800 transition hover:bg-emerald-50 ${className}`}
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
