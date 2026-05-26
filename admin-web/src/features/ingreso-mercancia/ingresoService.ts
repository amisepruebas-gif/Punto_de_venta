import {
  addDoc,
  collection,
  doc,
  runTransaction,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import {
  COL_DATOS,
  DOC_ARTICULOS_AC,
  fechaISO_MX,
  generarID,
  paths,
  type Articulo,
} from "@shared";

/**
 * Resultado de una operación de ingreso de mercancía.
 * `cantidadAnterior` y `cantidadNueva` reflejan el campo que se actualizó
 * (subvariación cuando aplica, sino el padre).
 */
export type IngresoResult = {
  articuloId: string;
  subvariacionCodigo?: string;
  cantidadAnterior: number;
  cantidadNueva: number;
  delta: number;
};

/**
 * Suma `delta` al stock del artículo (si `subvariacionCodigo` se omite) o
 * al de la subvariación específica. Atómico vía `runTransaction`. Acepta
 * delta negativo (decrementa) — útil para ajustes manuales.
 *
 * Tras commit, marca `articulos_ac` con nueva huella para que el POS y
 * otros admins se enteren del cambio (mismo patrón de sync).
 */
export async function sumarStock(
  negocioId: string,
  articuloId: string,
  delta: number,
  opts: {
    subvariacionCodigo?: string;
    motivo?: string;
    usuario?: string;
  } = {},
): Promise<IngresoResult> {
  if (!Number.isFinite(delta) || delta === 0) {
    throw new Error("delta debe ser un número distinto de cero");
  }
  const ref = doc(db, paths.articulo(negocioId, articuloId));

  let result: IngresoResult | null = null;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) {
      throw new Error(`Artículo ${articuloId} no existe`);
    }
    const a = snap.data() as Articulo;

    if (opts.subvariacionCodigo) {
      // Decremento sobre subvariación específica.
      const subs = a.subvariaciones ?? [];
      const idx = subs.findIndex((s) => s.codigo === opts.subvariacionCodigo);
      if (idx === -1) {
        throw new Error(
          `Subvariación ${opts.subvariacionCodigo} no encontrada en ${articuloId}`,
        );
      }
      const cantidadAnterior = Number(subs[idx].cantidad) || 0;
      const cantidadNueva = cantidadAnterior + delta;
      if (cantidadNueva < 0) {
        throw new Error(
          `Stock insuficiente: ${cantidadAnterior} disponible, intentando ${delta}`,
        );
      }
      const nuevasSubs = subs.map((s, i) =>
        i === idx ? { ...s, cantidad: String(cantidadNueva) } : s,
      );
      // Snapshot del padre = suma de variaciones.
      const sumaPadre = nuevasSubs.reduce(
        (acc, s) => acc + (Number(s.cantidad) || 0),
        0,
      );
      tx.update(ref, {
        subvariaciones: nuevasSubs,
        cantidad: String(sumaPadre),
      });
      result = {
        articuloId,
        subvariacionCodigo: opts.subvariacionCodigo,
        cantidadAnterior,
        cantidadNueva,
        delta,
      };
    } else {
      // Decremento sobre el padre — solo si no tiene variaciones.
      if ((a.subvariaciones?.length ?? 0) > 0) {
        throw new Error(
          "Este artículo tiene subvariaciones; especifica el codigo de la variación",
        );
      }
      const cantidadAnterior = Number(a.cantidad) || 0;
      const cantidadNueva = cantidadAnterior + delta;
      if (cantidadNueva < 0) {
        throw new Error(
          `Stock insuficiente: ${cantidadAnterior} disponible, intentando ${delta}`,
        );
      }
      tx.update(ref, { cantidad: String(cantidadNueva) });
      result = {
        articuloId,
        cantidadAnterior,
        cantidadNueva,
        delta,
      };
    }
  });

  // Best-effort: marcar huella para que listeners se actualicen.
  try {
    await runTransaction(db, async (tx) => {
      const acRef = doc(
        db,
        `${paths.negocio(negocioId)}/${COL_DATOS}/${DOC_ARTICULOS_AC}`,
      );
      tx.set(acRef, { huella: generarID() }, { merge: true });
    });
  } catch (e) {
    console.warn("No se pudo marcar huella articulos_ac:", e);
  }

  // Log opcional del ingreso (informativo, no bloquea la operación).
  try {
    await addDoc(
      collection(
        db,
        `${paths.negocio(negocioId)}/ingresos_mercancia_web_new_version`,
      ),
      {
        ingresoId: generarID(),
        articuloId,
        ...(opts.subvariacionCodigo
          ? { subvariacionCodigo: opts.subvariacionCodigo }
          : {}),
        delta,
        cantidadAnterior: result!.cantidadAnterior,
        cantidadNueva: result!.cantidadNueva,
        ...(opts.motivo ? { motivo: opts.motivo } : {}),
        ...(opts.usuario ? { usuario: opts.usuario } : {}),
        fecha: fechaISO_MX(),
      },
    );
  } catch (e) {
    console.warn("No se pudo escribir log de ingreso:", e);
  }

  return result!;
}
