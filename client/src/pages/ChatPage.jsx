import { MessageCircle } from 'lucide-react';
import { useParams } from 'react-router-dom';
import ChatList from '../components/ChatList.jsx';
import ChatWindow from '../components/ChatWindow.jsx';

export default function ChatPage() {
  const { id } = useParams();
  return (
    <div className="flex h-full min-h-0 min-w-0 bg-[#f5f8f5]">
      {/* Mobile : liste OU discussion. Tablette/PC : les deux côte à côte. */}
      <aside className={`${id ? 'hidden lg:flex' : 'flex'} w-full shrink-0 flex-col border-r border-emerald-900/10 bg-white lg:w-[296px] xl:w-[320px]`}>
        <ChatList activeId={id} />
      </aside>
      <section className={`${id ? 'flex' : 'hidden lg:flex'} min-w-0 flex-1 flex-col`}>
        {id ? <ChatWindow key={id} id={id} /> : (
          <div className="grid h-full place-items-center p-8 text-center">
            <div>
              <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-800"><MessageCircle size={30} strokeWidth={1.8} /></div>
              <h2 className="mx-auto w-fit rounded-full bg-emerald-50 px-4 py-2 text-sm font-medium text-slate-400">Sélectionnez une discussion pour commencer</h2>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
