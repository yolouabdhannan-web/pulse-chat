import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertCircle, Check, Eye, EyeOff, Lock, Mail, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { errMsg } from '../lib/api.js';

const rules = {
  username: (v) => (/^[a-zA-Z0-9_]{3,24}$/.test(v) ? '' : '3 à 24 caractères : lettres, chiffres, _'),
  email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? '' : 'Adresse e-mail invalide'),
  password: (v) => (v.length >= 8 && /[A-Za-z]/.test(v) && /\d/.test(v) ? '' : '8 caractères minimum, avec une lettre et un chiffre'),
};

function Field({ icon: Icon, label, error, valid, right, ...props }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-300">{label}</span>
      <div className="relative">
        <Icon size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input {...props} className={`field pl-11 pr-11 ${error ? '!border-emerald-700/60' : valid ? '!border-emerald-400/40' : ''}`} />
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
          {right || (valid && <Check size={18} className="text-emerald-400" />)}
        </div>
      </div>
      <p className={`mt-1 h-4 text-xs text-emerald-800 transition-opacity ${error ? 'opacity-100' : 'opacity-0'}`}>{error}</p>
    </label>
  );
}

export default function AuthPage({ mode }) {
  const isLogin = mode === 'login';
  const { login, register } = useAuth();
  const nav = useNavigate();
  const from = useLocation().state?.from || '/chat';
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [touched, setTouched] = useState({});
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const fields = isLogin ? ['email', 'password'] : ['username', 'email', 'password'];
  const errors = useMemo(() => Object.fromEntries(fields.map((f) => [f, isLogin && f === 'password' ? (form.password ? '' : 'Mot de passe requis') : rules[f](form[f])])), [form, isLogin]);
  const canSubmit = fields.every((f) => !errors[f]);
  const bind = (f) => ({
    value: form[f], error: touched[f] && errors[f], valid: form[f] && !errors[f] && !(isLogin && f === 'password'),
    onChange: (e) => setForm({ ...form, [f]: e.target.value }), onBlur: () => setTouched({ ...touched, [f]: true }),
  });

  async function submit(e) {
    e.preventDefault();
    if (!canSubmit || busy) return setTouched({ username: true, email: true, password: true });
    setBusy(true); setError('');
    try {
      const user = await (isLogin ? login(form.email, form.password) : register(form));
      nav(user.role === 'admin' ? '/admin' : from, { replace: true });
    } catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  }

  return (
    <div className="grid min-h-full place-items-center px-4 py-10">
      <motion.div initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className="glass w-full max-w-md rounded-3xl p-8 sm:p-10">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-800 shadow-glow">
            <svg viewBox="0 0 64 64" className="h-8 w-8"><path d="M10 34h11l6-16 8 28 6-14h13" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">{isLogin ? <>Bienvenue sur <span className="grad-text">HECM</span></> : <>Rejoignez <span className="grad-text">HECM</span></>}</h1>
          <p className="mt-2 text-sm text-slate-400">{isLogin ? 'Connectez-vous à la messagerie de votre université.' : 'Créez votre compte HECM pour échanger avec la communauté.'}</p>
        </div>

        <form onSubmit={submit} noValidate className="space-y-1">
          {!isLogin && <Field icon={User} label="Pseudo" autoComplete="username" placeholder="ex. alex_92" {...bind('username')} />}
          <Field icon={Mail} label="Adresse e-mail" type="email" autoComplete="email" placeholder="vous@exemple.com" {...bind('email')} />
          <Field icon={Lock} label="Mot de passe" type={show ? 'text' : 'password'} autoComplete={isLogin ? 'current-password' : 'new-password'} placeholder="••••••••" {...bind('password')}
            right={<button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Masquer' : 'Afficher'} className="text-slate-400 hover:text-emerald-800">{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>} />

          {error && <div role="alert" className="mb-3 flex items-center gap-2 rounded-xl border border-emerald-700/20 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"><AlertCircle size={16} />{error}</div>}

          <button className="btn-grad w-full" disabled={busy}>{busy ? 'Un instant…' : isLogin ? 'Se connecter' : 'Créer mon compte'}</button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          {isLogin ? 'Pas encore de compte ?' : 'Déjà inscrit ?'}{' '}
          <Link to={isLogin ? '/register' : '/login'} className="font-semibold text-emerald-700 hover:text-emerald-900">{isLogin ? 'S’inscrire' : 'Se connecter'}</Link>
        </p>
      </motion.div>
    </div>
  );
}
