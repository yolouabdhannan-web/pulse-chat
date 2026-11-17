import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Ban, Check, Flag, Image, KeyRound, LogOut, MessageSquare, ShieldCheck, ShieldOff, Trash2, Users, Wifi, X } from 'lucide-react';
import { api, errMsg } from '../lib/api.js';
import Avatar from '../components/Avatar.jsx';
import { fmtDay, fmtSize } from '../lib/utils.js';
import { useAuth } from '../context/AuthContext.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';

const TABS = [['overview', 'Vue d’ensemble'], ['users', 'Utilisateurs'], ['reports', 'Modération']];

function Stat({ icon: Icon, label, value, grad, i }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass relative overflow-hidden rounded-2xl p-5">
      <div className={`absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${grad} opacity-30 blur-2xl`} />
      <span className={`mb-4 grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br ${grad} text-white`}><Icon size={20} /></span>
      <p className="text-3xl font-extrabold tabular-nums">{value}</p>
      <p className="text-sm text-slate-400">{label}</p>
    </motion.div>
  );
}

function Overview({ stats }) {
  if (!stats) return null;
  const chartMax = Math.max(1, ...stats.days.map((day) => Math.max(day.messages, day.users)));
  const chartX = (index) => 38 + (index * 624) / Math.max(1, stats.days.length - 1);
  const chartY = (value) => 178 - (value / chartMax) * 144;
  const linePath = (metric) => stats.days.map((day, index) =>
    `${index === 0 ? 'M' : 'L'} ${chartX(index)} ${chartY(day[metric])}`,
  ).join(' ');
  const cards = [
    [Users, 'Utilisateurs', stats.users, 'from-emerald-700 to-emerald-600'],
    [Wifi, 'En ligne', stats.online, 'from-emerald-500 to-emerald-400'],
    [MessageSquare, 'Messages', stats.messages, 'from-emerald-700 to-emerald-600'],
    [Image, 'Médias partagés', stats.media, 'from-emerald-700 to-emerald-600'],
    [Flag, 'Signalements', stats.pendingReports, 'from-emerald-700 to-emerald-600'],
    [Ban, 'Comptes bloqués', stats.blocked, 'from-emerald-700 to-emerald-600'],
  ];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">{cards.map((c, i) => <Stat key={c[1]} i={i} icon={c[0]} label={c[1]} value={c[2]} grad={c[3]} />)}</div>
      <div className="glass rounded-2xl p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">Activité sur 7 jours</h3>
            <p className="text-xs text-slate-500">Évolution quotidienne des messages et des inscriptions</p>
          </div>
          <div className="flex gap-4 text-xs text-slate-600">
            <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-emerald-800" />Messages</span>
            <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-emerald-400" />Comptes créés</span>
          </div>
        </div>
        <div className="w-full overflow-hidden">
          <svg viewBox="0 0 700 220" role="img" aria-label="Courbe des messages et des créations de comptes sur les sept derniers jours" className="h-56 w-full overflow-visible">
            {[34, 106, 178].map((y) => (
              <line key={y} x1="30" x2="670" y1={y} y2={y} stroke="#dcebe0" strokeDasharray="4 6" />
            ))}
            <path d={linePath('messages')} fill="none" stroke="#166534" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <path d={linePath('users')} fill="none" stroke="#4ade80" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            {stats.days.map((day, index) => (
              <g key={day.date}>
                <circle cx={chartX(index)} cy={chartY(day.messages)} r="4" fill="white" stroke="#166534" strokeWidth="3">
                  <title>{`${day.date} : ${day.messages} messages`}</title>
                </circle>
                <circle cx={chartX(index)} cy={chartY(day.users)} r="4" fill="white" stroke="#4ade80" strokeWidth="3">
                  <title>{`${day.date} : ${day.users} comptes créés`}</title>
                </circle>
                <text x={chartX(index)} y="205" textAnchor="middle" fill="#647f6a" fontSize="12">
                  {new Date(`${day.date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short' })}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
}

function UsersTab({ me }) {
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');
  const [resetTarget, setResetTarget] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetBusy, setResetBusy] = useState(false);
  const load = useCallback(() => api.get('/admin/users', { params: { q } }).then((r) => setUsers(r.data.users)), [q]);
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);

  const patch = async (id, body) => {
    try { setErr(''); await api.patch(`/admin/users/${id}`, body); load(); } catch (e) { setErr(errMsg(e)); }
  };

  async function resetPassword(event) {
    event.preventDefault();
    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setResetError('8 caractères minimum, avec au moins une lettre et un chiffre.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setResetBusy(true);
    setResetError('');
    try {
      await api.patch(`/admin/users/${resetTarget.id}/password`, { password: newPassword });
      setResetTarget(null);
      setNewPassword('');
      setConfirmPassword('');
      setErr(`Mot de passe réinitialisé pour ${resetTarget.username}.`);
    } catch (error) {
      setResetError(errMsg(error, error.message));
    } finally {
      setResetBusy(false);
    }
  }

  return (
    <>
    <div className="glass overflow-hidden rounded-2xl">
      <div className="flex flex-wrap items-center gap-3 border-b border-white/10 p-4">
        <input className="field max-w-xs !py-2" placeholder="Rechercher un pseudo ou e-mail" value={q} onChange={(e) => setQ(e.target.value)} />
        {err && <span role="status" className="text-sm text-emerald-800">{err}</span>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs text-slate-400"><tr><th className="p-4 font-medium">Utilisateur</th><th className="font-medium">Rôle</th><th className="font-medium">Statut</th><th className="font-medium">Inscrit</th><th className="p-4 text-right font-medium">Actions</th></tr></thead>
          <tbody className="divide-y divide-white/5">
            {users.map((u) => (
              <tr key={u.id} className="transition hover:bg-emerald-50">
                <td className="p-4"><div className="flex items-center gap-3"><Avatar name={u.username} color={u.color} size={36} avatar={u.avatar} /><div><p className="font-semibold">{u.username}</p><p className="text-xs text-slate-500">{u.email}</p></div></div></td>
                <td><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">{u.role === 'admin' ? 'Admin' : 'Utilisateur'}</span></td>
                <td><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${u.blocked ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-50 text-emerald-700'}`}>{u.blocked ? 'Bloqué' : 'Actif'}</span></td>
                <td className="text-slate-400">{fmtDay(u.createdAt)}</td>
                <td className="p-4"><div className="flex justify-end gap-2">
                  {u.id !== me.id && <>
                    <button onClick={() => patch(u.id, { role: u.role === 'admin' ? 'user' : 'admin' })} className="btn-ghost !px-2.5 !py-1.5" title="Changer le rôle">{u.role === 'admin' ? <ShieldOff size={15} /> : <ShieldCheck size={15} />}</button>
                    <button onClick={() => patch(u.id, { blocked: !u.blocked })} className="btn-ghost !px-2.5 !py-1.5">{u.blocked ? <><Check size={15} />Débloquer</> : <><Ban size={15} />Bloquer</>}</button>
                    <button onClick={() => { setResetTarget(u); setNewPassword(''); setConfirmPassword(''); setResetError(''); }} className="btn-ghost !px-2.5 !py-1.5" title="Réinitialiser le mot de passe" aria-label={`Réinitialiser le mot de passe de ${u.username}`}><KeyRound size={15} /></button>
                  </>}
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    {resetTarget && <div className="fixed inset-0 z-[90] grid place-items-center bg-emerald-950/45 p-4" onClick={() => setResetTarget(null)}>
      <form onSubmit={resetPassword} className="glass w-full max-w-md rounded-2xl p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div><h2 className="text-lg font-bold text-emerald-950">Réinitialiser le mot de passe</h2><p className="mt-1 text-sm text-slate-600">Compte : {resetTarget.username}</p></div>
          <button type="button" onClick={() => setResetTarget(null)} aria-label="Fermer" className="rounded-lg p-2 text-slate-600 hover:bg-emerald-50"><X size={18} /></button>
        </div>
        <p className="mb-4 flex gap-2 rounded-xl bg-emerald-50 p-3 text-xs leading-5 text-emerald-950"><AlertCircle size={16} className="mt-0.5 shrink-0" />Le mot de passe actuel n’est pas consultable. Définissez un nouveau mot de passe et transmettez-le à l’utilisateur de façon sécurisée.</p>
        <label className="block text-sm font-semibold text-emerald-950">Nouveau mot de passe<input autoFocus type="password" autoComplete="new-password" className="field mt-1.5" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
        <label className="mt-4 block text-sm font-semibold text-emerald-950">Confirmer le mot de passe<input type="password" autoComplete="new-password" className="field mt-1.5" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
        <p className="mt-2 text-xs text-slate-600">8 caractères minimum, avec au moins une lettre et un chiffre.</p>
        {resetError && <p role="alert" className="mt-3 text-sm text-emerald-900">{resetError}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => setResetTarget(null)} className="btn-ghost">Annuler</button>
          <button type="submit" disabled={resetBusy || !newPassword || !confirmPassword} className="btn-grad">{resetBusy ? 'Enregistrement…' : 'Définir le nouveau mot de passe'}</button>
        </div>
      </form>
    </div>}
    </>
  );
}

function ReportsTab({ onChange }) {
  const [reports, setReports] = useState(null);
  const load = useCallback(() => api.get('/admin/reports').then((r) => setReports(r.data.reports)), []);
  useEffect(() => { load(); }, [load]);
  const act = async (id, action) => { await api.patch(`/admin/reports/${id}`, { action }); load(); onChange(); };

  if (!reports) return null;
  if (!reports.length) return <div className="glass grid place-items-center rounded-2xl p-14 text-center text-slate-400"><Check className="mb-3 text-emerald-400" size={32} />Aucun signalement en attente.</div>;
  return (
    <div className="space-y-3">
      {reports.map((r) => (
        <motion.div key={r.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass flex flex-col gap-4 rounded-2xl p-4 sm:flex-row sm:items-center">
          <Avatar name={r.message.sender.username} color={r.message.sender.color} size={44} />
          <div className="min-w-0 flex-1">
            <p className="text-sm"><span className="font-semibold">{r.message.sender.username}</span> <span className="text-slate-500">· signalé par {r.reporter} · {fmtDay(r.createdAt)}</span></p>
            <p className="mt-1 truncate text-slate-300">{r.message.type !== 'text' && r.message.file ? `Pièce jointe : ${r.message.file.name} (${fmtSize(r.message.file.size)}) ` : ''}{r.message.text}</p>
            {r.message.type === 'image' && r.message.file && <img src={r.message.file.url} alt="" className="mt-2 h-24 rounded-lg object-cover" />}
            <p className="mt-1 text-xs text-emerald-700">Motif : {r.reason}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => act(r.id, 'dismiss')} className="btn-ghost"><Check size={15} />Ignorer</button>
            <button onClick={() => act(r.id, 'remove')} className="btn-ghost"><Trash2 size={15} />Supprimer</button>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

export default function Admin() {
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const loadStats = useCallback(() => api.get('/admin/stats').then((r) => setStats(r.data)), []);
  useEffect(() => { loadStats(); }, [loadStats]);

  return (
    <div className="h-full overflow-y-auto px-3 py-4 sm:px-8 sm:py-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Administration</h1>
            <p className="text-sm text-slate-400">Connecté en tant que {user.username}</p>
          </div>
          <ThemeToggle />
          <button onClick={async () => { await logout(); navigate('/login'); }} className="btn-ghost shrink-0">
            <LogOut size={16} />Se déconnecter
          </button>
        </header>
        <p className="mb-6 text-sm text-slate-400">Pilotez la communauté, les comptes et les contenus signalés.</p>
        <div className="glass mb-6 flex w-full max-w-full overflow-x-auto rounded-2xl p-1 sm:inline-flex sm:w-auto">
          {TABS.map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} className={`relative shrink-0 rounded-xl px-3 py-2 text-sm font-semibold transition sm:px-4 ${tab === k ? 'text-white' : 'text-slate-600 hover:text-emerald-800'}`}>
              {tab === k && <motion.span layoutId="tab" className="absolute inset-0 rounded-xl bg-emerald-800 shadow-glow" />}
              <span className="relative">{label}{k === 'reports' && stats?.pendingReports > 0 && <b className="ml-1.5 rounded-full bg-emerald-700 px-1.5 text-[10px] text-white">{stats.pendingReports}</b>}</span>
            </button>
          ))}
        </div>
        {tab === 'overview' && <Overview stats={stats} />}
        {tab === 'users' && <UsersTab me={user} />}
        {tab === 'reports' && <ReportsTab onChange={loadStats} />}
      </div>
    </div>
  );
}
