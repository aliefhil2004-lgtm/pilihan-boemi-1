import { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, Check, CirclePlus, Phone, Send, Smile, User } from 'lucide-react';
import { toast } from 'sonner';
import { getMessages, sendMessage, type ChatMessage } from '../services/chat';
import type { ServiceType } from '../types/emergency';
import { startChatSync } from '../services/firebaseSync';
import { cleanupExpiredReports } from '../services/reportStorage';
import { citizenContactNumber, getServiceContactNumber } from '../config/contacts';

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

const serviceColors: Record<ServiceType, string> = {
  ambulance: '#679CBC',
  fire: '#FF5C00',
  police: '#2563EB'
};

export function ChatScreen({ reportId, userRole, serviceType, onBack }: ChatScreenProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [reporterPhone, setReporterPhone] = useState<string | null>(null);
  const activeService = serviceType ?? 'ambulance';
  const counterpartyPhone = userRole === 'civilian'
    ? getServiceContactNumber(activeService)
    : reporterPhone ?? citizenContactNumber;

  useEffect(() => {
    const refresh = () => {
      setMessages(getMessages(reportId));
      setReporterPhone(cleanupExpiredReports().find(report => report.id === reportId)?.reporterPhone ?? null);
    };
    refresh();
    const stopFirebaseSync = startChatSync(reportId);
    const interval = setInterval(refresh, 1000);
    window.addEventListener('storage', refresh);
    window.addEventListener('emergency-chat-updated', refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', refresh);
      window.removeEventListener('emergency-chat-updated', refresh);
      stopFirebaseSync();
    };
  }, [reportId]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!text.trim()) return;
    sendMessage({
      reportId,
      sender: userRole,
      senderLabel: userRole === 'civilian' ? 'Civilian Reporter' : serviceNames[activeService],
      text: text.trim()
    });
    setText('');
  };

  return (
    <div className="flex h-full flex-col bg-white text-[#0c3249]">
      <header className="flex h-[123px] shrink-0 items-end justify-between bg-white px-6 pb-4 shadow-[0_4px_12px_rgba(0,0,0,0.05)]">
        <div className="flex w-[292px] items-center gap-4">
          <button onClick={onBack} className="flex h-10 w-[31px] items-center justify-center rounded-full" aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-[20px] font-semibold leading-7 tracking-[-1px]">Mytha Floyen</h1>
            <p className="flex items-center gap-2 text-[12px] font-medium uppercase leading-4 tracking-[0.3px] text-[#0c3249]/50">
              <span className="h-2 w-2 rounded-full bg-[#4caf50]" />
              Active now
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            toast.success(userRole === 'civilian' ? `Calling ${serviceNames[activeService]}` : `Calling citizen at ${counterpartyPhone}`);
            window.location.href = `tel:${counterpartyPhone}`;
          }}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0c3249] text-white"
          aria-label={userRole === 'civilian' ? 'Call responder' : 'Call citizen reporter'}
        >
          <Phone className="h-[18px] w-[18px]" />
        </button>
      </header>

      <main className="app-scrollbar flex-1 space-y-6 overflow-y-auto px-4 py-4">
        <div className="flex justify-center py-2">
          <span className="rounded-full bg-[#f3f4f5] px-3 py-[3px] text-[13px] font-medium leading-[19.5px] tracking-[0.5px] text-[#40493c]">Today</span>
        </div>
        {messages.length === 0 && (
          <>
            <div className="flex items-end gap-3">
              <span className="mb-5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0c3249] text-white"><User className="h-4 w-4" /></span>
              <div className="max-w-[286px]">
                <div className="rounded-[24px_24px_24px_2px] bg-[rgba(0,99,136,0.10)] px-4 py-3 text-[14px] leading-5 text-[#191c1d]">
                  I've just submitted the fire report. Smoke is visible on the 2rd floor. People are evacuating now.
                </div>
                <p className="mt-1 pl-1 text-[10px] font-semibold uppercase leading-[15px] text-[#94a3b8]">Civilian - 18:30 WIB</p>
              </div>
            </div>
            <div className="flex justify-end">
              <div className="max-w-[286px]">
                <div className="rounded-[24px_24px_2px_24px] px-4 py-3 text-right text-[14px] leading-5 text-white" style={{ backgroundColor: serviceColors[activeService] }}>
                  Received, Mytha. {serviceNames[activeService]} responders have been dispatched. ETA is <span className="font-extrabold text-[#c11720]">3 minutes.</span>
                </div>
                <p className="mt-1 flex justify-end gap-1 pr-1 text-[10px] font-semibold leading-[15px] text-[#94a3b8]">
                  18:31 WIB <Check className="h-3 w-3" />
                </p>
              </div>
            </div>
          </>
        )}
        {messages.map(message => {
          const isMine = message.sender === userRole && (
            userRole === 'civilian' || message.senderLabel === serviceNames[activeService]
          );
          return (
            <div key={message.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              {!isMine && <span className="mb-5 mr-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0c3249] text-white"><User className="h-4 w-4" /></span>}
              <div className={`max-w-[286px] ${isMine ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                <div
                  className={`px-4 py-3 text-[14px] leading-5 ${isMine ? 'rounded-[24px_24px_2px_24px] text-right text-white' : 'rounded-[24px_24px_24px_2px] bg-[rgba(0,99,136,0.10)] text-[#191c1d]'}`}
                  style={isMine ? { backgroundColor: serviceColors[activeService] } : undefined}
                >
                <p className="text-sm leading-5">{message.text}</p>
                </div>
                <p className={`px-1 text-[10px] font-semibold uppercase leading-[15px] text-[#94a3b8]`}>
                  {!isMine && `${message.senderLabel} - `}
                  {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
      </main>

      <form onSubmit={handleSubmit} className="flex h-[89px] shrink-0 items-center gap-3 bg-white px-5 py-[30px] shadow-[0_-4px_24px_rgba(0,0,0,0.05)]">
        <button type="button" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#e7e8e9]" aria-label="Add attachment">
          <CirclePlus className="h-4 w-4 text-[#40493c]" />
        </button>
        <div className="relative flex-1">
          <input
            value={text}
            onChange={event => setText(event.target.value)}
            placeholder="Type your message..."
            className="h-12 w-full rounded-full bg-[#e7e8e9] px-6 pr-12 text-[15px] outline-none placeholder:text-[#94a3b8]"
          />
          <Smile className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#40493c]" />
        </div>
        <button type="submit" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#0c3249] text-white" aria-label="Send message">
          <Send className="h-5 w-5 fill-current" />
        </button>
      </form>
    </div>
  );
}
