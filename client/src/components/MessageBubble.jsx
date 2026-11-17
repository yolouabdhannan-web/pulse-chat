import { useState } from 'react';
import { motion } from 'framer-motion';
import { Archive, Check, CheckCheck, Download, FileSpreadsheet, FileText, Flag, Play } from 'lucide-react';
import { api } from '../lib/api.js';
import { fmtSize, fmtTime } from '../lib/utils.js';
import MessageReactions from './MessageReactions.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const fileIcon = (mime = '') => (mime.includes('pdf') ? [FileText, 'from-emerald-700 to-emerald-600'] : mime.includes('sheet') ? [FileSpreadsheet, 'from-emerald-700 to-emerald-600'] : mime.includes('zip') ? [Archive, 'from-emerald-700 to-emerald-600'] : [FileText, 'from-emerald-700 to-emerald-600']);

function FileCard({ file }) {
  const [Icon, grad] = fileIcon(file.mime);
  return (
    <a href={file.url} target="_blank" rel="noreferrer" download={file.name} className="flex w-64 max-w-full items-center gap-3 rounded-xl bg-emerald-900/10 p-3 transition hover:bg-emerald-900/15">
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${grad} text-white`}><Icon size={22} /></span>
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{file.name}</span><span className="text-xs opacity-70">{fmtSize(file.size)}</span></span>
      <Download size={18} className="shrink-0 opacity-70" />
    </a>
  );
}

export default function MessageBubble({ msg, mine, showName, first, onOpen, onReact }) {
  const { preferences } = useAuth();
  const [reported, setReported] = useState(false);
  const read = msg.readBy.some((id) => id !== msg.sender.id);
  const textSize = preferences.textSize === 'small' ? 'text-sm' : preferences.textSize === 'large' ? 'text-lg' : 'text-[15px]';

  async function report() {
    try { await api.post(`/messages/${msg.id}/report`, {}); setReported(true); } catch { /* ignoré */ }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', damping: 24, stiffness: 320 }}
      className={`group flex ${mine ? 'justify-end' : 'justify-start'} ${first ? (preferences.compactMessages ? 'mt-1.5' : 'mt-3') : (preferences.compactMessages ? 'mt-0' : 'mt-0.5')}`}>
      <div className={`relative flex max-w-[85%] items-end gap-1.5 pb-2 sm:max-w-[70%] ${mine ? 'flex-row-reverse' : ''}`}>
        <div className={`min-w-0 rounded-2xl border px-3.5 py-2 ${mine ? 'rounded-br-md border-emerald-800 bg-emerald-800 text-white shadow-glow' : 'rounded-bl-md border-emerald-200 bg-emerald-50 text-emerald-950 shadow-sm'} ${msg.deleted ? 'italic opacity-60' : ''}`}>
          {showName && <p className="mb-0.5 text-xs font-semibold text-emerald-800">{msg.sender.username}</p>}

          {msg.deleted ? <p className="text-sm">Message supprimé par la modération</p> : (
            <>
              {msg.type === 'image' && msg.file && (
                <button onClick={() => onOpen({ type: 'image', ...msg.file })} className="-mx-1.5 -mt-0.5 mb-1 block overflow-hidden rounded-xl">
                  <img src={msg.file.url} alt={msg.file.name} loading="lazy" className="max-h-72 w-full object-cover transition duration-300 hover:scale-[1.03]" />
                </button>
              )}
              {msg.type === 'video' && msg.file && (
                <div className="relative -mx-1.5 -mt-0.5 mb-1 overflow-hidden rounded-xl">
                  <video src={msg.file.url} controls preload="metadata" className="max-h-72 w-full bg-emerald-950" />
                  <button onClick={() => onOpen({ type: 'video', ...msg.file })} aria-label="Plein écran" className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg bg-emerald-950/70 text-white backdrop-blur"><Play size={14} /></button>
                </div>
              )}
              {msg.type === 'audio' && msg.file && (
                <div className="mb-1 w-full min-w-0 max-w-full">
                  <audio src={msg.file.url} controls preload="metadata" className="w-full max-w-full accent-emerald-700" aria-label="Message vocal" />
                </div>
              )}
              {msg.type === 'file' && msg.file && <div className="mb-1"><FileCard file={msg.file} /></div>}
              {msg.text && <p className={`whitespace-pre-wrap break-words leading-relaxed ${textSize}`}>{msg.text}</p>}
            </>
          )}

          <div className={`mt-0.5 flex items-center justify-end gap-1 text-[11px] ${mine ? 'text-white/80' : 'text-emerald-900/75'}`}>
            {fmtTime(msg.createdAt)}
            {mine && !msg.deleted && (read ? <CheckCheck size={14} className="text-emerald-200" aria-label="Lu" /> : <Check size={14} aria-label="Envoyé" />)}
          </div>
        </div>
        {!msg.deleted && <MessageReactions messageId={msg.id} reactions={msg.reactions} onReact={onReact} mine={mine} />}
        {!mine && !msg.deleted && (
          <button onClick={report} disabled={reported} title={reported ? 'Signalé' : 'Signaler'} aria-label="Signaler ce message"
            className="mb-1 rounded-lg p-1.5 text-slate-600 opacity-0 transition hover:text-emerald-700 focus:opacity-100 group-hover:opacity-100 disabled:text-emerald-700 disabled:opacity-100">
            <Flag size={14} />
          </button>
        )}
      </div>
    </motion.div>
  );
}
