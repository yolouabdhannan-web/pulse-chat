import { Link, Navigate } from 'react-router-dom';
import { ArrowRight, MessageCircle, Shield, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import Avatar from '../components/Avatar.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';

const highlights = [
  { icon: MessageCircle, title: 'Discutez facilement', text: 'Échangez en privé ou en groupe autour de vos cours et de la vie étudiante.' },
  { icon: Users, title: 'Retrouvez votre communauté', text: 'Lancez une conversation avec les autres étudiants de HECM.' },
  { icon: Shield, title: 'Un espace dédié', text: 'Une messagerie pensée pour communiquer au sein de votre université.' },
];

export default function Home() {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-full place-items-center"><div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-100 border-t-emerald-700" /></div>;
  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/chat'} replace />;

  return (
    <main className="min-h-full bg-white text-emerald-950">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-3 py-4 sm:px-8 sm:py-5">
        <Link to="/" className="flex min-w-0 items-center gap-2 sm:gap-3" aria-label="Accueil HECM">
          <img src="/favicon.svg" alt="" className="h-9 w-9 shrink-0 sm:h-11 sm:w-11" />
          <span className="whitespace-nowrap text-sm font-extrabold tracking-tight min-[360px]:text-base sm:text-xl">HECM<span className="text-emerald-700"> Connect</span></span>
        </Link>
        <nav className="flex shrink-0 items-center gap-1 sm:gap-2">
          <ThemeToggle className="!h-8 !w-8 !rounded-lg sm:!h-10 sm:!w-10 sm:!rounded-xl" />
          <Link to="/login" className="rounded-xl px-1.5 py-2.5 text-[11px] font-semibold text-emerald-900 transition hover:bg-emerald-50 sm:px-4 sm:text-sm">Se connecter</Link>
          <Link to="/register" className="rounded-xl bg-emerald-800 px-2.5 py-2.5 text-[11px] font-semibold text-white shadow-glow transition hover:bg-emerald-700 sm:px-4 sm:text-sm">S’inscrire</Link>
        </nav>
      </header>

      <section className="relative isolate overflow-hidden border-y border-emerald-100 bg-[#f5faf6]">
        <div className="absolute -right-20 top-0 -z-10 h-96 w-96 rounded-full bg-emerald-100/70 blur-3xl" />
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:gap-12 sm:px-8 sm:py-20 md:grid-cols-[1.1fr_.9fr] md:py-28">
          <div>
            <p className="mb-5 inline-flex rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-[.18em] text-emerald-800">La communauté étudiante HECM</p>
            <h1 className="max-w-2xl text-3xl font-extrabold leading-tight tracking-tight min-[390px]:text-4xl sm:text-6xl">Les échanges de votre campus, <span className="text-emerald-700">au même endroit.</span></h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-emerald-950/70 sm:mt-6 sm:text-lg sm:leading-8">HECM Connect est l’espace de discussion des étudiants de HECM. Retrouvez vos camarades, échangez sur vos cours et partagez les moments de la vie universitaire.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/register" className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-6 py-3.5 font-semibold text-white shadow-glow transition hover:bg-emerald-700">Créer mon compte <ArrowRight size={18} /></Link>
              <Link to="/login" className="rounded-xl border border-emerald-200 bg-white px-6 py-3.5 font-semibold text-emerald-900 transition hover:bg-emerald-50">J’ai déjà un compte</Link>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-md">
            <div className="absolute -inset-4 rounded-[2rem] bg-emerald-200/50 blur-2xl" />
            <div className="relative rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-[0_24px_70px_-30px_rgba(22,101,52,.35)]">
              <div className="flex items-center justify-between border-b border-emerald-100 pb-4">
                <div><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">HECM Connect</p><p className="mt-1 font-bold">Discussions étudiantes</p></div>
                <div className="flex -space-x-2">
                  {['A', 'M', 'S'].map((initial, index) => <span key={initial} className="grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-emerald-800 text-sm font-bold text-white" style={{ opacity: 1 - index * 0.13 }}>{initial}</span>)}
                </div>
              </div>
              <div className="space-y-4 py-5">
                <div className="flex items-start gap-3"><Avatar name="Amina" size={40} /><div className="rounded-2xl rounded-tl-md bg-emerald-50 px-4 py-3"><p className="text-xs font-semibold text-emerald-800">Amina</p><p className="mt-1 text-sm text-emerald-950">Quelqu’un a les notes du cours d’aujourd’hui ?</p></div></div>
                <div className="flex justify-end"><div className="rounded-2xl rounded-br-md bg-emerald-800 px-4 py-3 text-white"><p className="text-sm">Oui, je les partage dans le groupe !</p><p className="mt-1 text-right text-[11px] text-white/75">Maintenant</p></div></div>
                <div className="flex items-start gap-3"><Avatar name="Marc" size={40} /><div className="rounded-2xl rounded-tl-md bg-emerald-50 px-4 py-3"><p className="text-xs font-semibold text-emerald-800">Marc</p><p className="mt-1 text-sm text-emerald-950">Merci, ça va nous aider pour réviser.</p></div></div>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-[#f5faf6] px-4 py-3 text-sm text-emerald-700">Votre prochain échange commence ici…</div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 md:py-20">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <p className="text-sm font-bold uppercase tracking-[.18em] text-emerald-700">Un espace fait pour les étudiants</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Connectés à la vie de HECM</h2>
          <p className="mt-3 text-emerald-950/65">Une interface simple pour partager, s’entraider et rester en contact pendant vos études.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {highlights.map(({ icon: Icon, title, text }) => <article key={title} className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
            <span className="mb-5 grid h-12 w-12 place-items-center rounded-xl bg-emerald-50 text-emerald-800"><Icon size={23} /></span>
            <h3 className="text-lg font-bold">{title}</h3>
            <p className="mt-2 leading-7 text-emerald-950/65">{text}</p>
          </article>)}
        </div>
      </section>

      <footer className="border-t border-emerald-100 bg-[#f5faf6] px-5 py-7 text-center text-sm text-emerald-950/60">HECM Connect · La messagerie des étudiants de HECM</footer>
    </main>
  );
}
