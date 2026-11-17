import { MessageCircleHeart } from 'lucide-react';
import { useParams } from 'react-router-dom';
import ChatList from '../components/ChatList.jsx';
import ChatWindow from '../components/ChatWindow.jsx';

export default function ChatPage() {
  const { id } = useParams();
  return (
    <div className="flex h-full min-h-0 min-w-0 bg-[#f5f8f5]">
      {/* Mobile : liste OU discussion. Tablette/PC : les deux côte à côte. */}
      <aside className={`${id ? 'hidden lg:flex' : 'flex'} w-full shrink-0 flex-col border-r border-emerald-900/10 bg-white lg:w-[340px] xl:w-[380px]`}>
        <ChatList activeId={id} />
      </aside>
      <section className={`${id ? 'flex' : 'hidden lg:flex'} min-w-0 flex-1 flex-col`}>
        {id ? <ChatWindow key={id} id={id} /> : (
          <div className="grid h-full place-items-center p-8 text-center">
            <div>
              <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-3xl border border-emerald-800/10 bg-emerald-50 text-emerald-800"><MessageCircleHeart size={38} /></div>
              <h2 className="text-xl font-bold">Choisissez une discussion</h2>
              <p className="mt-1 text-sm text-slate-400">Ouvrez une conversation à gauche ou démarrez-en une nouvelle.</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
