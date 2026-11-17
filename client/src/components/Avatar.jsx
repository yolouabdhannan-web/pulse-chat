export default function Avatar({ name = '?', color = 260, size = 44, online, avatar }) {
  const hue = Number.isFinite(Number(color)) ? Number(color) : 260;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {avatar?.url
        ? <img src={avatar.url} alt="" className="h-full w-full rounded-full border border-white/10 object-cover shadow-sm" />
        : <div className="grid h-full w-full place-items-center rounded-full font-bold text-white shadow-lg" style={{ background: `linear-gradient(135deg, hsl(${hue} 82% 62%), hsl(${hue} 82% 46%))`, fontSize: size * 0.4 }}>
          {name.slice(0, 1).toUpperCase()}
        </div>}
      {online !== undefined && (
        <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#101217] ${online ? 'bg-emerald-500 shadow-[0_0_8px_#25834a]' : 'bg-slate-500'}`} />
      )}
    </div>
  );
}
