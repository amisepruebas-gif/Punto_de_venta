// ============================================================
// Imprimir etiquetas numeradas desde el teléfono (acceso de armar) y
// etiquetas de precio desde su página aparte (acceso `precio`)
// ============================================================
//
// El teléfono deja una orden en la cola de impresión
// (`impresiones_web_new_version`) para una impresora de etiquetas (PC con el
// programa "AMISE Impresora"). La impresora aparta los números al imprimir y
// la orden queda "impreso" con su rango (`desde`…`hasta`). Mismas reglas que
// `lotesService`: sin red no se intenta, y cada escritura va en una
// transacción para que un reintento del SDK no pida dos veces.

import {
  collection,
  deleteField,
  doc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import {
  IMPRESION_TOPE_ENLACE,
  IMPRESION_TOPE_PIEZAS,
  RE_CODIGO_ARTICULO_ETIQUETA,
  RE_PRECIO_ETIQUETA,
  paths,
  type Impresora,
  type TrabajoImpresion,
} from "@shared";
import { ErrorEnlace, esPermisoDenegado, exigirInternet, type SesionEnlace } from "@/firebase/enlaceApp";
import { accesoSigueVivo } from "./catalogoService";

export type ImpresoraVista = Impresora & { id: string };
export type TrabajoVista = TrabajoImpresion & { id: string };

/**
 * Las impresoras de etiquetas del negocio, por nombre, EN VIVO: el programa
 * avisa que sigue vivo cada minuto y "Conectada" se pone al día sola (leídas
 * una sola vez, a los 2.5 min todas salían "Sin conexión").
 */
export function escucharImpresoras(
  s: SesionEnlace,
  cb: (lista: ImpresoraVista[]) => void,
  onError: (e: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    collection(s.db, paths.impresorasCol(s.negocioId)),
    (snap) =>
      cb(
        snap.docs
          .map((d) => ({ ...(d.data() as Impresora), id: d.id }))
          .sort((a, b) => (a.nombre ?? "").localeCompare(b.nombre ?? "", "es")),
      ),
    onError,
  );
}

/** Pide `cantidad` etiquetas a una impresora. Devuelve el id de la orden. */
export async function pedirEtiquetas(s: SesionEnlace, impresoraId: string, cantidad: number): Promise<string> {
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > IMPRESION_TOPE_ENLACE) {
    throw new ErrorEnlace(`Pide de 1 a ${IMPRESION_TOPE_ENLACE} etiquetas.`);
  }
  exigirInternet();
  // El id se saca UNA vez: si el SDK repite la transacción (se perdió la
  // respuesta), encuentra la orden ya creada y no pide otra.
  const ref = doc(collection(s.db, paths.impresionesCol(s.negocioId)));
  try {
    await runTransaction(s.db, async (tx) => {
      const ya = await tx.get(ref);
      if (ya.exists()) return;
      tx.set(ref, {
        tipo: "etiquetas_lote",
        impresoraId,
        estado: "pendiente",
        origen: "enlace",
        creadoPor: s.uid,
        ...(s.nombre ? { quien: s.nombre.slice(0, 80) } : {}),
        creadoEn: serverTimestamp(),
        cantidad,
        enlaceId: s.enlaceId,
      });
    });
  } catch (e) {
    // Sin permiso con el acceso vivo = esa impresora está apagada o se borró.
    if (esPermisoDenegado(e) && (await accesoSigueVivo(s))) {
      throw new ErrorEnlace("Esa impresora está apagada en admin. Elige otra o avisa al administrador.");
    }
    throw e;
  }
  return ref.id;
}

// ---------- Página aparte de etiquetas de precio (acceso `precio`) ----------

/** Lo que se escribe en la página: como en la app "codigos". */
export type EtiquetaPrecio = { codigo: string; precio: string; piezas: number };

/** Qué está mal de cada campo (vacío = se puede mandar). Mismos límites que
 *  las reglas y que el programa de la impresora. */
export function problemasEtiquetaPrecio(e: EtiquetaPrecio): {
  codigo?: string;
  precio?: string;
  piezas?: string;
} {
  return {
    ...(RE_CODIGO_ARTICULO_ETIQUETA.test(e.codigo) ? {} : { codigo: "El código debe tener 8 dígitos." }),
    ...(RE_PRECIO_ETIQUETA.test(e.precio)
      ? {}
      : { precio: "Escribe el precio con números (hasta 2 decimales, con punto)." }),
    ...(Number.isInteger(e.piezas) && e.piezas >= 1 && e.piezas <= IMPRESION_TOPE_PIEZAS
      ? {}
      : { piezas: `De 1 a ${IMPRESION_TOPE_PIEZAS} etiquetas por vez.` }),
  };
}

/** Id de una orden que aún no se manda. La pantalla lo guarda y lo repite si
 *  reintenta lo mismo. */
export function idNuevaOrden(s: SesionEnlace): string {
  return doc(collection(s.db, paths.impresionesCol(s.negocioId))).id;
}

/**
 * Manda una etiqueta de precio (con cuántas) a una impresora. Si se repite con
 * el mismo `trabajoId` (salió "Sin internet" pero la orden sí llegó), no se
 * manda doble: la transacción la encuentra y no hace nada.
 */
export async function mandarEtiquetaPrecio(
  s: SesionEnlace,
  impresoraId: string,
  e: EtiquetaPrecio,
  trabajoId: string,
): Promise<void> {
  const problema = Object.values(problemasEtiquetaPrecio(e))[0];
  if (problema) throw new ErrorEnlace(problema);
  exigirInternet();
  const ref = doc(s.db, paths.impresion(s.negocioId, trabajoId));
  try {
    await runTransaction(s.db, async (tx) => {
      const ya = await tx.get(ref);
      if (ya.exists()) return;
      tx.set(ref, {
        tipo: "etiquetas_precio",
        impresoraId,
        estado: "pendiente",
        origen: "enlace",
        creadoPor: s.uid,
        ...(s.nombre ? { quien: s.nombre.slice(0, 80) } : {}),
        creadoEn: serverTimestamp(),
        renglones: [{ codigo: e.codigo, precio: e.precio, piezas: e.piezas }],
        enlaceId: s.enlaceId,
      });
    });
  } catch (err) {
    // Sin permiso con el acceso vivo = esa impresora está apagada o se borró.
    if (esPermisoDenegado(err) && (await accesoSigueVivo(s))) {
      throw new ErrorEnlace("Esa impresora está apagada en admin. Elige otra o avisa al administrador.");
    }
    throw err;
  }
}

/** Una orden en vivo (su avance). */
export function escucharTrabajo(
  s: SesionEnlace,
  trabajoId: string,
  cb: (t: TrabajoVista | null) => void,
  onError: (e: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    doc(s.db, paths.impresion(s.negocioId, trabajoId)),
    (snap) => cb(snap.exists() ? { ...(snap.data() as TrabajoImpresion), id: snap.id } : null),
    onError,
  );
}

/** Las órdenes de este acceso que esperan, se imprimen o fallaron. */
export function escucharMisOrdenesAbiertas(
  s: SesionEnlace,
  cb: (t: TrabajoVista[]) => void,
  onError: (e: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    query(
      collection(s.db, paths.impresionesCol(s.negocioId)),
      where("enlaceId", "==", s.enlaceId),
      where("estado", "in", ["pendiente", "imprimiendo", "error"]),
    ),
    (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as TrabajoImpresion), id: d.id }))),
    onError,
  );
}

/** "Reimprimir": la regresa a la cola con sus mismos números. */
export async function reimprimir(s: SesionEnlace, trabajoId: string): Promise<void> {
  exigirInternet();
  const ref = doc(s.db, paths.impresion(s.negocioId, trabajoId));
  try {
    await runTransaction(s.db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new ErrorEnlace("Esa orden ya no existe.");
      const t = snap.data() as TrabajoImpresion;
      if (t.estado === "pendiente" || t.estado === "imprimiendo") return;
      tx.update(ref, { estado: "pendiente", error: deleteField() });
    });
  } catch (e) {
    // Sin permiso con el acceso vivo = su impresora está apagada o se borró.
    if (esPermisoDenegado(e) && (await accesoSigueVivo(s))) {
      throw new ErrorEnlace("Esa impresora está apagada en admin o ya no existe. Pide una orden nueva a otra impresora.");
    }
    throw e;
  }
}
