import { httpsCallable } from "firebase/functions";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  type Unsubscribe,
} from "firebase/firestore";
import { db, functions } from "@/firebase/config";
import {
  generarID,
  paths,
  type DireccionMovimientoExistencias,
  type MovimientoExistencias,
  type RenglonMovimientoExistencias,
} from "@shared";
import type { LineaMover } from "./filasExistencias";

// ============================================================
// Mover piezas entre la bodega y la tienda (callable `moverExistencias`)
// ============================================================
// La function es todo o nada y no aplica dos veces el mismo `movimientoId`.
// Si se cae la conexión no se sabe si se movió. Para saberlo se le pregunta
// a la MISMA function (`aclararEnvio`): si ya se aplicó contesta cómo quedó;
// si no, deja ese id ANULADO para siempre, de modo que un intento que llegue
// tarde ya no se puede aplicar. Solo entonces la lista se puede cambiar (y el
// siguiente envío lleva otro id). Mientras no se sepa, el envío se guarda en
// este equipo: sobrevive a cerrar la página.

/** Lo que se manda en un movimiento. */
export type EnvioMover = {
  movimientoId: string;
  direccion: DireccionMovimientoExistencias;
  lineas: LineaMover[];
};

export type RespuestaMover = {
  ok: true;
  /** El id ya se había aplicado: no se movió otra vez. */
  ya: boolean;
  direccion: DireccionMovimientoExistencias;
  piezas: number;
  renglones: RenglonMovimientoExistencias[];
};

type PeticionMover = {
  movimientoId: string;
  direccion: DireccionMovimientoExistencias;
  renglones: Array<{ articuloId: string; subvariacionCodigo?: string; piezas: number }>;
};

type PeticionAclarar = { movimientoId: string; anular: true };
type RespuestaAclarar = RespuestaMover | { ok: true; anulado: true };

/** Id para un envío nuevo (`/^[A-Za-z0-9_-]{8,48}$/` en la function). */
export function nuevoMovimientoId(): string {
  return `mov_${generarID()}`;
}

// La function corta a los 30 s; sin respuesta a los 40 s ya no va a llegar.
const moverCallable = httpsCallable<PeticionMover, RespuestaMover>(
  functions,
  "moverExistencias",
  { timeout: 40_000 },
);
const aclararCallable = httpsCallable<PeticionAclarar, RespuestaAclarar>(
  functions,
  "moverExistencias",
  { timeout: 40_000 },
);

export async function moverExistencias(envio: EnvioMover): Promise<RespuestaMover> {
  const { data } = await moverCallable({
    movimientoId: envio.movimientoId,
    direccion: envio.direccion,
    renglones: envio.lineas.map((l) => ({
      articuloId: l.articuloId,
      ...(l.subvariacionCodigo ? { subvariacionCodigo: l.subvariacionCodigo } : {}),
      piezas: l.piezas,
    })),
  });
  return data;
}

/** En qué quedó un envío que se había quedado sin respuesta. */
export type EnvioAclarado =
  /** Sí se movió: así quedó. */
  | { tipo: "aplicado"; respuesta: RespuestaMover }
  /** No se movió y ya no se va a mover: ese id quedó anulado. */
  | { tipo: "anulado" };

/**
 * Pregunta a la function por un envío sin respuesta. O ya se aplicó, o queda
 * anulado para siempre (un intento que llegue tarde no se aplica). Se puede
 * preguntar las veces que haga falta: siempre contesta lo mismo. Lanza si no
 * se pudo preguntar (ver `clasificarFallo`).
 */
export async function aclararEnvio(movimientoId: string): Promise<EnvioAclarado> {
  const { data } = await aclararCallable({ movimientoId, anular: true });
  if ("anulado" in data) return { tipo: "anulado" };
  return { tipo: "aplicado", respuesta: data };
}

/** Respuestas con las que la function dice que ESA llamada no movió nada. */
const NO_SE_MOVIO = new Set([
  "functions/failed-precondition",
  "functions/invalid-argument",
  "functions/permission-denied",
  // El id ya es de un movimiento de otra persona: el nuestro no se aplicó.
  "functions/already-exists",
]);

/** La llamada ni siquiera llegó a la function (no existe, o la sesión ya no
 *  sirve): tampoco movió nada. El mensaje del servidor viene en inglés, así
 *  que se dice aquí qué hacer. */
const NO_LLEGO: Record<string, string> = {
  "functions/not-found": "Mover piezas todavía no está disponible. Avisa al administrador.",
  "functions/unauthenticated": "Tu sesión venció. Sal y vuelve a entrar con tu PIN.",
};

export type FalloMover = {
  /**
   * La function contestó (o la llamada no llegó a entrar): ESA llamada no
   * movió nada. `false`: se cortó la conexión y no se sabe si se aplicó.
   */
  contesto: boolean;
  /** El id ya es de un movimiento de otra persona: este envío nunca se
   *  aplicó ni se va a aplicar. */
  idAjeno: boolean;
  /** Por qué (si `contesto`), para mostrarlo. */
  mensaje: string;
};

export function clasificarFallo(e: unknown): FalloMover {
  const code = (e as { code?: unknown } | null)?.code;
  if (typeof code === "string" && NO_LLEGO[code]) {
    return { contesto: true, idAjeno: false, mensaje: NO_LLEGO[code] };
  }
  if (typeof code === "string" && NO_SE_MOVIO.has(code)) {
    return {
      contesto: true,
      idAjeno: code === "functions/already-exists",
      mensaje: (e as Error).message || "No se movió nada.",
    };
  }
  return { contesto: false, idAjeno: false, mensaje: "" };
}

// ---------- Envío sin respuesta (guardado en este equipo) ----------

/** Quién mandó el envío: cada persona de cada sucursal tiene el suyo. */
export type DuenoEnvio = { negocioId: string; sucursalId: string; usuarioId: string };

function keyPendiente(d: DuenoEnvio): string {
  return `mercancia.movimientoPendiente.v1.${d.negocioId}.${d.sucursalId}.${d.usuarioId}`;
}

/** El envío sin aclarar de esta persona en esta sucursal, si hay (lo pudo
 *  dejar esta pestaña u otra). */
export function leerPendiente(dueno: DuenoEnvio): EnvioMover | null {
  try {
    const raw = localStorage.getItem(keyPendiente(dueno));
    if (!raw) return null;
    const envio = JSON.parse(raw) as Partial<EnvioMover>;
    if (!envio.movimientoId || !envio.direccion || !Array.isArray(envio.lineas)) return null;
    return {
      movimientoId: envio.movimientoId,
      direccion: envio.direccion,
      lineas: envio.lineas,
    };
  } catch {
    return null;
  }
}

/**
 * Guarda el envío que va a salir. NO pisa el de otro envío que siga sin
 * aclarar (lo dejó otra pestaña): devuelve `false` y hay que aclarar aquel
 * primero. Si el almacenamiento está bloqueado no guarda nada y devuelve
 * `true`: el candado vive solo mientras siga abierta la página.
 */
export function guardarPendiente(dueno: DuenoEnvio, envio: EnvioMover): boolean {
  const previo = leerPendiente(dueno);
  if (previo && previo.movimientoId !== envio.movimientoId) return false;
  try {
    localStorage.setItem(keyPendiente(dueno), JSON.stringify(envio));
  } catch {
    // storage bloqueado
  }
  return true;
}

/** Quita el envío guardado, solo si es ESE: otra pestaña pudo dejar otro. */
export function borrarPendiente(dueno: DuenoEnvio, movimientoId: string): void {
  const previo = leerPendiente(dueno);
  if (previo && previo.movimientoId !== movimientoId) return;
  try {
    localStorage.removeItem(keyPendiente(dueno));
  } catch {
    // storage bloqueado: no hay nada guardado.
  }
}

// ---------- Registro de movimientos ----------

/** Los últimos 50 movimientos de la sucursal, el más nuevo primero. */
export function escucharMovimientos(
  negocioId: string,
  sucursalId: string,
  onDatos: (movimientos: MovimientoExistencias[]) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, paths.movimientosExistenciasCol(negocioId, sucursalId)),
    orderBy("creadoEn", "desc"),
    limit(50),
  );
  return onSnapshot(
    q,
    (snap) => onDatos(snap.docs.map((d) => d.data() as MovimientoExistencias)),
    onError,
  );
}
