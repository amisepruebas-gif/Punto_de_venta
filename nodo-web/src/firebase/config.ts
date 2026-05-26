import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  CACHE_SIZE_UNLIMITED,
  type Firestore,
} from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getFunctions, type Functions } from "firebase/functions";

export const firebaseConfig = {
  apiKey: "AIzaSyD3pRnsJrWA0jek25ygtUnt48z-BCWwkTs",
  authDomain: "amisetienda-c7eab.firebaseapp.com",
  databaseURL: "https://amisetienda-c7eab.firebaseio.com",
  projectId: "amisetienda-c7eab",
  storageBucket: "amisetienda-c7eab.appspot.com",
  messagingSenderId: "201997907687",
  appId: "1:201997907687:web:8cd1664bb9a917cf959442",
  measurementId: "G-DE8Q9PZYKM",
};

export const app: FirebaseApp = initializeApp(firebaseConfig);
export const auth: Auth = getAuth(app);
export const db: Firestore = initializeFirestore(app, {
  // FIX D1: Firestore por default rechaza fields undefined. La flag los ignora
  // al escribir — necesario para ventas con idApartado opcional, etc.
  ignoreUndefinedProperties: true,
  localCache: persistentLocalCache({
    cacheSizeBytes: CACHE_SIZE_UNLIMITED,
    tabManager: persistentMultipleTabManager(),
  }),
});
export const storage: FirebaseStorage = getStorage(app);
export const functions: Functions = getFunctions(app);

/** Intenta solicitar persistencia permanente al navegador. */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  if (await navigator.storage.persisted()) return true;
  return await navigator.storage.persist();
}
