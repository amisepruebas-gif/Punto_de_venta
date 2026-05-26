import { create } from "zustand";

/**
 * Tracker global de snapshots Firestore: cuántos vinieron de caché local
 * (IndexedDB) vs de la nube (server). Se muestra en /ajustes como
 * indicador del trabajo del persistent cache.
 */
type State = {
  cacheHits: number;
  serverHits: number;
  lastResetAt: number;
  incCache: () => void;
  incServer: () => void;
  reset: () => void;
};

export const useFirestoreStats = create<State>((set) => ({
  cacheHits: 0,
  serverHits: 0,
  lastResetAt: Date.now(),
  incCache: () => set((s) => ({ cacheHits: s.cacheHits + 1 })),
  incServer: () => set((s) => ({ serverHits: s.serverHits + 1 })),
  reset: () => set({ cacheHits: 0, serverHits: 0, lastResetAt: Date.now() }),
}));

/**
 * Contabiliza un snapshot según su metadata.fromCache.
 *
 * IMPORTANTE: el hook debe crear el listener con `{ includeMetadataChanges: true }`
 * para que dispare el callback también cuando cambia la metadata sola (p. ej.
 * primera emisión desde cache + re-emisión al sync con server). Sin esa flag,
 * sólo se contabilizará la emisión inicial.
 */
export function trackSnapshot(snap: {
  metadata?: { fromCache?: boolean };
}): void {
  const s = useFirestoreStats.getState();
  if (snap?.metadata?.fromCache) s.incCache();
  else s.incServer();
}
