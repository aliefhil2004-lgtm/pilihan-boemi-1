import {
  collection,
  doc,
  onSnapshot,
  setDoc
} from 'firebase/firestore';
import { firestore } from './firebase';
import type { ServiceType } from '../types/emergency';

export type InAppCallRole = 'civilian' | 'service';
export type InAppCallStatus = 'ringing' | 'connecting' | 'connected' | 'declined' | 'ended';

export interface InAppCallRecord {
  id: string;
  reportId?: string;
  fromRole: InAppCallRole;
  toRole: InAppCallRole;
  callerName: string;
  fromUid?: string;
  targetUid?: string;
  serviceTypes?: ServiceType[];
  status: InAppCallStatus;
  createdAt: number;
  updatedAt: number;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  offerCandidates?: RTCIceCandidateInit[];
  answerCandidates?: RTCIceCandidateInit[];
}

const localCallKey = (callId: string) => `responai-call:${callId}`;
const LOCAL_CALL_EVENT = 'responai-in-app-call';

interface CallSignal {
  kind: 'call-signal';
  callId: string;
  createdAt: number;
  patch: Partial<InAppCallRecord>;
}

function readLocalCall(callId: string): InAppCallRecord | null {
  try {
    return JSON.parse(localStorage.getItem(localCallKey(callId)) || 'null') as InAppCallRecord | null;
  } catch {
    return null;
  }
}

function writeLocalCall(call: InAppCallRecord) {
  localStorage.setItem(localCallKey(call.id), JSON.stringify(call));
  localStorage.setItem(LOCAL_CALL_EVENT, JSON.stringify(call));
}

async function writeCloudSignal(callId: string, patch: Partial<InAppCallRecord>) {
  if (!firestore) return;
  const createdAt = Date.now();
  const signal: CallSignal = { kind: 'call-signal', callId, createdAt, patch };
  const signalId = `call-${callId}-${createdAt}-${Math.random().toString(36).slice(2)}`;
  await setDoc(doc(firestore, 'messages', signalId), signal);
}

function mergeSignals(signals: CallSignal[]) {
  let merged: InAppCallRecord | null = null;
  signals
    .sort((left, right) => left.createdAt - right.createdAt)
    .forEach(signal => {
      const offerCandidates = signal.patch.offerCandidates ?? [];
      const answerCandidates = signal.patch.answerCandidates ?? [];
      merged = {
        ...(merged ?? {} as InAppCallRecord),
        ...signal.patch,
        offerCandidates: [...(merged?.offerCandidates ?? []), ...offerCandidates],
        answerCandidates: [...(merged?.answerCandidates ?? []), ...answerCandidates]
      };
    });
  return merged;
}

export async function createInAppCall(input: Omit<InAppCallRecord, 'id' | 'status' | 'createdAt' | 'updatedAt'>) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const call: InAppCallRecord = {
    ...input,
    id,
    status: 'ringing',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    offerCandidates: [],
    answerCandidates: []
  };
  writeLocalCall(call);
  await writeCloudSignal(id, call);
  return call;
}

export async function updateInAppCall(callId: string, patch: Partial<InAppCallRecord>) {
  const current = readLocalCall(callId);
  if (current) writeLocalCall({ ...current, ...patch, updatedAt: Date.now() });
  await writeCloudSignal(callId, { ...patch, updatedAt: Date.now() });
}

async function appendCandidate(
  callId: string,
  field: 'offerCandidates' | 'answerCandidates',
  candidate: RTCIceCandidateInit
) {
  const current = readLocalCall(callId);
  if (current) {
    writeLocalCall({
      ...current,
      [field]: [...(current[field] ?? []), candidate],
      updatedAt: Date.now()
    });
  }
  await writeCloudSignal(callId, { [field]: [candidate], updatedAt: Date.now() });
}

export function subscribeToInAppCall(callId: string, onCall: (call: InAppCallRecord) => void) {
  const local = readLocalCall(callId);
  if (local) onCall(local);

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== localCallKey(callId) && event.key !== LOCAL_CALL_EVENT) return;
    const next = readLocalCall(callId);
    if (next) onCall(next);
  };
  window.addEventListener('storage', handleStorage);

  const stopCloud = firestore
    ? onSnapshot(collection(firestore, 'messages'), snapshot => {
        const signals = snapshot.docs
          .map(item => item.data() as Partial<CallSignal>)
          .filter((item): item is CallSignal =>
            item.kind === 'call-signal' && item.callId === callId && Boolean(item.patch)
          );
        const call = mergeSignals(signals);
        if (!call) return;
        writeLocalCall(call);
        onCall(call);
      })
    : () => {};

  return () => {
    window.removeEventListener('storage', handleStorage);
    stopCloud();
  };
}

export function subscribeToIncomingInAppCalls(
  role: InAppCallRole,
  currentUid: string | undefined,
  onCall: (call: InAppCallRecord) => void
) {
  const seen = new Set<string>();
  const emit = (call: InAppCallRecord) => {
    if (
      call.toRole !== role ||
      call.fromRole === role ||
      (call.targetUid && call.targetUid !== currentUid) ||
      call.status !== 'ringing' ||
      Date.now() - call.createdAt > 60_000 ||
      seen.has(call.id)
    ) {
      return;
    }
    seen.add(call.id);
    onCall(call);
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== LOCAL_CALL_EVENT || !event.newValue) return;
    try {
      emit(JSON.parse(event.newValue) as InAppCallRecord);
    } catch {
      // Ignore malformed cross-tab events.
    }
  };
  window.addEventListener('storage', handleStorage);

  const stopCloud = firestore
    ? onSnapshot(collection(firestore, 'messages'), snapshot => {
        const groups = new Map<string, CallSignal[]>();
        snapshot.docs.forEach(item => {
          const signal = item.data() as Partial<CallSignal>;
          if (signal.kind !== 'call-signal' || !signal.callId || !signal.patch) return;
          groups.set(signal.callId, [...(groups.get(signal.callId) ?? []), signal as CallSignal]);
        });
        groups.forEach(signals => {
          const call = mergeSignals(signals);
          if (call) emit(call);
        });
      })
    : () => {};

  return () => {
    window.removeEventListener('storage', handleStorage);
    stopCloud();
  };
}

export async function startWebRtcCall(input: {
  callId: string;
  incoming: boolean;
  localStream: MediaStream;
  onRemoteStream: (stream: MediaStream) => void;
  onStateChange: (state: RTCPeerConnectionState) => void;
}) {
  const peer = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  });
  const remoteStream = new MediaStream();
  input.onRemoteStream(remoteStream);
  input.localStream.getTracks().forEach(track => peer.addTrack(track, input.localStream));
  peer.ontrack = event => event.streams[0]?.getTracks().forEach(track => remoteStream.addTrack(track));
  peer.onconnectionstatechange = () => input.onStateChange(peer.connectionState);
  peer.onicecandidate = event => {
    if (!event.candidate) return;
    void appendCandidate(
      input.callId,
      input.incoming ? 'answerCandidates' : 'offerCandidates',
      event.candidate.toJSON()
    );
  };

  const addedCandidates = new Set<string>();
  const addCandidates = async (candidates: RTCIceCandidateInit[] | undefined) => {
    for (const candidate of candidates ?? []) {
      const key = JSON.stringify(candidate);
      if (addedCandidates.has(key)) continue;
      addedCandidates.add(key);
      try {
        await peer.addIceCandidate(candidate);
      } catch {
        // Candidate may arrive before the matching remote description.
      }
    }
  };

  let remoteDescriptionSet = false;
  const stop = subscribeToInAppCall(input.callId, call => {
    void (async () => {
      if (input.incoming) {
        if (call.offer && !remoteDescriptionSet) {
          await peer.setRemoteDescription(call.offer);
          remoteDescriptionSet = true;
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          await updateInAppCall(input.callId, {
            answer: { type: answer.type, sdp: answer.sdp },
            status: 'connecting'
          });
        }
        if (remoteDescriptionSet) await addCandidates(call.offerCandidates);
      } else {
        if (call.answer && !remoteDescriptionSet) {
          await peer.setRemoteDescription(call.answer);
          remoteDescriptionSet = true;
        }
        if (remoteDescriptionSet) await addCandidates(call.answerCandidates);
      }
      if (call.status === 'ended' || call.status === 'declined') peer.close();
    })();
  });

  if (!input.incoming) {
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    await updateInAppCall(input.callId, {
      offer: { type: offer.type, sdp: offer.sdp },
      status: 'ringing'
    });
  }

  return async () => {
    stop();
    peer.close();
    input.localStream.getTracks().forEach(track => track.stop());
  };
}
