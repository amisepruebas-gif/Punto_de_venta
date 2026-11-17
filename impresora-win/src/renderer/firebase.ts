// Firebase de la ventana: sesión (acceso `imprimir`), la cola en Firestore y
// la function para vincular. La configuración es la pública de la web
// (la misma de mercancia-web/src/firebase/config.ts).
import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  connectAuthEmulator,
  indexedDBLocalPersistence,
  initializeAuth,
  type Auth,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  initializeFirestore,
  memoryLocalCache,
  type Firestore,
} from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, type Functions } from "firebase/functions";

const CONFIG_PRODUCCION = {
  apiKey: "AIzaSyD3pRnsJrWA0jek25ygtUnt48z-BCWwkTs",
  authDomain: "amisetienda-c7eab.firebaseapp.com",
  databaseURL: "https://amisetienda-c7eab.firebaseio.com",
  projectId: "amisetienda-c7eab",
  storageBucket: "amisetienda-c7eab.appspot.com",
  messagingSenderId: "201997907687",
  appId: "1:201997907687:web:8cd1664bb9a917cf959442",
  measurementId: "G-DE8Q9PZYKM",
};

export type ServiciosFirebase = {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  functions: Functions;
};

/**
 * `emuladores` (solo pruebas, opción `--emuladores`): proyecto demo-caja en
 * los emuladores locales del banco. Por defecto, producción.
 */
export function crearFirebase(emuladores: boolean): ServiciosFirebase {
  const config = emuladores
    ? { ...CONFIG_PRODUCCION, projectId: "demo-caja", storageBucket: "demo-caja.appspot.com" }
    : CONFIG_PRODUCCION;
  const app = initializeApp(config);
  // La sesión se guarda (IndexedDB de la ventana): al prender la PC sigue
  // vinculada aunque todavía no haya internet.
  const auth = initializeAuth(app, { persistence: indexedDBLocalPersistence });
  // Sin copia local de la cola: siempre lo último del servidor.
  const db = initializeFirestore(app, { localCache: memoryLocalCache(), ignoreUndefinedProperties: true });
  const functions = getFunctions(app);
  if (emuladores) {
    connectAuthEmulator(auth, "http://127.0.0.1:9209", { disableWarnings: true });
    connectFirestoreEmulator(db, "127.0.0.1", 8301);
    connectFunctionsEmulator(functions, "127.0.0.1", 5111);
  }
  return { app, auth, db, functions };
}
