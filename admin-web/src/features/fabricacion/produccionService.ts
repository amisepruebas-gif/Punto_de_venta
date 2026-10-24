import { collection, doc, runTransaction, setDoc } from "firebase/firestore";
import { db } from "@/firebase/config";
import {
  DOC_ARTICULOS_AC,
  DOC_CONTADOR_FABRICACION,
  fechaISO_MX,
  folioFabricacion,
  generarID,
  paths,
  planearMovimientoStock,
  ubicacionPersistible,
  type Articulo,
  type LoteProduccion,
  type UbicacionResuelta,
} from "@shared";

export type RegistrarProduccionInput = {
  articuloId: string;
  /** Piezas producidas (entero > 0). */
  cantidad: number;
  /** Taller (bodega) o la tienda de una sucursal, ya resuelta. */
  destino: UbicacionResuelta;
  /** "Taller" o el nombre de la sucursal (snapshot). */
  destinoNombre: string;
  /** `YYYY-MM-DD`. */
  fechaProduccion: string;
  /** `true` en el lote que dio de alta el artículo. */
  esAlta: boolean;
  usuario: string;
  notas?: string;
};

/**
 * Registra un lote de producción en UNA transacción: suma `cantidad` al
 * stock del destino, avanza el folio `FAB-NNNNNN` y guarda el lote
 * (inmutable). Solo para artículos fabricados.
 */
export async function registrarProduccion(
  negocioId: string,
  input: RegistrarProduccionInput,
): Promise<LoteProduccion> {
  if (!Number.isInteger(input.cantidad) || input.cantidad <= 0) {
    throw new Error("La cantidad debe ser un número entero mayor que 0");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.fechaProduccion)) {
    throw new Error("Fecha de producción inválida");
  }
  const artRef = doc(db, paths.articulo(negocioId, input.articuloId));
  const contadorRef = doc(db, paths.dato(negocioId, DOC_CONTADOR_FABRICACION));
  const loteRef = doc(collection(db, paths.produccionCol(negocioId)));

  const lote = await runTransaction(db, async (tx) => {
    const [artSnap, contadorSnap] = await Promise.all([
      tx.get(artRef),
      tx.get(contadorRef),
    ]);
    if (!artSnap.exists()) {
      throw new Error(`El artículo ${input.articuloId} no existe`);
    }
    const art = artSnap.data() as Articulo;
    if (!art.fabricado) {
      throw new Error(`"${art.nombre}" no es un artículo fabricado`);
    }
    const plan = planearMovimientoStock(art, input.destino, input.cantidad);
    const numero =
      (contadorSnap.exists() ? Number(contadorSnap.data().ultimo) || 0 : 0) + 1;
    const nuevo: LoteProduccion = {
      loteId: loteRef.id,
      folio: folioFabricacion(numero),
      articuloId: art.id,
      nombreSnapshot: art.nombre,
      cantidad: input.cantidad,
      destino: ubicacionPersistible(input.destino),
      destinoNombre: input.destinoNombre,
      fechaProduccion: input.fechaProduccion,
      esAlta: input.esAlta,
      usuario: input.usuario,
      ...(input.notas?.trim() ? { notas: input.notas.trim() } : {}),
      fechaRegistro: fechaISO_MX(),
    };
    tx.update(artRef, plan.patch);
    tx.set(contadorRef, { ultimo: numero }, { merge: true });
    tx.set(loteRef, nuevo);
    return nuevo;
  });

  await marcarHuellaArticulos(negocioId);
  return lote;
}

/** Best-effort: avisa a POS y admins que cambió el catálogo (mismo patrón
 *  que el ingreso de mercancía). */
export async function marcarHuellaArticulos(negocioId: string): Promise<void> {
  try {
    await setDoc(
      doc(db, paths.dato(negocioId, DOC_ARTICULOS_AC)),
      { huella: generarID() },
      { merge: true },
    );
  } catch (e) {
    console.warn("No se pudo marcar huella articulos_ac:", e);
  }
}
