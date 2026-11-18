// ============================================================
// Imprimir etiquetas numeradas desde el teléfono (acceso de armar)
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
  getDocsFromServer,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import {
  IMPRESION_TOPE_ENLACE,
  paths,
  type Impresora,
  type TrabajoImpresion,
} from "@shared";
import { ErrorEnlace, esPermisoDenegado, exigirInternet, type SesionEnlace } from "@/firebase/enlaceApp";
import { accesoSigueVivo } from "./catalogoService";

export type ImpresoraVista = Impresora & { id: string };
export type TrabajoVista = TrabajoImpresion & { id: string };

/** Las impresoras de etiquetas del negocio, por nombre. Del servidor. */
export async function listarImpresoras(s: SesionEnlace): Promise<ImpresoraVista[]> {
  const snap = await getDocsFromServer(collection(s.db, paths.impresorasCol(s.negocioId)));
  return snap.docs
    .map((d) => ({ ...(d.data() as Impresora), id: d.id }))
    .sort((a, b) => (a.nombre ?? "").localeCompare(b.nombre ?? "", "es"));
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
