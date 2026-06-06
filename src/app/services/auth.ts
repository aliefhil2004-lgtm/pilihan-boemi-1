import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { firebaseAuth, firebaseEnabled, firestore } from './firebase';
import type { AseanCountryCode } from '../config/asean';

interface CitizenRegisterData {
  email: string;
  password: string;
  name: string;
  phone: string;
  identityType: 'national-id' | 'passport' | 'drivers-license';
  identityNumber: string;
  countryCode: AseanCountryCode;
}

function requireAuth() {
  if (!firebaseEnabled || !firebaseAuth) {
    throw new Error('Firebase is not configured. Check your VITE_FIREBASE_* environment variables.');
  }
  return firebaseAuth;
}

export async function registerCitizenAccount(data: CitizenRegisterData): Promise<User> {
  const auth = requireAuth();
  const credential = await createUserWithEmailAndPassword(auth, data.email, data.password);
  await updateProfile(credential.user, { displayName: data.name });

  if (firestore) {
    await setDoc(doc(firestore, 'users', credential.user.uid), {
      uid: credential.user.uid,
      role: 'civilian',
      name: data.name,
      email: data.email,
      phone: data.phone,
      identityType: data.identityType,
      identityNumber: data.identityNumber,
      countryCode: data.countryCode,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  return credential.user;
}

export async function loginCitizenAccount(email: string, password: string): Promise<User> {
  const auth = requireAuth();
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function logoutFirebaseAccount() {
  if (!firebaseAuth) return;
  await signOut(firebaseAuth);
}

export function listenToCitizenSession(onSession: (user: User | null) => void) {
  if (!firebaseAuth) return () => {};
  return onAuthStateChanged(firebaseAuth, onSession);
}

export function getFriendlyAuthError(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';

  if (code.includes('auth/email-already-in-use')) return 'Email ini sudah terdaftar. Coba login.';
  if (code.includes('auth/invalid-email')) return 'Format email belum benar.';
  if (code.includes('auth/weak-password')) return 'Password terlalu lemah. Minimal 6 karakter.';
  if (code.includes('auth/invalid-credential') || code.includes('auth/wrong-password')) {
    return 'Email atau password salah.';
  }
  if (code.includes('auth/user-not-found')) return 'Akun belum ditemukan. Silakan daftar dulu.';
  if (code.includes('auth/operation-not-allowed')) {
    return 'Email/Password belum diaktifkan di Firebase Authentication.';
  }

  return error instanceof Error ? error.message : 'Authentication failed. Please try again.';
}
