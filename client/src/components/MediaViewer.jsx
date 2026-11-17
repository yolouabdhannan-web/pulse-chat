import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Download, X } from 'lucide-react';

export default function MediaViewer({ media, onClose }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-50 grid place-items-center bg-emerald-950/90 p-4 backdrop-blur-md" role="dialog" aria-modal="true">
      <div className="absolute right-4 top-4 flex gap-2" onClick={(e) => e.stopPropagation()}>
        <a href={media.url} download={media.name} className="glass grid h-11 w-11 place-items-center rounded-xl hover:bg-white/10" aria-label="Télécharger"><Download size={20} /></a>
        <button onClick={onClose} className="glass grid h-11 w-11 place-items-center rounded-xl hover:bg-white/10" aria-label="Fermer"><X size={20} /></button>
      </div>
      <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }} transition={{ type: 'spring', damping: 26, stiffness: 280 }} onClick={(e) => e.stopPropagation()}>
        {media.type === 'image'
          ? <img src={media.url} alt={media.name} className="max-h-[85dvh] max-w-full rounded-2xl shadow-2xl" />
          : <video src={media.url} controls autoPlay className="max-h-[85dvh] max-w-full rounded-2xl bg-emerald-950 shadow-2xl" />}
      </motion.div>
    </motion.div>
  );
}
