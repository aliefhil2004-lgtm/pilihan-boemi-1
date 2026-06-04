import { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, MessageSquare, Send } from 'lucide-react';
import { getMessages, sendMessage, type ChatMessage } from '../services/chat';
import type { ServiceType } from '../types/emergency';

interface ChatScreenProps {
  reportId: string;
  userRole: 'civilian' | 'service';
  serviceType?: ServiceType;
  onBack: () => void;
}

const serviceNames: Record<ServiceType, string> = {
  ambulance: 'Medical Unit',
  fire: 'Fire Unit',
  police: 'Police Unit'
};

export function ChatScreen({ reportId, userRole, serviceType, onBack }: ChatScreenProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');

  useEffect(() => {
    const refresh = () => setMessages(getMessages(reportId));
    refresh();
    const interval = setInterval(refresh, 1000);
    window.addEventListener('storage', refresh);
    window.addEventListener('emergency-chat-updated', refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', refresh);
      window.removeEventListener('emergency-chat-updated', refresh);
    };
  }, [reportId]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!text.trim()) return;
    sendMessage({
      reportId,
      sender: userRole,
      senderLabel: userRole === 'civilian' ? 'Civilian Reporter' : serviceNames[serviceType ?? 'ambulance'],
      text: text.trim()
    });
    setText('');
  };

  return (
    <div className="flex h-full flex-col bg-gray-900 text-white">
      <header className="flex items-center gap-3 border-b border-gray-800 bg-gray-900 p-4">
        <button onClick={onBack} className="rounded-full bg-gray-800 p-2 hover:bg-gray-700" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <MessageSquare className="h-6 w-6 text-blue-400" />
        <div>
          <h1 className="font-bold">Emergency Response Chat</h1>
          <p className="text-xs text-gray-400">Report #{reportId.slice(-6)}</p>
        </div>
      </header>

      <main className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 text-sm text-blue-200">
            Chat is ready. Send an update so responding units receive the latest information.
          </div>
        )}
        {messages.map(message => {
          const isMine = message.sender === userRole && (
            userRole === 'civilian' || message.senderLabel === serviceNames[serviceType ?? 'ambulance']
          );
          return (
            <div key={message.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${isMine ? 'bg-blue-600' : 'bg-gray-800'}`}>
                <p className="mb-1 text-xs font-semibold text-blue-100">{message.senderLabel}</p>
                <p className="text-sm">{message.text}</p>
                <p className="mt-1 text-right text-[10px] text-gray-300">
                  {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
      </main>

      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-gray-800 bg-gray-900 p-4">
        <input
          value={text}
          onChange={event => setText(event.target.value)}
          placeholder="Type an emergency update..."
          className="flex-1 rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-sm outline-none focus:border-blue-500"
        />
        <button type="submit" className="rounded-xl bg-blue-600 px-4 hover:bg-blue-700" aria-label="Send message">
          <Send className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
}
