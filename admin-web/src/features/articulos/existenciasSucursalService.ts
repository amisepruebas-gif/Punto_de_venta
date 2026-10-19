import { doc, runTransaction, setDoc } from "firebase/firestore";
import { db } from "@/firebase/config";
import {
  COL_DATOS,
  DOC_ARTICULOS_AC,
  generarID,
  paths,
  type Articulo,
  type UbicacionStock,
} from "@shared";
import { cargarUbicacionStock } from "@/features/sucursales/ubicacionStock";
import {
  planearExistencias,
  type CambioExistencia,
  type PlanExistencias,
} from "./planearExistencias";

/** Transacciones (una por artículo) que corren en paralelo al guardar. */
const TX_EN_PARALELO = 8;

export type ResultadoExistencias = Omit<PlanExistencias, "patch">;

/**
 * Fija las existencias de tienda de varios artículos / variaciones en la
 * sucursal `ubicacion`. Cada artículo va en su propia transacción: lee el
 * doc, valida que el stock siga en `base` y escribe sólo el campo de esa
 * sucursal (ver `planearExistencias`). Lo que cambió mientras el admin
 * editaba vuelve en `conflictos` sin escribirse.
 *
 * `ubicacion` es la que usó la UI para mostrar los valores base. Se
 * re-resuelve contra Firestore y si la default cambió se aborta todo: los
 * base se habrían leído del campo equivocado.
 */
export async function guardarExistenciasSucursal(
  negocioId: string,
  ubicacion: UbicacionStock,
  cambios: CambioExistencia[],
): Promise<ResultadoExistencias> {
  const fresca = await cargarUbicacionStock(negocioId, ubicacion.sucursalId);
  if (fresca.esDefault !== ubicacion.esDefault) {
    throw new Error(
      "La sucursal default del negocio cambió mientras editabas. Cierra y vuelve a abrir el editor de existencias.",
    );
  }

  const porArticulo = new Map<string, CambioExistencia[]>();
  for (const c of cambios) {
    const lista = porArticulo.get(c.articuloId) ?? [];
    lista.push(c);
    porArticulo.set(c.articuloId, lista);
  }

  const resultado: ResultadoExistencias = {
    aplicados: [],
    conflictos: [],
    errores: [],
  };
  const grupos = [...porArticulo];
  for (let i = 0; i < grupos.length; i += TX_EN_PARALELO) {
    const lote = grupos.slice(i, i + TX_EN_PARALELO);
    const parciales = await Promise.all(
      lote.map(([articuloId, cambiosArt]) =>
        aplicarEnArticulo(negocioId, articuloId, cambiosArt, ubicacion),
      ),
    );
    for (const p of parciales) {
      resultado.aplicados.push(...p.aplicados);
      resultado.conflictos.push(...p.conflictos);
      resultado.errores.push(...p.errores);
    }
  }

  if (resultado.aplicados.length > 0) {
    // Huella best-effort (contrato de articulos_ac; ver articuloService).
    try {
      await setDoc(
        doc(db, `${paths.negocio(negocioId)}/${COL_DATOS}/${DOC_ARTICULOS_AC}`),
        { huella: generarID() },
        { merge: true },
      );
    } catch (e) {
      console.warn("No se pudo marcar huella:", e);
    }
  }

  return resultado;
}

async function aplicarEnArticulo(
  negocioId: string,
  articuloId: string,
  cambios: CambioExistencia[],
  ubicacion: UbicacionStock,
): Promise<ResultadoExistencias> {
  const ref = doc(db, paths.articulo(negocioId, articuloId));
  try {
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) {
        return {
          aplicados: [],
          conflictos: [],
          errores: cambios.map((cambio) => ({
            cambio,
            mensaje: "El artículo ya no existe",
          })),
        };
      }
      const { patch, ...resto } = planearExistencias(
        snap.data() as Articulo,
        cambios,
        ubicacion,
      );
      if (patch) tx.update(ref, patch as Record<string, unknown>);
      return resto;
    });
  } catch (e) {
    return {
      aplicados: [],
      conflictos: [],
      errores: cambios.map((cambio) => ({
        cambio,
        mensaje: (e as Error).message,
      })),
    };
  }
}
