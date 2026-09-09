'use client';
import { addDoc, collection, serverTimestamp, Firestore } from 'firebase/firestore';

// Note: This logger does not use the `addDocumentNonBlocking` wrapper to avoid circular dependencies
// or complex promise chains. It's a simple, direct fire-and-forget logger.
import type { LogType } from '@/firebase';

export const logAction = (
  firestore: Firestore,
  action: string,
  type: LogType,
  user: string = 'Sistema'
) => {
  if (!firestore) return;
  const log = {
    timestamp: serverTimestamp(),
    user,
    action,
    type,
  };
  
  // Directly use addDoc for a simple fire-and-forget log entry.
  addDoc(collection(firestore, 'logs'), log).catch(error => {
    // We only log the error to the console and don't bubble it up,
    // as logging is a non-critical background task.
    console.error("Failed to write log action:", error);
  });
};
