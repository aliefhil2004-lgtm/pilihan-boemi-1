import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  setDoc
} from 'firebase/firestore';
import type { StoredEmergencyReport } from '../types/emergency';
import type { ChatMessage } from './chat';
import type { LiveGpsLocation } from './liveGps';
import { firebaseEnabled, firestore } from './firebase';

const REPORT_STORAGE_KEY = 'emergencyReports';
const CHAT_STORAGE_KEY = 'emergencyChats';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Unable to prepare report thumbnail'));
    image.src = src;
  });
}

async function createInlineThumbnail(photo: string | null) {
  if (!photo?.startsWith('data:') || typeof document === 'undefined') return photo;
  const image = await loadImage(photo);
  const maxDimension = 480;
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  let quality = 0.62;
  let thumbnail = canvas.toDataURL('image/jpeg', quality);
  while (thumbnail.length > 220_000 && quality > 0.32) {
    quality -= 0.1;
    thumbnail = canvas.toDataURL('image/jpeg', quality);
  }
  return thumbnail.length <= 220_000 ? thumbnail : null;
}

function removeUndefined<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function syncReportToFirebase(report: StoredEmergencyReport) {
  if (!firestore) return;
  try {
    let photo: string | null = null;
    try {
      photo = await createInlineThumbnail(report.photo);
    } catch (error) {
      console.warn('Inline report thumbnail failed; syncing report without photo.', error);
    }
    const cloudReport = removeUndefined({
      ...report,
      photo,
      timestamp: new Date(report.timestamp).toISOString()
    });
    await setDoc(doc(firestore, 'reports', report.id), cloudReport, { merge: true });
  } catch (error) {
    console.warn('Unable to sync report to Firebase.', error);
    throw error;
  }
}

export async function syncReportsToFirebase(reports: StoredEmergencyReport[]) {
  if (!firestore) return;
  await Promise.all(reports.map(syncReportToFirebase));
}

export async function deleteReportsFromFirebase(reportIds: string[]) {
  if (!firestore) return;
  await Promise.all(reportIds.map(reportId => deleteDoc(doc(firestore, 'reports', reportId))));
}

export function startReportSync() {
  if (!firestore) return () => {};
  return onSnapshot(collection(firestore, 'reports'), snapshot => {
    const cloudReports = snapshot.docs
      .map(item => item.data() as StoredEmergencyReport)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const localReports = JSON.parse(localStorage.getItem(REPORT_STORAGE_KEY) || '[]') as StoredEmergencyReport[];
    if (!cloudReports.length && localReports.length) {
      void syncReportsToFirebase(localReports);
      return;
    }

    const reportsById = new Map(localReports.map(report => [report.id, report]));
    cloudReports.forEach(cloudReport => {
      const localReport = reportsById.get(cloudReport.id);
      reportsById.set(cloudReport.id, {
        ...localReport,
        ...cloudReport,
        photo: cloudReport.photo ?? localReport?.photo ?? null,
        privacyRegions: cloudReport.privacyRegions ?? localReport?.privacyRegions,
        evidenceMetadata: cloudReport.evidenceMetadata ?? localReport?.evidenceMetadata
      });
    });
    const mergedReports = [...reportsById.values()]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(mergedReports));
    window.dispatchEvent(new Event('emergency-reports-updated'));
  }, error => console.warn('Unable to subscribe to Firebase reports.', error));
}

export async function syncMessageToFirebase(message: ChatMessage) {
  if (!firestore) return;
  try {
    await setDoc(doc(firestore, 'messages', message.id), message);
  } catch (error) {
    console.warn('Unable to sync chat message to Firebase.', error);
  }
}

export function startChatSync(reportId: string) {
  if (!firestore) return () => {};
  return onSnapshot(collection(firestore, 'messages'), snapshot => {
    const cloudMessages = snapshot.docs
      .map(item => item.data() as ChatMessage)
      .filter(message => message.reportId === reportId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const chats = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || '{}') as Record<string, ChatMessage[]>;
    const messagesById = new Map((chats[reportId] ?? []).map(message => [message.id, message]));
    cloudMessages.forEach(message => messagesById.set(message.id, message));
    chats[reportId] = [...messagesById.values()]
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chats));
    window.dispatchEvent(new Event('emergency-chat-updated'));
  }, error => console.warn('Unable to subscribe to Firebase messages.', error));
}

export async function syncLiveGpsToFirebase(location: LiveGpsLocation) {
  if (!firestore) return;
  try {
    const key = location.reportId ? `${location.service}:${location.reportId}` : location.service;
    await setDoc(doc(firestore, 'liveGps', key), location);
  } catch (error) {
    console.warn('Unable to sync live GPS to Firebase.', error);
  }
}

export async function deleteLiveGpsFromFirebase(service: LiveGpsLocation['service'], reportId?: string) {
  if (!firestore) return;
  try {
    await deleteDoc(doc(firestore, 'liveGps', reportId ? `${service}:${reportId}` : service));
  } catch (error) {
    console.warn('Unable to delete live GPS from Firebase.', error);
  }
}

export async function fetchLiveGpsFromFirebase(service: LiveGpsLocation['service'], reportId?: string) {
  if (!firestore) return null;
  try {
    const snapshot = await getDoc(doc(firestore, 'liveGps', reportId ? `${service}:${reportId}` : service));
    return snapshot.exists() ? snapshot.data() as LiveGpsLocation : null;
  } catch {
    return null;
  }
}

export { firebaseEnabled };
