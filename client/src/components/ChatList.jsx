import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, MessageCircle, Search, Settings, ShieldCheck, UserRoundPlus, UsersRound, X } from 'lucide-react';
import { useChat } from '../context/ChatContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api, errMsg } from '../lib/api.js';
import { chatMeta, fmtDay, preview } from '../lib/utils.js';
import Avatar from './Avatar.jsx';
import Stories from './Stories.jsx';

function NewChat({ onClose }) {
  const { openDm, online } = useChat();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      api.get('/chats/users', { params: { q } })
        .then((response) => { if (active) setUsers(response.data.users); })
        .catch((requestError) => { if (active) setError(errMsg(requestError, 'Chargement des utilisateurs impossible')); });
    }, 200);
    return () => { active = false; clearTimeout(timer); };
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
        {error && <p role="alert" className="mb-2 text-sm text-rose-400">{error}</p>}
        <ul className="max-h-[50dvh] space-y-1 overflow-y-auto">
          {users.map((u) => (
            <li key={u.id}>
              <button onClick={async () => { try { const id = await openDm(u.id); onClose(); nav(`/chat/${id}`); } catch (requestError) { setError(errMsg(requestError, 'Ouverture de la discussion impossible')); } }} className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition hover:bg-white/10">
                <Avatar name={u.username} color={u.color} size={40} online={online.has(u.id)} avatar={u.avatar} />
                <span className="font-medium">{u.username}</span>
              </button>
            </li>
          ))}
          {!users.length && !error && <li className="py-8 text-center text-sm text-slate-500">Aucun utilisateur trouvé</li>}
        </ul>
      </motion.div>
    </motion.div>
  );
}

function NewContact({ onClose, onAdded }) {
  const [identifier, setIdentifier] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await api.post('/chats/contacts', { identifier, name });
      onAdded();
    } catch (requestError) {
      setError(errMsg(requestError, 'Ajout du contact impossible'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 grid place-items-end bg-emerald-950/30 p-0 backdrop-blur-sm sm:place-items-center sm:p-4"
      onClick={onClose}>
      <motion.form onSubmit={submit} initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'spring', damping: 26, stiffness: 300 }}
        className="glass-strong w-full max-w-md rounded-t-3xl p-5 sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">Nouveau contact</h3>
            <p className="mt-1 text-sm text-slate-400">Saisissez l’identifiant de la personne avec qui vous voulez discuter.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10"><X size={18} /></button>
        </div>
        <label className="mb-3 block text-sm font-semibold">
          Identifiant
          <input autoFocus required maxLength={25} className="field mt-1.5" placeholder="@identifiant"
            value={identifier} onChange={(event) => setIdentifier(event.target.value)} />
        </label>
        <label className="block text-sm font-semibold">
          Nom du contact <span className="font-normal text-slate-400">(facultatif)</span>
          <input maxLength={60} className="field mt-1.5" placeholder="Ex. Maman, Paul du bureau"
            value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        {error && <p role="alert" className="mt-3 text-sm text-rose-400">{error}</p>}
        <button type="submit" disabled={busy || !identifier.trim()} className="btn-grad mt-5 w-full">
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </motion.form>
    </motion.div>
  );
}

export default function ChatList({ activeId }) {
  const { chats, online, messageError, openDm } = useChat();
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('chats');
  const [contacts, setContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsError, setContactsError] = useState('');
  const [reloadContacts, setReloadContacts] = useState(0);
  const [contactModal, setContactModal] = useState(false);
  const modal = params.get('new') === '1';
  const setModal = (on) => setParams(on ? { new: '1' } : {}, { replace: true });

  const list = chats.map((c) => ({ c, m: chatMeta(c, user) })).filter(({ m }) => m.name.toLowerCase().includes(q.toLowerCase()));
  const unreadCount = chats.reduce((count, chat) => count + chat.unread, 0);

  useEffect(() => {
    if (tab !== 'contacts') return undefined;
    let active = true;
    setContactsLoading(true);
    setContactsError('');
    const timer = setTimeout(() => {
      api.get('/chats/contacts', { params: { q } })
        .then((response) => { if (active) setContacts(response.data.contacts); })
        .catch((requestError) => { if (active) setContactsError(errMsg(requestError, 'Chargement des contacts impossible')); })
        .finally(() => { if (active) setContactsLoading(false); });
    }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [tab, q, reloadContacts]);

  async function startConversation(contactId) {
    setContactsError('');
    try {
      const id = await openDm(contactId);
      nav(`/chat/${id}`);
    } catch (requestError) {
      setContactsError(errMsg(requestError, 'Ouverture de la discussion impossible'));
    }
  }

  async function handleLogout() {
    await logout();
    nav('/login');
  }

  return (
    <>
      <header className="border-b border-white/10 px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-5 sm:pt-5">
        <div className="flex items-center gap-3">
          <Avatar name={user.username} color={user.color} size={42} avatar={user.avatar} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold">{user.username}</h1>
            <p className="truncate text-xs text-slate-400">@{user.username}</p>
          </div>
          <button onClick={() => setModal(true)} aria-label="Nouvelle discussion" title="Nouvelle discussion" className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-emerald-700"><UserRoundPlus size={19} /></button>
        </div>
        <div className="relative mt-4">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="field !rounded-full !border-0 !bg-white/10 !py-2.5 pl-10" placeholder={tab === 'chats' ? 'Rechercher une discussion' : 'Rechercher un contact'} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="mt-4 grid grid-cols-2 border-b border-white/10" role="tablist" aria-label="Afficher les discussions ou les contacts">
          <button role="tab" aria-selected={tab === 'chats'} onClick={() => { setTab('chats'); setQ(''); }} className={`flex items-center justify-center gap-2 border-b-2 pb-3 text-sm font-medium transition ${tab === 'chats' ? 'border-emerald-700 text-emerald-700' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
            <MessageCircle size={16} /> Discussions {unreadCount > 0 && <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-700">{unreadCount > 99 ? '99+' : unreadCount}</span>}
          </button>
          <button role="tab" aria-selected={tab === 'contacts'} onClick={() => { setTab('contacts'); setQ(''); }} className={`flex items-center justify-center gap-2 border-b-2 pb-3 text-sm font-medium transition ${tab === 'contacts' ? 'border-emerald-700 text-emerald-700' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
            <UsersRound size={16} /> Contacts
          </button>
        </div>
      </header>
      {messageError && <p role="alert" className="mx-4 mt-3 rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{messageError}</p>}
      {tab === 'chats' && <Stories currentUser={user} />}
      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-3 pt-2">
        {tab === 'chats' ? (
          <>
            <AnimatePresence initial={false}>
              {list.map(({ c, m }) => (
                <motion.li key={c.id} layout="position" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                  <Link to={`/chat/${c.id}`} className={`flex items-center gap-3 rounded-xl p-3 transition ${activeId === c.id ? 'bg-emerald-100' : 'hover:bg-white/5'}`}>
                    <Avatar name={m.name} color={m.color} online={m.group ? undefined : online.has(m.userId)} avatar={m.avatar} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-semibold">{m.name}</span>
                        {c.lastMessage && <span className="shrink-0 text-xs text-slate-400">{fmtDay(c.lastMessage.createdAt)}</span>}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`truncate text-sm ${c.unread ? 'font-semibold text-slate-200' : 'text-slate-400'}`}>
                          {c.lastMessage && c.lastMessage.sender.id === user.id ? 'Vous : ' : ''}{preview(c.lastMessage)}
                        </span>
                        {c.unread > 0 && <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-emerald-800 px-1.5 text-[11px] font-bold text-white">{c.unread > 99 ? '99+' : c.unread}</span>}
                      </div>
                    </div>
                  </Link>
                </motion.li>
              ))}
            </AnimatePresence>
            {!list.length && <li className="py-12 text-center text-sm text-slate-400">{q ? 'Aucune discussion trouvée' : 'Aucune discussion pour le moment'}</li>}
          </>
        ) : (
          <>
            <li>
              <button onClick={() => setContactModal(true)} className="flex w-full items-center gap-3 rounded-xl p-3 text-left font-semibold text-emerald-700 transition hover:bg-white/5">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-emerald-100"><UserRoundPlus size={19} /></span>
                Ajouter un contact
              </button>
            </li>
            {contactsLoading && <li className="py-12 text-center text-sm text-slate-400" role="status">Chargement des contacts…</li>}
            {contactsError && <li className="px-3 py-8 text-center text-sm text-rose-300"><p role="alert">{contactsError}</p><button onClick={() => setReloadContacts((key) => key + 1)} className="mt-3 font-semibold text-emerald-700 hover:text-emerald-800">Réessayer</button></li>}
            {!contactsLoading && !contactsError && contacts.map((contact) => (
              <li key={contact.id}>
                <button onClick={() => startConversation(contact.id)} className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-white/5">
                  <Avatar name={contact.username} color={contact.color} size={44} online={online.has(contact.id)} avatar={contact.avatar} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{contact.displayName || contact.username}</span>
                    <span className="block text-xs text-slate-400">@{contact.username} · {online.has(contact.id) ? 'En ligne' : contact.lastSeen ? `Vu ${fmtDay(contact.lastSeen)}` : 'Disponible'}</span>
                  </span>
                  <MessageCircle size={17} className="text-slate-400" />
                </button>
              </li>
            ))}
            {!contactsLoading && !contactsError && !contacts.length && <li className="py-8 text-center text-sm text-slate-400">{q ? 'Aucun contact trouvé' : 'Aucun contact enregistré'}</li>}
          </>
        )}
      </ul>
      <footer className="hidden items-center justify-between border-t border-white/10 px-3 py-3 lg:flex">
        <span className="truncate text-xs text-slate-500">HECM Connect</span>
        <div className="flex items-center gap-1">
          {user.role === 'admin' && <Link to="/admin" title="Administration" aria-label="Administration" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-emerald-700"><ShieldCheck size={17} /></Link>}
          <button onClick={handleLogout} title="Se déconnecter" aria-label="Se déconnecter" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-emerald-700"><LogOut size={17} /></button>
          <Link to="/settings" title="Paramètres" aria-label="Paramètres" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-emerald-700"><Settings size={17} /></Link>
        </div>
      </footer>
      <AnimatePresence>{modal && <NewChat onClose={() => setModal(false)} />}</AnimatePresence>
      <AnimatePresence>{contactModal && <NewContact onClose={() => setContactModal(false)} onAdded={() => {
        setContactModal(false);
        setQ('');
        setReloadContacts((key) => key + 1);
      }} />}</AnimatePresence>
    </>
  );
}
