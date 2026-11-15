import { deleteField, doc, writeBatch } from "firebase/firestore";
import { db } from "@/firebase/config";
import { paths, type PatchClasificacion } from "@shared";
import { marcarArticuloEnSync } from "./articuloService";

/** Escrituras por lote (el máximo de Firestore es 500). */
const LOTE = 400;

export type CambioArticulo = { id: string; patch: PatchClasificacion };

/**
 * Guarda la asignación en bloque: solo los campos que cambian, en lotes
 * atómicos de 400. Si un lote falla, los anteriores ya quedaron: el error
 * dice cuántos se guardaron y repetir es seguro (lo ya aplicado ya no
 * cambia). Al final, la huella `articulos_ac` como cualquier edición.
 */
export async function asignarClasificacionEnBloque(
  negocioId: string,
  cambios: readonly CambioArticulo[],
  onProgreso?: (hechos: number, total: number) => void,
): Promise<void> {
  let hechos = 0;
  for (let i = 0; i < cambios.length; i += LOTE) {
    const lote = cambios.slice(i, i + LOTE);
    const batch = writeBatch(db);
    for (const { id, patch } of lote) {
      const data: Record<string, unknown> = { ...patch.poner };
      for (const campo of patch.borrar) data[campo] = deleteField();
      batch.update(doc(db, paths.articulo(negocioId, id)), data);
    }
    try {
      await batch.commit();
    } catch (e) {
      throw new Error(
        `Se guardaron ${hechos} de ${cambios.length}. Puedes volver a intentarlo. (${(e as Error).message})`,
      );
    }
    hechos += lote.length;
    onProgreso?.(hechos, cambios.length);
  }
  if (hechos > 0) await marcarArticuloEnSync(negocioId);
}
