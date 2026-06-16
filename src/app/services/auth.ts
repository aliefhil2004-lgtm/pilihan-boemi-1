import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  getIdTokenResult,
  type User
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { firebaseAuth, firebaseEnabled, firestore } from './firebase';
import type { AseanCountryCode } from '../config/asean';
import type { ServiceType } from '../types/emergency';

interface CitizenRegisterData {
  email: string;
  password: string;
  name: string;
  phone: string;
  identityType: 'national-id' | 'passport' | 'drivers-license';
  identityNumber: string;
  countryCode: AseanCountryCode;
}

export interface UserProfile {
  uid: string;
  name?: string;
  email?: string;
  phone?: string;
  identityNumber?: string;
  role?: string;
  serviceType?: ServiceType;
}

interface ServiceLoginResult {
  user: User;
  serviceType: ServiceType;
  profile: UserProfile;
}

interface FirestoreUserProfile {
  role?: unknown;
  serviceType?: unknown;
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  identityNumber?: unknown;
}

function isServiceType(value: unknown): value is ServiceType {
  return value === 'ambulance' || value === 'fire' || value === 'police';
}

function getServiceTypeFromRole(role: unknown): ServiceType | null {
  if (role === 'medic' || role === 'medical') return 'ambulance';
  if (isServiceType(role)) return role;
  return null;
}

function requireAuth() {
  if (!firebaseEnabled || !firebaseAuth) return null;
  return firebaseAuth;
}

function getLocalDemoServiceLogin(email: string, password: string): ServiceLoginResult | null {
  const isLocalPreview =
    typeof window !== 'undefined' &&
    ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);

  const normalizedEmail = email.toLowerCase();
  const isDemoServiceAccount =
    (normalizedEmail === 'demo123@gmail.com' && password === '123456') ||
    (normalizedEmail === 'demo1232gmail.com' && password === '123456') ||
    (normalizedEmail === 'service@demo.com' && password === 'demo123');

  if (!isLocalPreview || !isDemoServiceAccount) {
    return null;
  }

  const serviceType: ServiceType = 'fire';
  const profile: UserProfile = {
    uid: 'local-demo-service',
    name: 'Alex Morgan',
    email: normalizedEmail,
    role: 'service',
    serviceType
  };

  return {
    user: {
      uid: profile.uid,
      email: normalizedEmail,
      displayName: profile.name
    } as User,
    serviceType,
    profile
  };
}

function normalizeUserProfile(user: User, data?: FirestoreUserProfile | null): UserProfile {
  return {
    uid: user.uid,
    name: typeof data?.name === 'string' ? data.name : user.displayName ?? undefined,
    email: typeof data?.email === 'string' ? data.email : user.email ?? undefined,
    phone: typeof data?.phone === 'string' ? data.phone : undefined,
    identityNumber: typeof data?.identityNumber === 'string' ? data.identityNumber : undefined,
    role: typeof data?.role === 'string' ? data.role : undefined,
    serviceType: isServiceType(data?.serviceType) ? data.serviceType : undefined
  };
}

export async function getUserProfile(user: User): Promise<UserProfile> {
  if (!firestore) return normalizeUserProfile(user);

  const uidProfile = await getDoc(doc(firestore, 'users', user.uid));
  if (uidProfile.exists()) return normalizeUserProfile(user, uidProfile.data());

  if (user.email) {
    const emailProfile = await getDoc(doc(firestore, 'users', user.email));
    if (emailProfile.exists()) return normalizeUserProfile(user, emailProfile.data());
  }

  return normalizeUserProfile(user);
}

export async function registerCitizenAccount(data: CitizenRegisterData): Promise<User> {
  const auth = requireAuth();
  if (!auth) {
    throw new Error('Firebase auth is unavailable in this local preview. Configure VITE_FIREBASE_* to enable registration.');
  }
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
  if (!auth) {
    throw new Error('Firebase auth is unavailable in this local preview. Configure VITE_FIREBASE_* to enable login.');
  }
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function loginServiceAccount(email: string, password: string): Promise<ServiceLoginResult> {
  const demoLogin = getLocalDemoServiceLogin(email, password);
  if (demoLogin) return demoLogin;

  const auth = requireAuth();
  if (!auth) {
    throw new Error('Firebase auth is unavailable in this local preview. Configure VITE_FIREBASE_* to enable service login.');
  }
  const credential = await signInWithEmailAndPassword(auth, email, password);
  const token = await getIdTokenResult(credential.user);

  let role = token.claims.role;
  let serviceType: unknown = token.claims.serviceType;

  const profile = await getUserProfile(credential.user);
  role = profile.role ?? role;
  serviceType = profile.serviceType ?? serviceType;

  const normalizedServiceType = isServiceType(serviceType)
    ? serviceType
    : getServiceTypeFromRole(role);

  if (role !== 'service' && !getServiceTypeFromRole(role)) {
    await signOut(auth);
    throw new Error('Akun ini belum diberi akses layanan darurat oleh admin.');
  }

  if (!normalizedServiceType) {
    await signOut(auth);
    throw new Error('Role layanan belum lengkap. Admin perlu mengisi serviceType: ambulance, fire, atau police.');
  }

  return {
    user: credential.user,
    serviceType: normalizedServiceType,
    profile: {
      ...profile,
      role: 'service',
      serviceType: normalizedServiceType
    }
  };
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
