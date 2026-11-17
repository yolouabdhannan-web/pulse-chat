import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, UsersRound, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api, errMsg } from '../lib/api.js';
import { useChat } from '../context/ChatContext.jsx';
import Avatar from './Avatar.jsx';

export default function GroupModal({ onClose }) {
  const { refresh } = useChat();
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      api.get('/chats/users', { params: { q: query } })
        .then((response) => { if (active) setUsers(response.data.users); })
        .catch((requestError) => { if (active) setError(errMsg(requestError, 'Chargement des utilisateurs impossible')); });
    }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [query]);

  const toggleMember = (id) => {
    setSelected((previous) => previous.includes(id)
      ? previous.filter((member) => member !== id)
      : [...previous, id]);
  };

  async function createGroup(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post('/chats/groups', { name, userIds: selected });
      await refresh();
      onClose();
      nav(`/chat/${data.chat.id}`);
    } catch (requestError) {
      setError(errMsg(requestError, 'Création du groupe impossible'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 grid place-items-end overflow-y-auto bg-emerald-950/30 p-0 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm sm:place-items-center sm:p-4"
        onClick={onClose}>
        <motion.form onSubmit={createGroup} initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
          transition={{ type: 'spring', damping: 26, stiffness: 300 }}
          className="glass-strong max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl p-5 sm:rounded-3xl"
          onClick={(event) => event.stopPropagation()}>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-100 text-emerald-800"><UsersRound size={19} /></span>
              <h3 className="text-lg font-bold">Créer un groupe</h3>
            </div>
            <button type="button" onClick={onClose} aria-label="Fermer" className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10"><X size={18} /></button>
          </div>
          <input autoFocus maxLength={60} className="field mb-3" placeholder="Nom du groupe" value={name} onChange={(event) => setName(event.target.value)} />
          <input className="field mb-3" placeholder="Rechercher des membres…" value={query} onChange={(event) => setQuery(event.target.value)} />
          <ul className="max-h-[36dvh] space-y-1 overflow-y-auto">
            {users.map((person) => {
              const checked = selected.includes(person.id);
              return (
                <li key={person.id}>
                  <label className={`flex cursor-pointer items-center gap-3 rounded-xl p-2.5 transition ${checked ? 'bg-emerald-100' : 'hover:bg-white/10'}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggleMember(person.id)} className="accent-emerald-700" />
                    <Avatar name={person.username} color={person.color} size={38} />
                    <span className="font-medium">{person.username}</span>
                  </label>
                </li>
              );
            })}
            {!users.length && <li className="py-6 text-center text-sm text-slate-500">Aucun utilisateur trouvé</li>}
          </ul>
          {error && <p role="alert" className="mt-3 flex items-center gap-2 text-sm text-emerald-800"><AlertCircle size={16} />{error}</p>}
          <button type="submit" disabled={busy || name.trim().length < 2 || !selected.length} className="btn-grad mt-4 w-full">
            {busy ? 'Création…' : `Créer le groupe${selected.length ? ` · ${selected.length + 1} membres` : ''}`}
          </button>
        </motion.form>
      </motion.div>
    </AnimatePresence>
  );
}
