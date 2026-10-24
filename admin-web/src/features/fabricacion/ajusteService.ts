import { collection, doc, runTransaction } from "firebase/firestore";
import { db } from "@/firebase/config";
import {
  fechaISO_MX,
  paths,
  planearMovimientoStock,
  ubicacionPersistible,
  validarAjuste,
  type AjusteInventario,
  type Articulo,
  type MotivoAjuste,
  type UbicacionResuelta,
} from "@shared";
import { marcarHuellaArticulos } from "./produccionService";

export type ReducirExistenciaInput = {
  articuloId: string;
  subvariacionCodigo?: string;
  ubicacion: UbicacionResuelta;
  /** "Taller" o el nombre de la sucursal (snapshot). */
  ubicacionNombre: string;
  /** Piezas que se quitan (entero > 0). */
  piezas: number;
  motivo: MotivoAjuste;
  /** Obligatorio con motivo "otro". */
  motivoDetalle?: string;
  usuario: string;
};

/**
 * Reducción manual de existencia con motivo, en UNA transacción: resta el
 * stock (nunca por debajo de 0) y guarda el ajuste (inmutable).
 */
export async function reducirExistencia(
  negocioId: string,
  input: ReducirExistenciaInput,
): Promise<AjusteInventario> {
  const error = validarAjuste(input);
  if (error) throw new Error(error);
  const artRef = doc(db, paths.articulo(negocioId, input.articuloId));
  const ajusteRef = doc(collection(db, paths.ajustesCol(negocioId)));

  const ajuste = await runTransaction(db, async (tx) => {
    const snap = await tx.get(artRef);
    if (!snap.exists()) {
      throw new Error(`El artículo ${input.articuloId} no existe`);
    }
    const art = snap.data() as Articulo;
    const plan = planearMovimientoStock(art, input.ubicacion, -input.piezas, {
      subvariacionCodigo: input.subvariacionCodigo,
    });
    const nuevo: AjusteInventario = {
      ajusteId: ajusteRef.id,
      articuloId: art.id,
      ...(input.subvariacionCodigo
        ? { subvariacionCodigo: input.subvariacionCodigo }
        : {}),
      nombreSnapshot: art.nombre,
      ubicacion: ubicacionPersistible(input.ubicacion),
      ubicacionNombre: input.ubicacionNombre,
      delta: -input.piezas,
      cantidadAnterior: plan.cantidadAnterior,
      cantidadNueva: plan.cantidadNueva,
      motivo: input.motivo,
      ...(input.motivo === "otro" && input.motivoDetalle?.trim()
        ? { motivoDetalle: input.motivoDetalle.trim() }
        : {}),
      usuario: input.usuario,
      fecha: fechaISO_MX(),
    };
    tx.update(artRef, plan.patch);
    tx.set(ajusteRef, nuevo);
    return nuevo;
  });

  await marcarHuellaArticulos(negocioId);
  return ajuste;
}
