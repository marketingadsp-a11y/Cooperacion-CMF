import { initializeApp, getApps, getApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import 'server-only';

// This is a server-only module.
// It is used to get a Firebase Admin instance.

const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT;

// This function initializes and returns a Firebase Admin instance.
// It ensures that only one instance is created.
export function getFirebaseAdmin() {
  if (!serviceAccountString) {
    console.error(
      'FIREBASE_SERVICE_ACCOUNT environment variable is not set. ' +
      'Server-side Firebase features will be disabled.'
    );
    return null;
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountString);
    
    if (!getApps().length) {
      initializeApp({
        credential: cert(serviceAccount),
      });
    }

    return {
      app: getApp(),
      firestore: getFirestore(),
    };
  } catch (e) {
    console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT or initialize Firebase Admin:", (e as Error).message);
    return null;
  }
}
