import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

function hasFirebaseStorageConfig() {
  return Boolean(
    firebaseConfig.apiKey
    && firebaseConfig.authDomain
    && firebaseConfig.projectId
    && firebaseConfig.storageBucket
    && firebaseConfig.appId
  );
}

let firebaseApp = null;
let anonymousSessionPromise = null;

export function getFirebaseStorageConfigStatus() {
  return {
    ready: hasFirebaseStorageConfig(),
    missing: Object.entries(firebaseConfig)
      .filter(([key, value]) => ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'appId'].includes(key) && !value)
      .map(([key]) => key),
  };
}

export function getFirebaseApp() {
  if (!hasFirebaseStorageConfig()) {
    const missing = getFirebaseStorageConfigStatus().missing.join(', ');
    throw new Error(`Firebase Storage no esta configurado. Faltan variables: ${missing}.`);
  }
  if (firebaseApp) return firebaseApp;
  firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  return firebaseApp;
}

export async function getFirebaseStorageClient() {
  const app = getFirebaseApp();
  const auth = getAuth(app);
  if (!auth.currentUser) {
    anonymousSessionPromise ||= signInAnonymously(auth).finally(() => {
      anonymousSessionPromise = null;
    });
    await anonymousSessionPromise;
  }
  return getStorage(app);
}
