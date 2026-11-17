import { useState } from 'react';
import { Angry, CircleHelp, Frown, Heart, Laugh, SmilePlus, ThumbsUp } from 'lucide-react';

const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '😡'];
const REACTION_ICONS = {
  '👍': ThumbsUp,
  '❤️': Heart,
  '😂': Laugh,
  '😮': CircleHelp,
  '😢': Frown,
  '😡': Angry,
};

function ReactionGlyph({ emoji, size = 14 }) {
  const Icon = REACTION_ICONS[emoji];
  return <Icon size={size} className="text-emerald-700" />;
}

export default function MessageReactions({ messageId, reactions = [], onReact, mine }) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const grouped = REACTIONS.map((emoji) => ({
    emoji,
    count: reactions.filter((reaction) => reaction.emoji === emoji).length,
    selected: reactions.some((reaction) => reaction.emoji === emoji && reaction.mine),
  })).filter((reaction) => reaction.count);

  async function choose(emoji) {
    setOpen(false);
    setFailed(false);
    try {
      await onReact(messageId, emoji);
    } catch {
      setFailed(true);
    }
  }

  return (
    <div className={`absolute ${mine ? 'left-1' : 'right-1'} -bottom-3 z-10 flex items-center gap-1`}>
      {grouped.map(({ emoji, count, selected }) => (
        <button key={emoji} type="button" onClick={() => choose(emoji)}
          aria-label={`${emoji}, ${count} réaction${count > 1 ? 's' : ''}`}
          className={`flex h-7 items-center gap-1 rounded-full border border-white/10 bg-ink-900 px-2 text-xs shadow-lg transition hover:scale-105 ${selected ? 'ring-1 ring-emerald-600' : ''}`}>
          <ReactionGlyph emoji={emoji} />
          {count > 1 && <span className="text-slate-300">{count}</span>}
        </button>
      ))}
      <div className="relative">
        <button type="button" onClick={() => setOpen((value) => !value)} aria-label="Ajouter une réaction"
          className="grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-ink-900 text-slate-300 shadow-lg transition hover:text-emerald-700">
          <SmilePlus size={14} />
        </button>
        {open && (
          <div className={`absolute bottom-9 ${mine ? 'left-0' : 'right-0'} flex rounded-2xl border border-white/10 bg-ink-900 p-1 shadow-xl`}>
            {REACTIONS.map((emoji) => (
              <button key={emoji} type="button" onClick={() => choose(emoji)}
                aria-label={`Réagir ${emoji}`} className="rounded-xl p-1.5 text-emerald-700 transition hover:bg-emerald-50">
                <ReactionGlyph emoji={emoji} size={18} />
              </button>
            ))}
          </div>
        )}
        {failed && <span role="alert" className="absolute right-0 top-9 whitespace-nowrap rounded-lg bg-emerald-800 px-2 py-1 text-[11px] text-white">Réaction impossible</span>}
      </div>
    </div>
  );
}
