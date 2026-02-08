import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { ChatWidget, ChatButton } from '@/components/chat';

export function MainLayout() {
  const [isChatOpen, setIsChatOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Chat Assistant */}
      <ChatButton onClick={() => setIsChatOpen(true)} isOpen={isChatOpen} />
      <ChatWidget isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </div>
  );
}
