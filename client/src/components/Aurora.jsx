export default function Aurora() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#f5f8f5]">
      <div className="absolute -left-48 -top-48 h-[34rem] w-[34rem] rounded-full bg-emerald-100/70 blur-[100px]" />
      <div className="absolute -bottom-64 -right-40 h-[38rem] w-[38rem] rounded-full bg-green-50/90 blur-[120px]" />
    </div>
  );
}
