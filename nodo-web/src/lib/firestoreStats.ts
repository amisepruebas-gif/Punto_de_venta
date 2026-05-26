/**
 * Re-export shim — la implementación real vive en `traficoFirestore.ts`.
 * Mantengo este archivo para no romper imports existentes y porque la UI
 * de Ajustes lo conoce con este nombre.
 */
export {
  trackSnapshot,
  flush as flushFirestoreStats,
  useFirestoreStats,
  traficoStorage,
  inicializarTraficoFirestore,
  agruparPorDoc,
  chainPartes,
  expandirDescargas,
} from "./traficoFirestore";

export type {
  TraficoEvento,
  TraficoColeccion,
  TraficoDia,
  DocAgrupado,
  Descarga,
} from "./traficoFirestore";
