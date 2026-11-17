import { NavLink, Outlet, useMatch, useNavigate } from 'react-router-dom';
import { LogOut, MessageSquare, Settings, ShieldCheck, UserPlus } from 'lucide-react';
import { ChatProvider, useChat } from '../context/ChatContext.jsx';
import { CallProvider } from '../context/CallContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import Avatar from '../components/Avatar.jsx';

const linkCls = ({ isActive }) =>
  `relative grid h-12 w-12 place-items-center rounded-2xl transition ${isActive ? 'bg-emerald-800 text-white shadow-glow' : 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-800'}`;

function Unread() {
  const { chats } = useChat();
  const n = chats.reduce((s, c) => s + c.unread, 0);
  return n ? <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-emerald-800 px-1 text-[10px] font-bold text-white">{n > 99 ? '99+' : n}</span> : null;
}

function Shell() {
  const { user, logout } = useAuth();
  const inChat = useMatch('/chat/:id');
  const onChatPage = useMatch('/chat');
  const nav = useNavigate();
  const handleLogout = async () => {
    await logout();
    nav('/login');
  };

  return (
    <div className="chat-theme flex h-[100dvh] min-h-0 flex-col overflow-hidden lg:flex-row">
      {!onChatPage && !inChat && <nav className="glass-strong hidden w-[76px] shrink-0 flex-col items-center gap-3 border-y-0 border-l-0 py-5 lg:flex">
        <img src="/favicon.svg" alt="HECM" title="HECM" className="mb-4 h-11 w-11" />
        <NavLink to="/chat" className={linkCls} title="Discussions"><MessageSquare size={22} /><Unread /></NavLink>
        <NavLink to="/chat?new=1" className={linkCls} title="Nouvelle discussion"><UserPlus size={22} /></NavLink>
        {user.role === 'admin' && <NavLink to="/admin" className={linkCls} title="Administration"><ShieldCheck size={22} /></NavLink>}
        <div className="mt-auto flex flex-col items-center gap-3">
          <Avatar name={user.username} color={user.color} size={42} avatar={user.avatar} />
          <button onClick={handleLogout} title="Se déconnecter" className="grid h-11 w-11 place-items-center rounded-2xl text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-800"><LogOut size={20} /></button>
          <NavLink to="/settings" className={linkCls} title="Paramètres"><Settings size={22} /></NavLink>
        </div>
      </nav>}

      <main className="min-h-0 min-w-0 flex-1 bg-[#f5f8f5]"><Outlet /></main>

      {/* Mobile & tablette : barre en bas, masquée dans une conversation sur mobile */}
      <nav className={`glass-strong z-20 ${inChat ? 'hidden' : 'flex'} shrink-0 items-center justify-around border-x-0 border-b-0 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 lg:hidden`}>
        <NavLink to="/chat" end className={linkCls}><MessageSquare size={22} /><Unread /></NavLink>
        <NavLink to="/chat?new=1" className={linkCls}><UserPlus size={22} /></NavLink>
        <button onClick={handleLogout} aria-label="Se déconnecter" className="grid h-12 w-12 place-items-center rounded-2xl text-slate-400 hover:bg-emerald-50 hover:text-emerald-800"><LogOut size={22} /></button>
        <NavLink to="/settings" className={linkCls} aria-label="Paramètres"><Settings size={22} /></NavLink>
        {user.role === 'admin' && <NavLink to="/admin" className={linkCls}><ShieldCheck size={22} /></NavLink>}
      </nav>
    </div>
  );
}

export default function ChatShell() {
  return <ChatProvider><CallProvider><Shell /></CallProvider></ChatProvider>;
}
