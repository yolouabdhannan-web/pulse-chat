import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { socket } from '../lib/socket.js';
import { useAuth } from './AuthContext.jsx';

const Ctx = createContext(null);
export const useChat = () => useContext(Ctx);

export function ChatProvider({ children }) {
  const { user, preferences } = useAuth();
  const [chats, setChats] = useState([]);
  const [messages, setMessages] = useState({});
  const [online, setOnline] = useState(new Set());
  const [typing, setTyping] = useState({});
  const [connected, setConnected] = useState(false);
  const [messageError, setMessageError] = useState('');
  const active = useRef(null);
  const timers = useRef({});
  const ready = useRef(false);

  const refresh = useCallback(async () => {
    try {
      setChats((await api.get('/chats')).data.chats);
    } catch {
      setMessageError('Impossible de charger les discussions. Vérifiez la connexion au serveur.');
    }
  }, []);

  const markRead = useCallback((id) => {
    if (!ready.current) return;
    socket.emit('message:read', { conversationId: id });
    setChats((p) => p.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
  }, []);

  useEffect(() => {
    const h = {
      connect: () => setConnected(false),
      disconnect: () => { ready.current = false; setConnected(false); },
      connect_error: () => {
        ready.current = false;
        setConnected(false);
        setMessageError('Impossible de connecter la messagerie temps réel. Vérifiez votre connexion et réessayez.');
      },
      'session:ready': () => {
        ready.current = true;
        setConnected(true);
        refresh();
        if (active.current) markRead(active.current);
      },
      'presence:list': (ids) => setOnline(new Set(ids)),
      'presence:update': ({ userId, online: on }) =>
        setOnline((p) => { const n = new Set(p); on ? n.add(userId) : n.delete(userId); return n; }),
      'chat:new': refresh,
      'message:new': (msg) => {
        const cid = msg.conversation;
        setMessages((p) => ({ ...p, [cid]: [...(p[cid] || []).filter((m) => m.id !== msg.id), msg] }));
        setChats((p) => {
          if (!p.some((c) => c.id === cid)) { refresh(); return p; }
          const mine = msg.sender.id === user.id;
          return p.map((c) => c.id === cid
            ? { ...c, lastMessage: msg, updatedAt: msg.createdAt, unread: mine || active.current === cid ? c.unread : c.unread + 1 }
            : c).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        });
        if (msg.sender.id !== user.id && active.current !== cid
          && typeof Notification !== 'undefined'
          && preferences.desktopNotifications && Notification.permission === 'granted'
          && document.visibilityState === 'hidden') {
          const notification = new Notification(msg.sender.username, {
            body: msg.text || (msg.type === 'image' ? 'Photo' : msg.type === 'video' ? 'Vidéo' : msg.type === 'audio' ? 'Message vocal' : 'Fichier partagé'),
            icon: '/favicon.svg',
            tag: `hecm-${cid}`,
          });
          notification.onclick = () => {
            window.focus();
            window.location.assign(`/chat/${cid}`);
            notification.close();
          };
        }
        if (active.current === cid && msg.sender.id !== user.id) markRead(cid);
        setTyping((p) => ({ ...p, [cid]: Object.fromEntries(Object.entries(p[cid] || {}).filter(([id]) => id !== msg.sender.id)) }));
      },
      'message:read': ({ conversationId, userId }) =>
        setMessages((p) => p[conversationId] ? { ...p, [conversationId]: p[conversationId].map((m) => m.readBy.includes(userId) ? m : { ...m, readBy: [...m.readBy, userId] }) } : p),
      'message:reactions': ({ messageId, reactions }) => {
        const apply = (message) => message.id === messageId
          ? { ...message, reactions: reactions.map((reaction) => ({ ...reaction, mine: reaction.userId === user.id })) }
          : message;
        setMessages((p) => Object.fromEntries(
          Object.entries(p).map(([id, list]) => [id, list.map(apply)]),
        ));
        setChats((p) => p.map((chat) => chat.lastMessage?.id === messageId
          ? { ...chat, lastMessage: apply(chat.lastMessage) }
          : chat));
      },
      'message:deleted': ({ id, conversation }) => {
        const wipe = (m) => (m.id === id ? { ...m, deleted: true, text: '', file: null } : m);
        setMessages((p) => p[conversation] ? { ...p, [conversation]: p[conversation].map(wipe) } : p);
        setChats((p) => p.map((c) => (c.lastMessage?.id === id ? { ...c, lastMessage: wipe(c.lastMessage) } : c)));
      },
      typing: ({ conversationId, userId, username, typing: on }) => {
        const key = conversationId + userId;
        clearTimeout(timers.current[key]);
        const set = (val) => setTyping((p) => {
          const cur = { ...(p[conversationId] || {}) };
          val ? (cur[userId] = username) : delete cur[userId];
          return { ...p, [conversationId]: cur };
        });
        set(on);
        if (on) timers.current[key] = setTimeout(() => set(false), 4000);
      },
    };
    Object.entries(h).forEach(([e, f]) => socket.on(e, f));
    refresh();
    socket.connect();
    return () => Object.entries(h).forEach(([e, f]) => socket.off(e, f));
  }, [user.id, refresh, markRead, preferences.desktopNotifications]);

  const loadMessages = useCallback(async (id) => {
    const { data } = await api.get(`/chats/${id}/messages`);
    setMessages((previous) => {
      const merged = new Map((data.messages || []).map((message) => [message.id, message]));
      for (const message of previous[id] || []) merged.set(message.id, message);
      return {
        ...previous,
        [id]: [...merged.values()].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
      };
    });
  }, []);

  const setActive = useCallback((id) => {
    active.current = id;
    setMessageError('');
    if (id) {
      loadMessages(id)
        .then(() => { if (active.current === id) markRead(id); })
        .catch(() => {
          if (active.current === id) setMessageError('Impossible de charger les messages. Réessayez dans un instant.');
        });
    }
  }, [loadMessages, markRead]);

  const send = useCallback((payload) => new Promise((resolve, reject) => {
    if (!ready.current || !socket.connected) {
      reject(new Error('La messagerie n’est pas encore connectée. Réessayez dans un instant.'));
      return;
    }
    socket.timeout(8000).emit('message:send', payload, (err, res) =>
      (err || !res?.ok ? reject(new Error(res?.error || 'Envoi impossible')) : resolve()));
  }), []);

  const react = useCallback((messageId, emoji) => new Promise((resolve, reject) =>
    socket.timeout(8000).emit('message:react', { messageId, emoji }, (err, res) =>
      (err || !res?.ok ? reject(new Error(res?.error || 'Réaction impossible')) : resolve()))), []);

  const typingPing = useCallback((conversationId, on) => socket.emit('typing', { conversationId, typing: on }), []);

  const openDm = useCallback(async (userId) => {
    const { data } = await api.post('/chats', { userId });
    setChats((p) => (p.some((c) => c.id === data.chat.id) ? p : [data.chat, ...p]));
    return data.chat.id;
  }, []);

  const value = useMemo(() => ({ chats, messages, online, typing, connected, messageError, setActive, send, react, typingPing, openDm, refresh }), [chats, messages, online, typing, connected, messageError, setActive, send, react, typingPing, openDm, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
