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
  planearMovimientoStock,
  ubicacionPersistible,
  type Articulo,
  type UbicacionResuelta,
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
 * al de la subvariación específica, en `ubicacion` (tienda de una sucursal
 * o bodega). Atómico vía `runTransaction`; el cálculo es
 * `planearMovimientoStock` de `@shared`. Acepta delta negativo (decrementa).
 * Los artículos fabricados no entran por aquí: su stock se mueve con lotes
 * de producción en admin → Fabricación.
 *
 * Tras commit, marca `articulos_ac` con nueva huella para que el POS y
 * otros admins se enteren del cambio (mismo patrón de sync).
 */
export async function sumarStock(
  negocioId: string,
  articuloId: string,
  delta: number,
  opts: {
    ubicacion: UbicacionResuelta;
    subvariacionCodigo?: string;
    motivo?: string;
    usuario?: string;
  },
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
    if (a.fabricado) {
      throw new Error(
        `"${a.nombre}" es fabricado: registra la producción en admin → Fabricación`,
      );
    }
    const plan = planearMovimientoStock(a, opts.ubicacion, delta, {
      subvariacionCodigo: opts.subvariacionCodigo,
    });
    tx.update(ref, plan.patch);
    result = {
      articuloId,
      ...(opts.subvariacionCodigo
        ? { subvariacionCodigo: opts.subvariacionCodigo }
        : {}),
      cantidadAnterior: plan.cantidadAnterior,
      cantidadNueva: plan.cantidadNueva,
      delta,
    };
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
        ubicacion: ubicacionPersistible(opts.ubicacion),
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
