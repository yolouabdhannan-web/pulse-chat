import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Mic, Paperclip, SendHorizonal, Smile, Square, Trash2, X } from 'lucide-react';
import { api, errMsg } from '../lib/api.js';
import { useChat } from '../context/ChatContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { fmtSize } from '../lib/utils.js';

const MAX = 25 * 1024 * 1024;
const EMOJIS = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
  '🙂', '🙃', '😉', '😍', '🥰', '😘', '😋', '😎', '🤩', '🥳',
  '🤔', '🤗', '🤭', '😴', '😭', '😢', '😡', '🤯', '🥺', '😮',
  '👍', '👎', '👏', '🙌', '🤝', '🙏', '💪', '👋', '❤️', '🧡',
  '💛', '💚', '💙', '💜', '🤍', '💯', '✨', '🎉', '🔥', '⭐',
  '🌟', '🌈', '☀️', '🌿', '🌸', '🍀', '🌍', '🍎', '🍕', '☕',
  '⚽', '🏀', '🎮', '🎵', '🎓', '📚', '💡', '📎', '✅', '🎁',
];

function formatDuration(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export default function Composer({ conversationId }) {
  const { send, typingPing, connected } = useChat();
  const { preferences } = useAuth();
  const [text, setText] = useState('');
  const [up, setUp] = useState(null); // { name, size, progress, preview, abort }
  const [error, setError] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const fileRef = useRef(null);
  const taRef = useRef(null);
  const typingTimer = useRef(null);
  const isTyping = useRef(false);
  const recorderRef = useRef(null);
  const recorderStream = useRef(null);
  const recorderChunks = useRef([]);
  const discardRecording = useRef(false);
  const recordingTimer = useRef(null);

  useEffect(() => () => {
    clearTimeout(typingTimer.current);
    clearInterval(recordingTimer.current);
    if (isTyping.current) typingPing(conversationId, false);
    discardRecording.current = true;
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    recorderStream.current?.getTracks().forEach((track) => track.stop());
  }, [conversationId, typingPing]);

  function onChange(e) {
    setText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px';
    if (!isTyping.current) { isTyping.current = true; typingPing(conversationId, true); }
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => { isTyping.current = false; typingPing(conversationId, false); }, 1800);
  }

  async function submitText() {
    const value = text.trim();
    if (!value) return;
    setText(''); setError('');
    if (taRef.current) taRef.current.style.height = 'auto';
    clearTimeout(typingTimer.current); isTyping.current = false; typingPing(conversationId, false);
    try { await send({ conversationId, type: 'text', text: value }); } catch (e) { setText(value); setError(e.message); }
  }

  function insertEmoji(emoji) {
    const textarea = taRef.current;
    if (!textarea) return setText((current) => current + emoji);
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const next = text.slice(0, start) + emoji + text.slice(end);
    setText(next);
    setEmojiOpen(false);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + emoji.length, start + emoji.length);
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 140)}px`;
    });
  }

  async function uploadFile(file, includeDraft = true) {
    if (file.size > MAX) {
      setError('Fichier trop lourd (25 Mo maximum)');
      return;
    }
    setError('');
    const ctrl = new AbortController();
    const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
    setUp({ name: file.name, size: file.size, progress: 0, abort: () => ctrl.abort(), preview });
    const body = new FormData();
    body.append('file', file);
    try {
      const { data } = await api.post('/upload', body, {
        signal: ctrl.signal,
        onUploadProgress: (progress) => setUp((current) => current && {
          ...current,
          progress: Math.round((progress.loaded / (progress.total || file.size)) * 100),
        }),
      });
      await send({ conversationId, type: data.type, text: includeDraft ? text.trim() : '', file: data.file });
      if (includeDraft) setText('');
    } catch (requestError) {
      if (requestError.code !== 'ERR_CANCELED') {
        setError(errMsg(requestError, requestError.message));
      }
    } finally {
      if (preview) URL.revokeObjectURL(preview);
      setUp(null);
    }
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await uploadFile(file);
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('L’enregistrement vocal n’est pas pris en charge par ce navigateur.');
      return;
    }
    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recorderStream.current = stream;
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
        .find((type) => MediaRecorder.isTypeSupported?.(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderChunks.current = [];
      discardRecording.current = false;
      recorder.ondataavailable = (event) => {
        if (event.data.size) recorderChunks.current.push(event.data);
      };
      recorder.onstop = async () => {
        clearInterval(recordingTimer.current);
        const blob = new Blob(recorderChunks.current, { type: recorder.mimeType || 'audio/webm' });
        const shouldDiscard = discardRecording.current;
        recorderChunks.current = [];
        recorderRef.current = null;
        recorderStream.current?.getTracks().forEach((track) => track.stop());
        recorderStream.current = null;
        setRecording(false);
        setRecordingSeconds(0);
        if (!shouldDiscard && blob.size) {
          const extension = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
          await uploadFile(new File([blob], `vocal-${Date.now()}.${extension}`, { type: blob.type }), false);
        }
      };
      recorder.onerror = () => {
        discardRecording.current = true;
        setError('Une erreur a interrompu l’enregistrement vocal.');
        if (recorder.state === 'recording') recorder.stop();
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setRecordingSeconds(0);
      recordingTimer.current = setInterval(() => setRecordingSeconds((seconds) => seconds + 1), 1000);
    } catch (recordingError) {
      recorderStream.current?.getTracks().forEach((track) => track.stop());
      recorderStream.current = null;
      setError(recordingError.name === 'NotAllowedError'
        ? 'Autorisez l’accès au microphone pour enregistrer un vocal.'
        : 'Impossible de démarrer l’enregistrement vocal.');
    }
  }

  function stopRecording(discard = false) {
    if (recorderRef.current?.state !== 'recording') return;
    discardRecording.current = discard;
    recorderRef.current.stop();
  }

  return (
    <div className="glass-strong border-x-0 border-b-0 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5 sm:px-5 sm:pt-3">
      {!connected && <p className="mb-2 text-xs font-medium text-emerald-800">Connexion à la messagerie… L’envoi sera disponible dès qu’elle sera rétablie.</p>}
      <AnimatePresence>
        {up && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="glass mb-3 flex items-center gap-3 rounded-2xl p-3">
              {up.preview ? <img src={up.preview} alt="" className="h-12 w-12 rounded-xl object-cover" /> : <div className="grid h-12 w-12 place-items-center rounded-xl bg-white/10"><Paperclip size={20} /></div>}
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-2 text-sm"><span className="truncate font-medium">{up.name}</span><span className="shrink-0 text-slate-400">{up.progress}%</span></div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={up.progress}>
                  <div className="h-full rounded-full bg-emerald-700 transition-[width] duration-200" style={{ width: `${up.progress}%` }} />
                </div>
                <span className="text-xs text-slate-500">{fmtSize(up.size)}</span>
              </div>
              <button onClick={up.abort} aria-label="Annuler l’envoi" className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10"><X size={18} /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {error && <p role="alert" className="mb-2 flex items-center gap-1.5 text-sm text-emerald-800"><AlertCircle size={14} />{error}</p>}

      <div className="flex items-end gap-1 sm:gap-2">
        <input ref={fileRef} type="file" hidden onChange={onFile} accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime,audio/webm,audio/ogg,audio/mp4,audio/mpeg,audio/wav,audio/aac,.pdf,.txt,.zip,.doc,.docx,.xlsx" />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={!!up || recording || !connected} aria-label="Joindre une photo, une vidéo ou un fichier" title="Joindre un fichier" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-600 transition hover:bg-white/10 disabled:opacity-40 sm:h-11 sm:w-11"><Paperclip size={20} /></button>
        <div className="relative">
          <button type="button" onClick={() => setEmojiOpen((open) => !open)} disabled={recording} aria-label="Insérer un emoji" title="Emoji" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-600 transition hover:bg-white/10 disabled:opacity-40 sm:h-11 sm:w-11"><Smile size={20} /></button>
          {emojiOpen && (
            <div className="absolute bottom-14 left-0 z-30 grid max-h-56 w-64 grid-cols-8 gap-1 overflow-y-auto rounded-2xl border border-emerald-900/10 bg-white p-2 shadow-xl">
              {EMOJIS.map((emoji) => (
                <button key={emoji} type="button" onClick={() => insertEmoji(emoji)} aria-label={`Insérer ${emoji}`}
                  className="grid h-7 w-7 place-items-center rounded-lg text-lg transition hover:bg-emerald-50">{emoji}</button>
              ))}
            </div>
          )}
        </div>
        {recording ? (
          <div className="flex h-11 items-center gap-2 rounded-xl bg-emerald-50 px-2">
            <span className="min-w-10 text-sm font-semibold tabular-nums text-emerald-800">{formatDuration(recordingSeconds)}</span>
            <button type="button" onClick={() => stopRecording(true)} aria-label="Annuler l’enregistrement" title="Annuler" className="grid h-8 w-8 place-items-center rounded-lg text-emerald-800 hover:bg-emerald-100"><Trash2 size={17} /></button>
            <button type="button" onClick={() => stopRecording()} aria-label="Envoyer le vocal" title="Terminer et envoyer" className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-800 text-white hover:bg-emerald-700"><Square size={14} fill="currentColor" /></button>
          </div>
        ) : (
          <button type="button" onClick={startRecording} disabled={!!up || !connected} aria-label="Enregistrer un message vocal" title="Message vocal" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-600 transition hover:bg-white/10 disabled:opacity-40 sm:h-11 sm:w-11"><Mic size={20} /></button>
        )}
        <textarea ref={taRef} rows={1} value={text} onChange={onChange} disabled={recording || !!up} placeholder="Écrivez un message…"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && preferences.sendOnEnter) {
              e.preventDefault();
              submitText();
            }
          }}
          className="field min-w-0 flex-1 max-h-36 min-h-10 resize-none !rounded-2xl !px-3 !py-2.5 sm:min-h-11 sm:!px-4" />
        <button onClick={submitText} disabled={!text.trim() || !connected || recording || !!up} aria-label="Envoyer" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-800 text-white shadow-glow transition hover:bg-emerald-700 active:scale-90 disabled:opacity-40 disabled:shadow-none sm:h-11 sm:w-11"><SendHorizonal size={19} /></button>
      </div>
    </div>
  );
}
