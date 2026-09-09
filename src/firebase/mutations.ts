'use client';
    
import {
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  CollectionReference,
  DocumentReference,
  SetOptions,
} from 'firebase/firestore';

export async function setDocument(docRef: DocumentReference, data: any, options: SetOptions): Promise<void> {
  await setDoc(docRef, data, options);
}

export async function addDocument(colRef: CollectionReference, data: any): Promise<DocumentReference> {
  return await addDoc(colRef, data);
}

export async function updateDocument(docRef: DocumentReference, data: any): Promise<void> {
  await updateDoc(docRef, data);
}

export async function deleteDocument(docRef: DocumentReference): Promise<void> {
  await deleteDoc(docRef);
}
