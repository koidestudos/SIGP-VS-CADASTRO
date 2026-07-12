import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '').replace(/^gs:\/\//, ''),
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.apiKey !== 'sua-api-key'
);

let app = null;
let auth = null;
let db = null;
let storage = null;

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  // Cloud Storage for Firebase (cota free) — bucket do mesmo projeto
  if (firebaseConfig.storageBucket) {
    try {
      storage = getStorage(app, `gs://${firebaseConfig.storageBucket}`);
    } catch {
      try {
        storage = getStorage(app);
      } catch {
        storage = null;
      }
    }
  }
}

export { app, auth, db, storage };
