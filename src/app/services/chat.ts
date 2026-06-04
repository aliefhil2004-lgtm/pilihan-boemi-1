export interface ChatMessage {
  id: string;
  reportId: string;
  sender: 'civilian' | 'service';
  senderLabel: string;
  text: string;
  timestamp: string;
}

const CHAT_STORAGE_KEY = 'emergencyChats';

function readChats(): Record<string, ChatMessage[]> {
  return JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || '{}');
}

export function getMessages(reportId: string): ChatMessage[] {
  return readChats()[reportId] ?? [];
}

export function sendMessage(message: Omit<ChatMessage, 'id' | 'timestamp'>) {
  const chats = readChats();
  const nextMessage: ChatMessage = {
    ...message,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: new Date().toISOString()
  };

  chats[message.reportId] = [...(chats[message.reportId] ?? []), nextMessage];
  localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chats));
  window.dispatchEvent(new Event('emergency-chat-updated'));
  void syncMessageToFirebase(nextMessage);
}
import { syncMessageToFirebase } from './firebaseSync';
