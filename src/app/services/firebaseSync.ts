import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  setDoc
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadString } from 'firebase/storage';
import type { StoredEmergencyReport } from '../types/emergency';
import type { ChatMessage } from './chat';
import type { LiveGpsLocation } from './liveGps';
import { firebaseEnabled, firebaseStorage, firestore } from './firebase';

const REPORT_STORAGE_KEY = 'emergencyReports';
const CHAT_STORAGE_KEY = 'emergencyChats';

async function uploadReportPhoto(report: StoredEmergencyReport) {
  if (!firebaseStorage || !report.photo?.startsWith('data:')) return report.photo;
  const photoRef = ref(firebaseStorage, `reports/${report.id}/incident-photo.jpg`);
  await uploadString(photoRef, report.photo, 'data_url');
  return getDownloadURL(photoRef);
}

function removeUndefined<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function syncReportToFirebase(report: StoredEmergencyReport) {
  if (!firestore) return;
  try {
    let photo = report.photo;
    try {
      photo = await uploadReportPhoto(report);
    } catch (error) {
      console.warn('Firebase Storage upload failed; syncing report without photo.', error);
      photo = null;
    }
    const cloudReport = removeUndefined({
      ...report,
      photo,
      timestamp: new Date(report.timestamp).toISOString()
    });
    await setDoc(doc(firestore, 'reports', report.id), cloudReport, { merge: true });
  } catch (error) {
    console.warn('Unable to sync report to Firebase.', error);
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
    const reports = snapshot.docs
      .map(item => item.data() as StoredEmergencyReport)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const localReports = JSON.parse(localStorage.getItem(REPORT_STORAGE_KEY) || '[]') as StoredEmergencyReport[];
    if (!reports.length && localReports.length) {
      void syncReportsToFirebase(localReports);
      return;
    }
    localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(reports));
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
    const messages = snapshot.docs
      .map(item => item.data() as ChatMessage)
      .filter(message => message.reportId === reportId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const chats = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || '{}') as Record<string, ChatMessage[]>;
    chats[reportId] = messages;
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
