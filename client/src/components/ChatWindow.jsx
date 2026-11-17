import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useChat } from '../context/ChatContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCalls } from '../context/CallContext.jsx';
import { chatMeta, fmtDay } from '../lib/utils.js';
import Avatar from './Avatar.jsx';
import MessageBubble from './MessageBubble.jsx';
import Composer from './Composer.jsx';
import MediaViewer from './MediaViewer.jsx';

export default function ChatWindow({ id }) {
  const { chats, messages, online, typing, messageError, connected, setActive, react } = useChat();
  const { user } = useAuth();
  const { call, startCall } = useCalls();
  const nav = useNavigate();
  const [viewer, setViewer] = useState(null);
  const [callError, setCallError] = useState('');
  const bottom = useRef(null);

  const chat = chats.find((c) => c.id === id);
  const list = messages[id];
  const meta = chat && chatMeta(chat, user);
  const typers = Object.values(typing[id] || {});

  useEffect(() => { setActive(id); return () => setActive(null); }, [id, setActive]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [list?.length, typers.length]);

  const rows = useMemo(() => {
    let lastDay = '';
    return (list || []).map((m, i, arr) => {
      const day = new Date(m.createdAt).toDateString();
      const sep = day !== lastDay ? new Date(m.createdAt).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : null;
      lastDay = day;
      return { m, sep, first: arr[i - 1]?.sender.id !== m.sender.id || !!sep };
    });
  }, [list]);

  if (!chat) return <div className="grid h-full place-items-center text-slate-500">Chargement…</div>;
  const isOnline = !meta.group && online.has(meta.userId);

  return (
    <>
      <header className="glass-strong flex items-center gap-2 border-x-0 border-t-0 px-3 py-3 sm:gap-3 sm:px-5">
        <button onClick={() => nav('/chat')} aria-label="Retour" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-600 hover:bg-white/10 lg:hidden"><ArrowLeft size={20} /></button>
        <Avatar name={meta.name} color={meta.color} size={42} online={meta.group ? undefined : isOnline} avatar={meta.avatar} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-bold leading-tight">{meta.name}</h2>
          <p className={`truncate text-xs ${typers.length || isOnline ? 'text-emerald-700' : 'text-slate-600'}`}>
            {typers.length ? `${typers.join(', ')} écrit…` : meta.group ? `${chat.members.length} membres` : isOnline ? 'En ligne' : `Vu ${fmtDay(chat.members.find((m) => m.id === meta.userId)?.lastSeen)}`}
          </p>
        </div>
        {!meta.group && (
          <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
            <button
              onClick={async () => { setCallError(''); try { await startCall(id, meta.userId, meta.name, 'audio'); } catch (error) { setCallError(error.message); } }}
              disabled={!!call || !connected}
              aria-label={`Appel vocal avec ${meta.name}`}
              title="Appel vocal"
              className="rounded-xl px-2 py-2 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-50 disabled:opacity-40 sm:px-3 sm:text-sm"
            >Vocal</button>
            <button
              onClick={async () => { setCallError(''); try { await startCall(id, meta.userId, meta.name, 'video'); } catch (error) { setCallError(error.message); } }}
              disabled={!!call || !connected}
              aria-label={`Appel vidéo avec ${meta.name}`}
              title="Appel vidéo"
              className="rounded-xl px-2 py-2 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-50 disabled:opacity-40 sm:px-3 sm:text-sm"
            >Vidéo</button>
          </div>
        )}
      </header>
      {callError && <p role="alert" className="border-b border-emerald-700/15 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">{callError}</p>}
      {messageError && <p role="alert" className="border-b border-emerald-700/15 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">{messageError}</p>}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-3 sm:px-6 sm:py-4">
        {rows.map(({ m, sep, first }) => (
          <div key={m.id}>
            {sep && <div className="my-4 flex justify-center"><span className="glass rounded-full px-3 py-1 text-xs capitalize text-slate-400">{sep}</span></div>}
            <MessageBubble msg={m} mine={m.sender.id === user.id} showName={chat.isGroup && first && m.sender.id !== user.id} first={first} onOpen={setViewer} onReact={react} />
          </div>
        ))}
        {typers.length > 0 && (
          <div className="glass mt-2 inline-flex items-center gap-1 rounded-2xl rounded-bl-md px-4 py-3" aria-label="écrit un message">
            {[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 animate-dot rounded-full bg-slate-300" style={{ animationDelay: `${i * 0.18}s` }} />)}
          </div>
        )}
        <div ref={bottom} />
      </div>

      <Composer conversationId={id} />
      <AnimatePresence>{viewer && <MediaViewer media={viewer} onClose={() => setViewer(null)} />}</AnimatePresence>
    </>
  );
}
