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
// Si se cae la conexión no se sabe si se movió: el reintento DEBE llevar el
// mismo id (y la misma lista); por eso el envío sin respuesta se guarda en
// este equipo hasta que la function conteste.

/** Lo que se manda (o se reintenta) en un movimiento. */
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

/** Respuestas con las que la function dice que NO movió nada: la lista se
 *  puede corregir y mandar con un id nuevo. Cualquier otro error deja el
 *  resultado en duda. */
const NO_SE_MOVIO = new Set([
  "functions/failed-precondition",
  "functions/invalid-argument",
  "functions/permission-denied",
  // El id ya es de un movimiento de otra persona: el nuestro no se aplicó.
  "functions/already-exists",
]);

/** La llamada ni siquiera llegó a la function (no existe, o la sesión ya no
 *  sirve): tampoco se movió nada. El mensaje del servidor viene en inglés,
 *  así que se dice aquí qué hacer. */
const NO_LLEGO: Record<string, string> = {
  "functions/not-found":
    "No se movió nada: mover piezas todavía no está disponible. Avisa al administrador.",
  "functions/unauthenticated":
    "No se movió nada: tu sesión venció. Sal y vuelve a entrar con tu PIN.",
};

export type FalloMover = {
  /** `rechazo`: no se movió nada. `duda`: no se sabe si se movió. */
  tipo: "rechazo" | "duda";
  mensaje: string;
};

export function clasificarFallo(e: unknown): FalloMover {
  const code = (e as { code?: unknown } | null)?.code;
  if (typeof code === "string" && NO_SE_MOVIO.has(code)) {
    return { tipo: "rechazo", mensaje: (e as Error).message || "No se movió nada." };
  }
  if (typeof code === "string" && NO_LLEGO[code]) {
    return { tipo: "rechazo", mensaje: NO_LLEGO[code] };
  }
  return {
    tipo: "duda",
    mensaje:
      "Se cortó la conexión y no sabemos si se movió. Toca «Reintentar»: si ya se había movido, no se mueve dos veces.",
  };
}

// ---------- Envío sin respuesta (guardado en este equipo) ----------

/** Quién mandó el envío: cada persona de cada sucursal tiene el suyo. */
export type DuenoEnvio = { negocioId: string; sucursalId: string; usuarioId: string };

function keyPendiente(d: DuenoEnvio): string {
  return `mercancia.movimientoPendiente.v1.${d.negocioId}.${d.sucursalId}.${d.usuarioId}`;
}

export function guardarPendiente(dueno: DuenoEnvio, envio: EnvioMover): void {
  try {
    localStorage.setItem(keyPendiente(dueno), JSON.stringify(envio));
  } catch {
    // storage bloqueado: el candado vive solo mientras siga abierta la página.
  }
}

/** El envío sin respuesta de esta persona en esta sucursal, si hay. */
export function leerPendiente(dueno: DuenoEnvio): EnvioMover | null {
  try {
    const raw = localStorage.getItem(keyPendiente(dueno));
    if (!raw) return null;
    const envio = JSON.parse(raw) as EnvioMover;
    return envio.movimientoId && Array.isArray(envio.lineas) ? envio : null;
  } catch {
    return null;
  }
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
