import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Search, UsersRound, X } from 'lucide-react';
import { useChat } from '../context/ChatContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';
import { chatMeta, fmtDay, preview } from '../lib/utils.js';
import Avatar from './Avatar.jsx';
import GroupModal from './GroupModal.jsx';
import Stories from './Stories.jsx';

function NewChat({ onClose }) {
  const { openDm, online } = useChat();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const t = setTimeout(() => api.get('/chats/users', { params: { q } }).then((r) => setUsers(r.data.users)), 200);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 grid place-items-end bg-emerald-950/30 p-0 backdrop-blur-sm sm:place-items-center sm:p-4" onClick={onClose}>
      <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ type: 'spring', damping: 26, stiffness: 300 }}
        className="glass-strong w-full max-w-md rounded-t-3xl p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">Nouvelle discussion</h3>
          <button onClick={onClose} aria-label="Fermer" className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10"><X size={18} /></button>
        </div>
        <input autoFocus className="field mb-3" placeholder="Rechercher un pseudo…" value={q} onChange={(e) => setQ(e.target.value)} />
        <ul className="max-h-[50dvh] space-y-1 overflow-y-auto">
          {users.map((u) => (
            <li key={u.id}>
              <button onClick={async () => { const id = await openDm(u.id); onClose(); nav(`/chat/${id}`); }} className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition hover:bg-white/10">
                <Avatar name={u.username} color={u.color} size={40} online={online.has(u.id)} avatar={u.avatar} />
                <span className="font-medium">{u.username}</span>
              </button>
            </li>
          ))}
          {!users.length && <li className="py-8 text-center text-sm text-slate-500">Aucun utilisateur trouvé</li>}
        </ul>
      </motion.div>
    </motion.div>
  );
}

export default function ChatList({ activeId }) {
  const { chats, online, messageError } = useChat();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [groupModal, setGroupModal] = useState(false);
  const modal = params.get('new') === '1';
  const setModal = (on) => setParams(on ? { new: '1' } : {}, { replace: true });

  const list = chats.map((c) => ({ c, m: chatMeta(c, user) })).filter(({ m }) => m.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <header className="flex items-center justify-between px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] sm:px-5 sm:pt-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">HECM</p>
          <h1 className="text-2xl font-extrabold tracking-tight">Discussions</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setGroupModal(true)} aria-label="Créer un groupe" title="Créer un groupe" className="grid h-10 w-10 place-items-center rounded-xl border border-emerald-900/10 bg-emerald-50 text-emerald-800 transition hover:bg-emerald-100"><UsersRound size={19} /></button>
          <button onClick={() => setModal(true)} aria-label="Nouvelle discussion" title="Nouvelle discussion" className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-800 text-white shadow-glow transition hover:bg-emerald-700 active:scale-95"><Plus size={20} /></button>
        </div>
      </header>
      {messageError && <p role="alert" className="mx-4 mb-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{messageError}</p>}
      <Stories currentUser={user} />
      <div className="px-4 pb-3">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input className="field !py-2.5 pl-10" placeholder="Rechercher" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-3">
        <AnimatePresence initial={false}>
          {list.map(({ c, m }) => (
            <motion.li key={c.id} layout="position" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <Link to={`/chat/${c.id}`} className={`flex items-center gap-3 rounded-2xl p-3 transition ${activeId === c.id ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'hover:bg-emerald-50'}`}>
                <Avatar name={m.name} color={m.color} online={m.group ? undefined : online.has(m.userId)} avatar={m.avatar} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-semibold">{m.name}</span>
                    {c.lastMessage && <span className="shrink-0 text-xs text-slate-500">{fmtDay(c.lastMessage.createdAt)}</span>}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`truncate text-sm ${c.unread ? 'font-semibold text-emerald-950' : 'text-slate-600'}`}>
                      {c.lastMessage && c.lastMessage.sender.id === user.id ? 'Vous : ' : ''}{preview(c.lastMessage)}
                    </span>
                    {c.unread > 0 && <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-emerald-800 px-1.5 text-[11px] font-bold text-white">{c.unread}</span>}
                  </div>
                </div>
              </Link>
            </motion.li>
          ))}
        </AnimatePresence>
        {!list.length && <li className="py-12 text-center text-sm text-slate-500">Aucune discussion</li>}
      </ul>
      <AnimatePresence>{modal && <NewChat onClose={() => setModal(false)} />}</AnimatePresence>
      <AnimatePresence>{groupModal && <GroupModal onClose={() => setGroupModal(false)} />}</AnimatePresence>
    </>
  );
}
