import type { ServiceType } from '../types/emergency';

export type CallRole = 'civilian' | 'service';

export interface AppCallData {
  contactName: string;
  contactRole: string;
  serviceType?: ServiceType;
  serviceTypes?: ServiceType[];
  callerRole: CallRole;
  phoneNumber?: string;
}

export interface CallNotification {
  id: string;
  createdAt: number;
  fromRole: CallRole;
  toRole: CallRole;
  callerName: string;
  callerPhone?: string;
  callData: AppCallData;
}

const CALL_NOTIFICATION_KEY = 'emergency-call-notification';

export function publishCallNotification(notification: CallNotification) {
  localStorage.setItem(CALL_NOTIFICATION_KEY, JSON.stringify(notification));
}

function parseCallNotification(raw: string | null): CallNotification | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<CallNotification>;
    if (
      typeof value.id === 'string' &&
      typeof value.createdAt === 'number' &&
      (value.fromRole === 'civilian' || value.fromRole === 'service') &&
      (value.toRole === 'civilian' || value.toRole === 'service') &&
      value.callData
    ) {
      return value as CallNotification;
    }
  } catch {
    return null;
  }
  return null;
}

export function subscribeCallNotifications(onNotification: (notification: CallNotification) => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== CALL_NOTIFICATION_KEY) return;
    const notification = parseCallNotification(event.newValue);
    if (notification) onNotification(notification);
  };

  window.addEventListener('storage', handleStorage);
  return () => window.removeEventListener('storage', handleStorage);
}
