export function chatMeta(chat, me) {
  if (chat.isGroup) return { name: chat.name || 'Groupe', userId: null, color: 265, avatar: null, group: true };
  const other = chat.members.find((m) => m.id !== me.id) || chat.members[0];
  return { name: other?.username || 'Inconnu', userId: other?.id, color: other?.color ?? 200, avatar: other?.avatar, group: false };
}

export const fmtTime = (d) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

export function fmtDay(d) {
  const date = new Date(d), today = new Date();
  const diff = Math.floor((new Date(today.toDateString()) - new Date(date.toDateString())) / 864e5);
  if (diff === 0) return fmtTime(d);
  if (diff === 1) return 'Hier';
  if (diff < 7) return date.toLocaleDateString('fr-FR', { weekday: 'short' });
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

export const fmtSize = (b) => (b < 1024 ** 2 ? `${Math.max(1, Math.round(b / 1024))} Ko` : `${(b / 1024 ** 2).toFixed(1)} Mo`);

export const preview = (m) => (!m ? 'Aucun message' : m.deleted ? 'Message supprimé' : m.type === 'image' ? 'Photo' : m.type === 'video' ? 'Vidéo' : m.type === 'audio' ? 'Message vocal' : m.type === 'file' ? `Fichier : ${m.file?.name}` : m.text);
