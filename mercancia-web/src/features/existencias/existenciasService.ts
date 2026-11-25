import { httpsCallable } from "firebase/functions";
import {
  collection,
  doc,
  getDocFromServer,
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
  veredictoEnvioPendiente,
  type DireccionMovimientoExistencias,
  type MovimientoExistencias,
  type RenglonMovimientoExistencias,
} from "@shared";
import type { LineaMover } from "./filasExistencias";

// ============================================================
// Mover piezas entre la bodega y la tienda (callable `moverExistencias`)
// ============================================================
// La function es todo o nada y no aplica dos veces el mismo `movimientoId`.
// Si se cae la conexión no se sabe si se movió: el reintento DEBE llevar el
// mismo id (y la misma lista); por eso el envío sin respuesta se guarda en
// este equipo hasta SABER en qué quedó: o la function contesta que se
// aplicó, o su registro (`consultarEnvio`) lo prueba, o ya pasó el tiempo
// en que podía aplicarse y no hay registro.

/** Lo que se manda (o se reintenta) en un movimiento. */
export type EnvioMover = {
  movimientoId: string;
  direccion: DireccionMovimientoExistencias;
  lineas: LineaMover[];
};

/** Un envío guardado mientras no se sabe en qué quedó. `enviadoMs`: cuándo
 *  salió su último intento sin respuesta (reloj de este equipo). */
export type EnvioPendiente = EnvioMover & { enviadoMs: number };

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

/** Respuestas con las que la function dice que ESTE intento no movió nada. */
const NO_SE_MOVIO = new Set([
  "functions/failed-precondition",
  "functions/invalid-argument",
  "functions/permission-denied",
  // El id ya es de un movimiento de otra persona: el nuestro no se aplicó.
  "functions/already-exists",
]);

/** La llamada ni siquiera llegó a la function (no existe, o la sesión ya no
 *  sirve): este intento tampoco movió nada. El mensaje del servidor viene en
 *  inglés, así que se dice aquí qué hacer. */
const NO_LLEGO: Record<string, string> = {
  "functions/not-found": "Mover piezas todavía no está disponible. Avisa al administrador.",
  "functions/unauthenticated": "Tu sesión venció. Sal y vuelve a entrar con tu PIN.",
};

export const MENSAJE_SIN_RESPUESTA =
  "Se cortó la conexión y no sabemos si se movió. Toca «Reintentar»: si ya se había movido, no se mueve dos veces.";

export type FalloMover = {
  /**
   * La function contestó: ESTE intento no movió nada. Ojo: si antes hubo un
   * intento sin respuesta, eso no dice nada de aquel. `false`: se cortó la
   * conexión y no se sabe si este intento se aplicó.
   */
  contesto: boolean;
  /** El id ya es de un movimiento de otra persona: este envío nunca se va a
   *  aplicar, ni en un intento anterior. */
  idAjeno: boolean;
  /** Por qué no se movió (si `contesto`), para mostrarlo. */
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
  return { contesto: false, idAjeno: false, mensaje: MENSAJE_SIN_RESPUESTA };
}

// ---------- Envío sin respuesta (guardado en este equipo) ----------

/** Quién mandó el envío: cada persona de cada sucursal tiene el suyo. */
export type DuenoEnvio = { negocioId: string; sucursalId: string; usuarioId: string };

function keyPendiente(d: DuenoEnvio): string {
  return `mercancia.movimientoPendiente.v1.${d.negocioId}.${d.sucursalId}.${d.usuarioId}`;
}

export function guardarPendiente(dueno: DuenoEnvio, envio: EnvioPendiente): void {
  try {
    localStorage.setItem(keyPendiente(dueno), JSON.stringify(envio));
  } catch {
    // storage bloqueado: el candado vive solo mientras siga abierta la página.
  }
}

/** El envío sin respuesta de esta persona en esta sucursal, si hay (lo pudo
 *  dejar esta pestaña u otra). */
export function leerPendiente(dueno: DuenoEnvio): EnvioPendiente | null {
  try {
    const raw = localStorage.getItem(keyPendiente(dueno));
    if (!raw) return null;
    const envio = JSON.parse(raw) as Partial<EnvioPendiente>;
    if (!envio.movimientoId || !envio.direccion || !Array.isArray(envio.lineas)) return null;
    return {
      movimientoId: envio.movimientoId,
      direccion: envio.direccion,
      lineas: envio.lineas,
      // Sin hora guardada se cuenta desde ahora: nunca se da por "no se
      // movió" antes de tiempo.
      enviadoMs: Number.isFinite(envio.enviadoMs) ? (envio.enviadoMs as number) : Date.now(),
    };
  } catch {
    return null;
  }
}

/** En qué quedó un envío sin respuesta, según su registro. */
export type EstadoEnvio =
  /** Sí se movió: así quedó (como lo contestaría la function). */
  | { tipo: "aplicado"; respuesta: RespuestaMover }
  /** No se movió nada y ya no se va a mover: la lista se puede cambiar. */
  | { tipo: "no-aplicado" }
  /** Todavía no se puede saber (sin conexión, o el intento aún podría llegar). */
  | { tipo: "sin-saber" };

/**
 * Averigua si un envío sin respuesta se aplicó leyendo, DEL SERVIDOR, el
 * registro del movimiento: la function lo guarda con el id del envío. Si
 * otra pestaña reintentó después, cuenta la hora de ese intento. Nunca
 * lanza: sin conexión contesta "sin-saber".
 */
export async function consultarEnvio(
  dueno: DuenoEnvio,
  movimientoId: string,
  enviadoMs: number,
): Promise<EstadoEnvio> {
  let existe = false;
  let registro: MovimientoExistencias | null = null;
  try {
    const snap = await getDocFromServer(
      doc(db, `${paths.movimientosExistenciasCol(dueno.negocioId, dueno.sucursalId)}/${movimientoId}`),
    );
    existe = snap.exists();
    registro = existe ? (snap.data() as MovimientoExistencias) : null;
  } catch {
    return { tipo: "sin-saber" };
  }
  const guardado = leerPendiente(dueno);
  const ultimoIntentoMs =
    guardado?.movimientoId === movimientoId ? Math.max(guardado.enviadoMs, enviadoMs) : enviadoMs;
  const veredicto = veredictoEnvioPendiente({
    existe,
    usuarioIdRegistro: registro?.usuarioId,
    usuarioId: dueno.usuarioId,
    enviadoMs: ultimoIntentoMs,
    ahoraMs: Date.now(),
  });
  if (veredicto === "aplicado" && registro) {
    return {
      tipo: "aplicado",
      respuesta: {
        ok: true,
        ya: true,
        direccion: registro.direccion,
        piezas: registro.piezas,
        renglones: registro.renglones,
      },
    };
  }
  return veredicto === "sin-saber" ? { tipo: "sin-saber" } : { tipo: "no-aplicado" };
}

export function borrarPendiente(dueno: DuenoEnvio): void {
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
