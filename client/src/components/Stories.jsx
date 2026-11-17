import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Check, Plus, X } from 'lucide-react';
import { api, errMsg } from '../lib/api.js';
import { socket } from '../lib/socket.js';
import Avatar from './Avatar.jsx';

const MAX_STORY = 25 * 1024 * 1024;

export default function Stories({ currentUser }) {
  const [groups, setGroups] = useState([]);
  const [active, setActive] = useState(null);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [success, setSuccess] = useState('');
  const input = useRef(null);

  async function loadStories() {
    try {
      const { data } = await api.get('/stories');
      setGroups(data.stories);
    } catch (requestError) {
      setError(errMsg(requestError, 'Chargement des stories impossible'));
    }
  }

  useEffect(() => {
    loadStories();
    socket.on('story:new', loadStories);
    return () => socket.off('story:new', loadStories);
  }, []);

  async function uploadStory(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > MAX_STORY) {
      setError('Story trop lourde (25 Mo maximum)');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'].includes(file.type)) {
      setError('Choisissez une image ou une vidéo');
      return;
    }
    setBusy(true);
    setError('');
    setSuccess('');
    setProgress(0);
    try {
      const body = new FormData();
      body.append('file', file);
      const { data: uploaded } = await api.post('/upload', body, {
        onUploadProgress: (uploadProgress) => {
          setProgress(Math.round((uploadProgress.loaded / (uploadProgress.total || file.size)) * 100));
        },
      });
      const { data } = await api.post('/stories', { type: uploaded.type, file: uploaded.file });
      const publishedStory = data.story;
      setGroups((previous) => {
        const ownGroup = previous.find((group) => group.user.id === currentUser.id);
        const nextGroup = {
          user: {
            id: currentUser.id,
            username: currentUser.username,
            color: currentUser.color,
            avatar: currentUser.avatar,
          },
          stories: [...(ownGroup?.stories || []), publishedStory],
        };
        return [nextGroup, ...previous.filter((group) => group.user.id !== currentUser.id)];
      });
      setSuccess('Votre story est publiée pendant 24 heures.');
    } catch (requestError) {
      setError(errMsg(requestError, 'Publication de la story impossible'));
    } finally {
      setBusy(false);
      setProgress(0);
    }
  }

  const ownStories = groups.find((group) => group.user.id === currentUser.id);
  const open = (group) => { setActive(group); setIndex(0); };
  const openOwnStories = () => {
    if (ownStories) open(ownStories);
    else input.current?.click();
  };
  const story = active?.stories[index];

  return (
    <>
      <div className="flex items-start gap-3 overflow-x-auto px-4 pb-4 pt-1">
        <div className="relative flex w-[64px] shrink-0 flex-col items-center gap-1.5 text-center">
          <button type="button" onClick={openOwnStories} disabled={busy}
            className="flex flex-col items-center gap-1.5 text-center" aria-label={ownStories ? 'Voir votre story' : 'Ajouter une story'}>
          <span className="relative grid h-14 w-14 place-items-center rounded-full border border-dashed border-emerald-500/60 bg-emerald-50 text-emerald-800">
            <Avatar name={currentUser.username} color={currentUser.color} size={48} avatar={currentUser.avatar} />
            {ownStories && <span className="absolute inset-0 rounded-full border-2 border-emerald-700" />}
          </span>
          <span className="w-full truncate text-[11px] text-slate-500">{ownStories ? 'Votre story' : 'Ajouter'}</span>
          </button>
          <button type="button" onClick={() => input.current?.click()} disabled={busy} aria-label="Publier une story"
            className="absolute right-0 top-9 grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-emerald-800 text-white disabled:opacity-50">
            <Plus size={14} />
          </button>
        </div>
        {groups.filter((group) => group.user.id !== currentUser.id).map((group) => (
          <button key={group.user.id} type="button" onClick={() => open(group)}
            className="flex w-[64px] shrink-0 flex-col items-center gap-1.5 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-emerald-700 p-[2px]">
              <span className="rounded-full bg-white p-[2px]"><Avatar name={group.user.username} color={group.user.color} size={48} avatar={group.user.avatar} /></span>
            </span>
            <span className="w-full truncate text-[11px] text-slate-300">{group.user.username}</span>
          </button>
        ))}
        <input ref={input} hidden type="file" accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime" onChange={uploadStory} />
      </div>
      {error && <p role="alert" className="mx-4 mb-3 flex items-center gap-2 text-xs text-emerald-800"><AlertCircle size={14} />{error}</p>}
      {success && <p role="status" className="mx-4 mb-3 flex items-center gap-2 text-xs text-emerald-800"><Check size={14} />{success}</p>}
      {busy && <div className="px-4 pb-3 text-xs text-emerald-700" role="status">
        <div className="mb-1 flex justify-between"><span>Publication de la story…</span><span>{progress}%</span></div>
        <div className="h-1.5 overflow-hidden rounded-full bg-emerald-100"><div className="h-full bg-emerald-700 transition-[width]" style={{ width: `${progress}%` }} /></div>
      </div>}

      <AnimatePresence>
        {active && story && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] grid place-items-center bg-emerald-950/95 p-3 backdrop-blur-md"
            onClick={() => setActive(null)}>
            <div className="absolute left-4 right-16 top-5 flex gap-1">
              {active.stories.map((item, position) => <span key={item.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30"><span className={`block h-full ${position <= index ? 'bg-white' : ''}`} /></span>)}
            </div>
            <div className="absolute left-4 right-4 top-9 flex items-center justify-between text-white">
              <div className="flex items-center gap-2"><Avatar name={active.user.username} color={active.user.color} size={34} avatar={active.user.avatar} /><span className="text-sm font-semibold">{active.user.username}</span><span className="text-xs text-white/60">· 24 h</span></div>
              <button onClick={() => setActive(null)} aria-label="Fermer" className="rounded-full bg-white/10 p-2"><X size={19} /></button>
            </div>
            <div className="relative max-h-[82dvh] max-w-full" onClick={(event) => event.stopPropagation()}>
              {story.type === 'image'
                ? <img src={story.file.url} alt={`Story de ${active.user.username}`} className="max-h-[82dvh] max-w-full rounded-xl object-contain" />
                : <video src={story.file.url} autoPlay controls playsInline className="max-h-[82dvh] max-w-full rounded-xl" />}
              <button onClick={() => setIndex((previous) => (previous + active.stories.length - 1) % active.stories.length)} aria-label="Story précédente" className="absolute inset-y-0 left-0 w-1/3" />
              <button onClick={() => setIndex((previous) => (previous + 1) % active.stories.length)} aria-label="Story suivante" className="absolute inset-y-0 right-0 w-1/3" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
