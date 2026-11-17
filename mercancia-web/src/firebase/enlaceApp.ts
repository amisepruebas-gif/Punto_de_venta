// ============================================================
// Sesión de un teléfono que entra por un enlace de lote (`/enlace/...`)
// ============================================================
//
// Quien abre el enlace NO tiene cuenta: canjea el secreto de la URL en la
// function `canjearEnlaceLote` y recibe un token con el rol `enlace`.
//
// Todo va en una app de Firebase CON NOMBRE (`enlace-{enlaceId}`), aparte de
// la de `config.ts`: así no se mezcla con la sesión de PIN que pueda tener
// el mismo navegador (ni su caché persistente), y dos enlaces distintos en el
// mismo teléfono tampoco se pisan. Por eso nada de aquí usa el `db` de
// `config.ts` ni sus hooks.

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  browserSessionPersistence,
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
  setPersistence,
  signInWithCustomToken,
  signOut,
  type Auth,
} from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  type Firestore,
} from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getFunctions, httpsCallable, type Functions } from "firebase/functions";
import { secretoDeFragmento, type EnlaceLoteTipo } from "@shared";
import { firebaseConfig } from "./config";

// ---------- Servicios ----------

export type ServiciosEnlace = {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  storage: FirebaseStorage;
  functions: Functions;
};

const servicios = new Map<string, ServiciosEnlace>();

/**
 * Los cuatro servicios de la app del enlace, creados juntos en un solo lugar
 * (aquí se conecta después el banco de pruebas con emuladores).
 *
 * Persistencia de la sesión: `armar` en IndexedDB (dura hasta que admin
 * apague el acceso) y `recibir` en sessionStorage (son 30 minutos: se va al
 * cerrar la pestaña). Al crear la app todavía no se sabe el tipo, así que se
 * buscan las dos; al canjear se fija la que toca con `setPersistence`. La
 * de sesión no permite "migrar", así que una sesión de fotos nunca pasa a
 * IndexedDB.
 */
function crearServicios(app: FirebaseApp): Omit<ServiciosEnlace, "app"> {
  const auth = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserSessionPersistence],
  });
  // Memoria y no caché persistente: el teléfono lee de una vez (sin
  // listeners) y no debe quedar copia del lote en el aparato.
  const db = initializeFirestore(app, {
    ignoreUndefinedProperties: true,
    localCache: memoryLocalCache(),
  });
  const storage = getStorage(app);
  const functions = getFunctions(app);
  return { auth, db, storage, functions };
}

/** Servicios del enlace (memoizados: una app por enlace). */
export function serviciosEnlace(enlaceId: string): ServiciosEnlace {
  const ya = servicios.get(enlaceId);
  if (ya) return ya;
  const nombre = `enlace-${enlaceId}`;
  // Con HMR (desarrollo) el módulo se recarga pero la app sigue registrada
  // y sus servicios ya están inicializados: se toman tal cual.
  const existente = getApps().find((a) => a.name === nombre);
  const s: ServiciosEnlace = existente
    ? {
        app: existente,
        auth: getAuth(existente),
        db: getFirestore(existente),
        storage: getStorage(existente),
        functions: getFunctions(existente),
      }
    : (() => {
        const app = initializeApp(firebaseConfig, nombre);
        return { app, ...crearServicios(app) };
      })();
  servicios.set(enlaceId, s);
  return s;
}

// ---------- La sesión ----------

export type SesionEnlace = {
  negocioId: string;
  enlaceId: string;
  uid: string;
  tipo: EnlaceLoteTipo;
  /** Nombre del acceso ("Taller Puebla"). Puede venir vacío. */
  nombre: string;
  /** Solo `armar`: letra(s) del acceso en el código de sus lotes. */
  letra?: string;
  /** Solo `recibir`: el lote de las fotos. */
  resurtidoId?: string;
  folio?: string;
  sucursalDestinoNombre?: string;
  /** Vencimiento (ms, hora del servidor). */
  venceMs: number;
  /** Hora del servidor − hora del teléfono al entrar. El tiempo restante se
   *  cuenta con esto: el reloj del teléfono puede estar mal. */
  desfaseMs: number;
  auth: Auth;
  db: Firestore;
  storage: FirebaseStorage;
};

/** Lo que se guarda para poder recargar la página (nada secreto). */
type MetaSesion = Pick<
  SesionEnlace,
  | "uid"
  | "tipo"
  | "nombre"
  | "letra"
  | "resurtidoId"
  | "folio"
  | "sucursalDestinoNombre"
  | "venceMs"
  | "desfaseMs"
>;

const claveMeta = (negocioId: string, enlaceId: string) =>
  `enlace.sesion.v1:${negocioId}:${enlaceId}`;

/** armar → localStorage (como su sesión); recibir → sessionStorage. */
function almacen(tipo: EnlaceLoteTipo): Storage | null {
  try {
    return tipo === "armar" ? window.localStorage : window.sessionStorage;
  } catch {
    return null; // almacenamiento bloqueado: la sesión vive solo en memoria
  }
}

function guardarMeta(negocioId: string, enlaceId: string, meta: MetaSesion) {
  try {
    almacen(meta.tipo)?.setItem(claveMeta(negocioId, enlaceId), JSON.stringify(meta));
  } catch {
    /* sin espacio o bloqueado: no pasa nada, solo no sobrevive a recargar */
  }
}

function leerMeta(negocioId: string, enlaceId: string): MetaSesion | null {
  for (const tipo of ["armar", "recibir"] as const) {
    try {
      const raw = almacen(tipo)?.getItem(claveMeta(negocioId, enlaceId));
      if (raw) return JSON.parse(raw) as MetaSesion;
    } catch {
      /* dato corrupto: se arma con los claims */
    }
  }
  return null;
}

function borrarMeta(negocioId: string, enlaceId: string) {
  for (const tipo of ["armar", "recibir"] as const) {
    try {
      almacen(tipo)?.removeItem(claveMeta(negocioId, enlaceId));
    } catch {
      /* nada */
    }
  }
}

/** Hora del servidor (aprox.) según el desfase medido al entrar. */
export function ahoraServidor(s: Pick<SesionEnlace, "desfaseMs">): Date {
  return new Date(Date.now() + s.desfaseMs);
}

/** Milisegundos que le quedan a la sesión (0 si ya venció). */
export function tiempoRestanteMs(s: Pick<SesionEnlace, "venceMs" | "desfaseMs">): number {
  return Math.max(0, s.venceMs - ahoraServidor(s).getTime());
}

// ---------- El secreto de la URL ----------

/** Secretos leídos de la barra, por enlace. Solo en memoria. */
const secretos = new Map<string, string>();

/**
 * Lee el secreto del fragmento (`#...`) y lo borra de la barra en ese mismo
 * momento, para que no quede en el historial ni se comparta por error al
 * copiar la dirección. Se queda solo en memoria. Se puede llamar varias
 * veces (React en modo estricto monta dos veces): la segunda ya no lo
 * encuentra en la barra pero sí en memoria.
 */
export function tomarSecretoDeLaBarra(enlaceId: string): string | null {
  const s = secretoDeFragmento(window.location.hash);
  if (s) {
    secretos.set(enlaceId, s);
    try {
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname + window.location.search,
      );
    } catch {
      /* algunos navegadores internos no dejan: el secreto sigue en memoria */
    }
  }
  return secretos.get(enlaceId) ?? null;
}

/** La URL completa (con secreto) para copiarla y abrirla en otro navegador. */
export function urlCompletaEnMemoria(enlaceId: string): string | null {
  const s = secretos.get(enlaceId);
  return s ? `${window.location.origin}${window.location.pathname}#${s}` : null;
}

// ---------- Entrar / recuperar / salir ----------

type RespuestaCanje = {
  token: string;
  uid: string;
  tipo: EnlaceLoteTipo;
  nombre?: string;
  ahoraMs: number;
  venceMs: number;
  letra?: string;
  resurtidoId?: string;
  folio?: string;
  sucursalDestinoNombre?: string;
};

function armarSesion(
  negocioId: string,
  enlaceId: string,
  sv: ServiciosEnlace,
  meta: MetaSesion,
): SesionEnlace {
  return { negocioId, enlaceId, ...meta, auth: sv.auth, db: sv.db, storage: sv.storage };
}

/**
 * Canjea el secreto por una sesión. Se llama cuando la persona toca
 * "Entrar", no al cargar: así puede pasar el enlace de WhatsApp a Chrome
 * sin gastarlo (el de armar sirve para UN teléfono).
 */
export async function entrarConEnlace(
  negocioId: string,
  enlaceId: string,
  secreto: string,
): Promise<SesionEnlace> {
  const sv = serviciosEnlace(enlaceId);
  const antes = Date.now();
  const r = await httpsCallable<
    { negocioId: string; enlaceId: string; secreto: string },
    RespuestaCanje
  >(sv.functions, "canjearEnlaceLote")({ negocioId, enlaceId, secreto });
  const d = r.data;
  // El desfase se mide contra la mitad del viaje: la hora del servidor es
  // de cuando procesó la llamada, no de cuando llegó la respuesta.
  const medio = antes + (Date.now() - antes) / 2;
  try {
    await setPersistence(
      sv.auth,
      d.tipo === "armar" ? indexedDBLocalPersistence : browserSessionPersistence,
    );
  } catch {
    // Navegador sin IndexedDB (modo privado…): se queda con la que haya; lo
    // peor es tener que volver a entrar al recargar.
  }
  await signInWithCustomToken(sv.auth, d.token);
  const meta: MetaSesion = {
    uid: d.uid,
    tipo: d.tipo,
    nombre: d.nombre ?? "",
    ...(d.letra ? { letra: d.letra } : {}),
    ...(d.resurtidoId ? { resurtidoId: d.resurtidoId } : {}),
    ...(d.folio ? { folio: d.folio } : {}),
    ...(d.sucursalDestinoNombre ? { sucursalDestinoNombre: d.sucursalDestinoNombre } : {}),
    venceMs: d.venceMs,
    desfaseMs: Math.round(d.ahoraMs - medio),
  };
  guardarMeta(negocioId, enlaceId, meta);
  return armarSesion(negocioId, enlaceId, sv, meta);
}

/**
 * La sesión que ya estaba (recargar la página, volver mañana al taller).
 * Lo que manda son los claims del token; lo guardado solo completa lo que
 * no viene en ellos (nombre, folio, sucursal y el desfase del reloj).
 */
export async function recuperarSesion(
  negocioId: string,
  enlaceId: string,
): Promise<SesionEnlace | null> {
  const sv = serviciosEnlace(enlaceId);
  await sv.auth.authStateReady();
  const user = sv.auth.currentUser;
  if (!user) {
    borrarMeta(negocioId, enlaceId);
    return null;
  }
  const { claims } = await user.getIdTokenResult();
  if (
    claims.role !== "enlace" ||
    claims.enlaceId !== enlaceId ||
    claims.negocioId !== negocioId ||
    (claims.tipo !== "armar" && claims.tipo !== "recibir")
  ) {
    await signOut(sv.auth).catch(() => undefined);
    borrarMeta(negocioId, enlaceId);
    return null;
  }
  const tipo = claims.tipo as EnlaceLoteTipo;
  const guardada = leerMeta(negocioId, enlaceId);
  const meta: MetaSesion = {
    uid: user.uid,
    tipo,
    nombre: guardada?.nombre ?? "",
    ...(typeof claims.letra === "string" ? { letra: claims.letra } : {}),
    ...(typeof claims.resurtidoId === "string" ? { resurtidoId: claims.resurtidoId } : {}),
    ...(guardada?.folio ? { folio: guardada.folio } : {}),
    ...(guardada?.sucursalDestinoNombre
      ? { sucursalDestinoNombre: guardada.sucursalDestinoNombre }
      : {}),
    venceMs: Number(claims.vence) || 0,
    desfaseMs: guardada?.desfaseMs ?? 0,
  };
  return armarSesion(negocioId, enlaceId, sv, meta);
}

/** Cierra la sesión de este enlace en el teléfono (no toca la de PIN). */
export async function salirDelEnlace(negocioId: string, enlaceId: string): Promise<void> {
  borrarMeta(negocioId, enlaceId);
  const sv = servicios.get(enlaceId);
  if (sv) await signOut(sv.auth).catch(() => undefined);
}

// ---------- Errores ----------

export const MENSAJE_APAGADO =
  "Este acceso está apagado o ya no sirve. Pide al administrador que lo prenda o te mande uno nuevo.";
export const MENSAJE_SIN_INTERNET =
  "No hay internet. No se guardó: revisa la señal y vuelve a intentar.";

/** Error con un texto listo para mostrar. */
export class ErrorEnlace extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorEnlace";
  }
}

function codigoDe(e: unknown): string {
  return typeof e === "object" && e && "code" in e ? String((e as { code: unknown }).code) : "";
}

/** Firestore o Storage dijeron que no hay permiso (acceso apagado, renovado
 *  o vencido). */
export function esPermisoDenegado(e: unknown): boolean {
  const c = codigoDe(e);
  return c === "permission-denied" || c === "storage/unauthorized" || c === "storage/unauthenticated";
}

export function esSinInternet(e: unknown): boolean {
  const c = codigoDe(e);
  return (
    c === "unavailable" ||
    c === "deadline-exceeded" ||
    c === "storage/retry-limit-exceeded" ||
    c === "functions/unavailable" ||
    c === "functions/deadline-exceeded" ||
    // Una red caída en una callable llega como "internal" sin más.
    (c === "functions/internal" && /^internal$/i.test((e as Error).message ?? ""))
  );
}

/** Antes de escribir: sin red no se intenta (Firestore lo dejaría colgado). */
export function exigirInternet(): void {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new ErrorEnlace(MENSAJE_SIN_INTERNET);
  }
}

/** Texto para la pantalla a partir de cualquier error. */
export function mensajeDeError(e: unknown): string {
  if (e instanceof ErrorEnlace) return e.message;
  if (esPermisoDenegado(e)) return MENSAJE_APAGADO;
  if (esSinInternet(e)) return MENSAJE_SIN_INTERNET;
  const c = codigoDe(e);
  // Los mensajes de la function ya vienen en español sencillo.
  if (c.startsWith("functions/") && e instanceof Error && e.message) return e.message;
  if (e instanceof Error && e.message) return `Algo falló: ${e.message}`;
  return "Algo falló. Vuelve a intentar.";
}
