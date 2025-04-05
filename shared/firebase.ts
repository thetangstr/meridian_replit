import { initializeApp } from 'firebase/app';
import { getStorage } from 'firebase/storage';

// Firebase configuration - replace with real values in production
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "placeholder-api-key",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "placeholder-project-id.firebaseapp.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "placeholder-project-id",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "placeholder-project-id.appspot.com",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "000000000000",
  appId: process.env.FIREBASE_APP_ID || "1:000000000000:web:0000000000000000000000"
};

// Initialize Firebase
export const firebaseApp = initializeApp(firebaseConfig);
export const storage = getStorage(firebaseApp);

// Helper function to check if Firebase is properly configured
export const isFirebaseConfigured = (): boolean => {
  return firebaseConfig.apiKey !== "placeholder-api-key";
};