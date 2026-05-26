/**
 * Telemetría Firestore detallada con historial diario.
 *
 *  - Captura cada `onSnapshot` con: path, fromCache, totalDocs y desglose
 *    de `docChanges()` (added/modified/removed) → permite distinguir
 *    descargas "completas" vs "parciales" (deltas).
 *  - Agrega por colección y por día.
 *  - Persiste el día actual cada 30s + en `visibilitychange:hidden` y
 *    `beforeunload`. Almacena en filesystem privado de la APK vía
 *    `PosBridge` (sobrevive limpieza del WebView). Fallback `localStorage`.
 *  - Auto-cleanup de archivos > 90 días al inicializar.
 *
 * Llamadas:
 *   - `trackSnapshot(snap, "<path-label>")` desde cada onSnapshot.
 *   - `useFirestoreStats()` para leer el día actual reactivamente.
 *   - `traficoStorage.{leer, listarDias}` para historial.
 */

import { create } from "zustand";
import { ymdMX } from "@shared";
import { posDisponible } from "./pos-bridge";

// ============================================================
// Tipos
// ============================================================

export type TraficoEvento = {
  /** Date.now() del snapshot */
  ts: number;
  /** Etiqueta legible del path (ej. "articulos_n", "mensajes/2026/4/25"). */
  path: string;
  fromCache: boolean;
  /** Tamaño total del result-set (snap.size). */
  totalDocs: number;
  added: number;
  modified: number;
  removed: number;
  /** true cuando el snap viene del servidor pero solo trajo deltas. */
  parcial: boolean;
  /** IDs de los documentos que cambiaron (added/modified/removed) en este
   *  snapshot. Para DocumentSnapshot es `[doc.id]`. Capeado a `MAX_DOC_IDS`
   *  para no inflar el archivo del día. */
  docIds?: string[];
  /** Cantidad de IDs adicionales no incluidos en `docIds` (cuando se
   *  alcanzó el cap). */
  docIdsExtra?: number;
};

export type TraficoColeccion = {
  path: string;
  snapshots: number;
  /** Suma de added+modified de snapshots NO-cache. */
  docsServer: number;
  /** Suma de totalDocs de snapshots fromCache. */
  docsCache: number;
  /** Snaps server con todo el set fresco (deltas == totalDocs). */
  completas: number;
  /** Snaps server con deltas < totalDocs. */
  parciales: number;
  ultimoTs: number;
};

export type DocAgrupado = {
  /** Path (label) tal como lo pasó el caller. */
  path: string;
  /** ID del documento dentro de ese path. */
  docId: string;
  /** Total de veces que este (path, docId) apareció en un snapshot. */
  count: number;
  /** Apariciones donde el snapshot fue resuelto desde cache local. */
  cache: number;
  /** Apariciones donde el snapshot vino del servidor (red). */
  server: number;
  ultimoTs: number;
};

/**
 * Agrupa los eventos del día por par (path, docId) y devuelve la lista
 * ordenada por cantidad de descargas descendente. Solo cuenta eventos
 * que tienen `docIds` (los anteriores a la captura de IDs se omiten).
 */
export function agruparPorDoc(eventos: TraficoEvento[]): DocAgrupado[] {
  const map = new Map<string, DocAgrupado>();
  for (const e of eventos) {
    const ids = e.docIds ?? [];
    for (const id of ids) {
      const key = `${e.path}|${id}`;
      let cur = map.get(key);
      if (!cur) {
        cur = {
          path: e.path,
          docId: id,
          count: 0,
          cache: 0,
          server: 0,
          ultimoTs: 0,
        };
        map.set(key, cur);
      }
      cur.count += 1;
      if (e.fromCache) cur.cache += 1;
      else cur.server += 1;
      if (e.ts > cur.ultimoTs) cur.ultimoTs = e.ts;
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

/**
 * Devuelve los segmentos del breadcrumb visual de un (path, docId).
 * Si el último segmento del `path` ya es `docId`, no lo duplica
 * (caso típico de DocumentSnapshot donde el path label incluye el id).
 *
 * Limpia el sufijo `_web_new_version` para legibilidad — todos los
 * collections usan ese suffix y aporta ruido visual.
 */
export function chainPartes(path: string, docId: string): string[] {
  const limpiar = (s: string) => s.replace(/_web_new_version$/, "");
  const segs = path.split("/").filter(Boolean).map(limpiar);
  const id = limpiar(docId);
  if (segs[segs.length - 1] === id) return segs;
  return [...segs, id];
}

/** Una descarga individual desde el servidor — un documento concreto. */
export type Descarga = {
  ts: number;
  path: string;
  docId: string;
};

/**
 * Convierte la lista de eventos en una lista plana de descargas
 * individuales (una entrada por documento bajado del servidor). Se
 * ignoran los eventos `fromCache` (no son descargas reales). Ordena
 * descendente por timestamp.
 */
export function expandirDescargas(eventos: TraficoEvento[]): Descarga[] {
  const out: Descarga[] = [];
  for (const e of eventos) {
    if (e.fromCache) continue;
    const ids = e.docIds ?? [];
    for (const id of ids) {
      out.push({ ts: e.ts, path: e.path, docId: id });
    }
  }
  out.sort((a, b) => b.ts - a.ts);
  return out;
}

export type TraficoDia = {
  ymd: string; // "YYYY-MM-DD"
  totalEventos: number;
  totalDocsServidor: number;
  totalDocsCache: number;
  porColeccion: Record<string, TraficoColeccion>;
  /** Eventos individuales. Capeado a `MAX_EVENTOS_DIA` por archivo (los más recientes). */
  eventos: TraficoEvento[];
};

// ============================================================
// Constantes
// ============================================================

const MAX_EVENTOS_DIA = 5000;
const FLUSH_MS = 30_000;
const RETENER_DIAS = 90;
// Cap de IDs por snapshot. Subimos a 500 porque colecciones grandes
// (e.g., articulos_n inicial) traen cientos de docs y antes el cap=50
// hacía que la lista de Descargas subreportara comparado con la cifra
// grande "Docs descargados de la red".
const MAX_DOC_IDS = 500;

// ============================================================
// Helpers de fecha
// ============================================================

function ymdHoy(): string {
  const { y, m, d } = ymdMX();
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function emptyDia(ymd: string): TraficoDia {
  return {
    ymd,
    totalEventos: 0,
    totalDocsServidor: 0,
    totalDocsCache: 0,
    porColeccion: {},
    eventos: [],
  };
}

// ============================================================
// Store (Zustand) — el día actual en memoria
// ============================================================

type Store = {
  diaActual: TraficoDia;
  registrarEvento: (ev: TraficoEvento) => void;
  reset: () => void;
};

export const useFirestoreStats = create<Store>((set, get) => ({
  diaActual: emptyDia(ymdHoy()),

  registrarEvento: (ev) => {
    const ymd = ymdHoy();
    const prev = get().diaActual;

    // Roll-over de día. Flushea el día anterior y arranca uno nuevo.
    let dia: TraficoDia;
    if (prev.ymd !== ymd) {
      void traficoStorage.escribir(prev.ymd, prev);
      dia = emptyDia(ymd);
    } else {
      dia = { ...prev };
    }

    // Acumula totales del día.
    dia.totalEventos += 1;
    if (ev.fromCache) {
      dia.totalDocsCache += ev.totalDocs;
    } else {
      dia.totalDocsServidor += ev.added + ev.modified;
    }

    // Eventos: append + cap.
    dia.eventos =
      dia.eventos.length >= MAX_EVENTOS_DIA
        ? [...dia.eventos.slice(-MAX_EVENTOS_DIA + 1), ev]
        : [...dia.eventos, ev];

    // Acumula por colección.
    const col: TraficoColeccion = dia.porColeccion[ev.path]
      ? { ...dia.porColeccion[ev.path] }
      : {
          path: ev.path,
          snapshots: 0,
          docsServer: 0,
          docsCache: 0,
          completas: 0,
          parciales: 0,
          ultimoTs: 0,
        };
    col.snapshots += 1;
    if (ev.fromCache) {
      col.docsCache += ev.totalDocs;
    } else {
      col.docsServer += ev.added + ev.modified;
      if (ev.parcial) col.parciales += 1;
      else col.completas += 1;
    }
    col.ultimoTs = ev.ts;
    dia.porColeccion = { ...dia.porColeccion, [ev.path]: col };

    set({ diaActual: dia });
    scheduleFlush();
  },

  reset: () => set({ diaActual: emptyDia(ymdHoy()) }),
}));

// ============================================================
// API pública: trackSnapshot
// ============================================================

type SnapLike = {
  metadata?: { fromCache?: boolean };
  // QuerySnapshot
  size?: number;
  docs?: ArrayLike<unknown>;
  docChanges?: () => readonly {
    type: "added" | "modified" | "removed";
    doc?: { id?: string };
  }[];
  empty?: boolean;
  // DocumentSnapshot
  exists?: () => boolean;
  id?: string;
};

/**
 * Registra un snapshot. El listener debe crearse con
 * `{ includeMetadataChanges: true }` para que `fromCache` distinga entre
 * cache y servidor.
 *
 * `path` debe ser una etiqueta legible y estable que identifique la query
 * (ej. "articulos_n", "negocio", "mensajes/2026/4/25"). Se usa como clave
 * de agregación por colección.
 *
 * Maneja tanto `QuerySnapshot` (con `size` + `docChanges`) como
 * `DocumentSnapshot` (con `exists()`). Para docs individuales, cada
 * delivery del servidor se contabiliza como `modified=1`.
 */
export function trackSnapshot(snap: SnapLike, path: string): void {
  const fromCache = !!snap?.metadata?.fromCache;
  const tieneDocChanges = typeof snap?.docChanges === "function";
  const esDocSnap =
    !tieneDocChanges && typeof snap?.exists === "function";

  let totalDocs = 0;
  let added = 0,
    modified = 0,
    removed = 0;
  const ids: string[] = [];
  let idsExtra = 0;

  if (esDocSnap) {
    totalDocs = snap.exists?.() ? 1 : 0;
    if (!fromCache) modified = totalDocs;
    if (totalDocs > 0 && snap.id) ids.push(snap.id);
  } else {
    totalDocs =
      typeof snap?.size === "number" ? snap.size : snap?.docs?.length ?? 0;
    if (tieneDocChanges) {
      const changes = snap.docChanges!();
      for (const c of changes) {
        if (c.type === "added") added++;
        else if (c.type === "modified") modified++;
        else if (c.type === "removed") {
          removed++;
          continue; // No registrar removidos como "descarga".
        }
        // Solo capturar IDs de added + modified (= "descargas" reales).
        // Esto mantiene consistencia con `dia.totalDocsServidor` que
        // tampoco cuenta removed.
        const id = c.doc?.id;
        if (id) {
          if (ids.length < MAX_DOC_IDS) ids.push(id);
          else idsExtra++;
        }
      }
    }
  }

  const cambios = added + modified + removed;
  const parcial = !fromCache && totalDocs > 0 && cambios < totalDocs;

  useFirestoreStats.getState().registrarEvento({
    ts: Date.now(),
    path,
    fromCache,
    totalDocs,
    added,
    modified,
    removed,
    parcial,
    ...(ids.length > 0 ? { docIds: ids } : {}),
    ...(idsExtra > 0 ? { docIdsExtra: idsExtra } : {}),
  });
}

// ============================================================
// Persistencia (APK bridge + localStorage fallback)
// El tipado de `window.POS.trafico*` vive en `pos-bridge.ts` (NativePOS).
// ============================================================

export const traficoStorage = {
  async escribir(ymd: string, dia: TraficoDia): Promise<void> {
    const json = JSON.stringify(dia);
    if (
      posDisponible() &&
      typeof window.POS?.traficoEscribir === "function"
    ) {
      try {
        window.POS!.traficoEscribir!(ymd, json);
        return;
      } catch (e) {
        console.warn("Bridge traficoEscribir → fallback localStorage:", e);
      }
    }
    try {
      localStorage.setItem(`trafico:${ymd}`, json);
    } catch (e) {
      console.warn("localStorage trafico falló:", e);
    }
  },

  async leer(ymd: string): Promise<TraficoDia | null> {
    if (posDisponible() && typeof window.POS?.traficoLeer === "function") {
      try {
        const raw = window.POS!.traficoLeer!(ymd);
        if (raw) return JSON.parse(raw) as TraficoDia;
      } catch (e) {
        console.warn("Bridge traficoLeer:", e);
      }
    }
    try {
      const raw = localStorage.getItem(`trafico:${ymd}`);
      return raw ? (JSON.parse(raw) as TraficoDia) : null;
    } catch {
      return null;
    }
  },

  async listarDias(): Promise<string[]> {
    if (
      posDisponible() &&
      typeof window.POS?.traficoListarDias === "function"
    ) {
      try {
        const raw = window.POS!.traficoListarDias!();
        if (raw) return (JSON.parse(raw) as string[]).sort();
      } catch (e) {
        console.warn("Bridge traficoListarDias:", e);
      }
    }
    const dias: string[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith("trafico:")) dias.push(k.slice("trafico:".length));
      }
    } catch {
      /* noop */
    }
    return dias.sort();
  },

  async borrar(ymd: string): Promise<void> {
    if (posDisponible() && typeof window.POS?.traficoBorrar === "function") {
      try {
        window.POS!.traficoBorrar!(ymd);
        return;
      } catch (e) {
        console.warn("Bridge traficoBorrar:", e);
      }
    }
    try {
      localStorage.removeItem(`trafico:${ymd}`);
    } catch {
      /* noop */
    }
  },

  async borrarAntiguos(diasMax: number): Promise<void> {
    const limite = new Date();
    limite.setDate(limite.getDate() - diasMax);
    const limiteYmd = `${limite.getFullYear()}-${String(
      limite.getMonth() + 1,
    ).padStart(2, "0")}-${String(limite.getDate()).padStart(2, "0")}`;
    const dias = await this.listarDias();
    for (const ymd of dias) {
      if (ymd < limiteYmd) await this.borrar(ymd);
    }
  },
};

// ============================================================
// Flush diferido + lifecycle
// ============================================================

let flushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush().catch(console.error);
  }, FLUSH_MS);
}

export async function flush(): Promise<void> {
  const dia = useFirestoreStats.getState().diaActual;
  if (dia.totalEventos === 0) return;
  await traficoStorage.escribir(dia.ymd, dia);
}

let inicializado = false;

/**
 * Carga el día actual desde almacenamiento (warm start), registra cleanup
 * de archivos antiguos y attach de listeners de visibilidad. Idempotente.
 */
export async function inicializarTraficoFirestore(): Promise<void> {
  if (inicializado) return;
  inicializado = true;

  try {
    const ymd = ymdHoy();
    const existing = await traficoStorage.leer(ymd);
    if (existing) {
      useFirestoreStats.setState({ diaActual: existing });
    }
  } catch (e) {
    console.warn("inicializarTraficoFirestore.leer:", e);
  }

  traficoStorage.borrarAntiguos(RETENER_DIAS).catch(() => {});

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) flush().catch(() => {});
    });
  }
  if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", () => {
      flush().catch(() => {});
    });
  }
}
