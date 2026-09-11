import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, getFirestore, Firestore, setLogLevel } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App safely
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Suppress transient offline connection warnings in console
try {
  setLogLevel('silent');
} catch (e) {
  // ignore
}

const databaseId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? firebaseConfig.firestoreDatabaseId
  : undefined;

// Initialize Cloud Firestore database with long polling enabled to handle container & sandboxed iframe environments seamlessly
let firestoreDb: Firestore;
try {
  firestoreDb = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    experimentalAutoDetectLongPolling: true,
  }, databaseId);
} catch {
  firestoreDb = getFirestore(app, databaseId);
}

export const db: Firestore = firestoreDb;
export const FIREBASE_CONFIG = firebaseConfig;


