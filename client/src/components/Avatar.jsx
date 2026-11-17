export default function Avatar({ name = '?', color = 260, size = 44, online, avatar }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {avatar?.url
        ? <img src={avatar.url} alt="" className="h-full w-full rounded-2xl border border-emerald-900/10 object-cover shadow-sm" />
        : <div className="grid h-full w-full place-items-center rounded-2xl font-bold text-white shadow-lg" style={{ background: 'linear-gradient(135deg, #176a39, #4aa768)', fontSize: size * 0.4 }}>
          {name.slice(0, 1).toUpperCase()}
        </div>}
      {online !== undefined && (
        <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-ink-900 ${online ? 'bg-emerald-500 shadow-[0_0_8px_#25834a]' : 'bg-emerald-200'}`} />
      )}
    </div>
  );
}
