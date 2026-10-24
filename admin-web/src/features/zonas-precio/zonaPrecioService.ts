import { doc, getDoc, runTransaction, updateDoc } from "firebase/firestore";
import { db } from "@/firebase/config";
import {
  fechaISO_MX,
  paths,
  slugCategoria,
  validarEscalones,
  type EscalonMayoreo,
  type ZonaPrecio,
} from "@shared";

/**
 * Zonas de precios (Fabricación). La zona es la fuente viva del precio: al
 * guardar un cambio de precio o escalones, la function
 * `sincronizarZonaPrecio` lo copia a todos sus artículos. Por eso aquí no
 * se tocan artículos.
 */
export type ZonaInput = {
  nombre: string;
  categoriaId?: string;
  precioVenta: number;
  escalones: EscalonMayoreo[];
};

/** Mensaje de error o `null` si la zona es válida. */
export function validarZona(input: ZonaInput): string | null {
  if (!slugCategoria(input.nombre)) return "Escribe el nombre de la zona";
  if (!Number.isFinite(input.precioVenta) || input.precioVenta <= 0) {
    return "El precio normal debe ser mayor que 0";
  }
  return validarEscalones(input.escalones, input.precioVenta);
}

export async function crearZona(
  negocioId: string,
  input: ZonaInput,
): Promise<ZonaPrecio> {
  const error = validarZona(input);
  if (error) throw new Error(error);
  const zonaId = slugCategoria(input.nombre);
  const ref = doc(db, paths.zonaPrecio(negocioId, zonaId));
  const zona: ZonaPrecio = {
    zonaId,
    nombre: input.nombre.trim(),
    ...(input.categoriaId ? { categoriaId: input.categoriaId } : {}),
    precioVenta: input.precioVenta,
    escalones: input.escalones,
    activa: true,
    fechaCreacion: fechaISO_MX(),
  };
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists()) {
      throw new Error(`Ya existe una zona llamada "${snap.data().nombre}"`);
    }
    tx.set(ref, zona);
  });
  return zona;
}

/**
 * Edita una zona. Renombrar conserva el `zonaId` (los artículos apuntan a
 * él); se rechaza si el nuevo nombre coincide con otra zona.
 */
export async function editarZona(
  negocioId: string,
  zonaId: string,
  input: ZonaInput,
): Promise<void> {
  const error = validarZona(input);
  if (error) throw new Error(error);
  const slug = slugCategoria(input.nombre);
  if (slug !== zonaId) {
    const otra = await getDoc(doc(db, paths.zonaPrecio(negocioId, slug)));
    if (otra.exists()) {
      throw new Error(`Ya existe una zona llamada "${otra.data().nombre}"`);
    }
  }
  await updateDoc(doc(db, paths.zonaPrecio(negocioId, zonaId)), {
    nombre: input.nombre.trim(),
    categoriaId: input.categoriaId ?? "",
    precioVenta: input.precioVenta,
    escalones: input.escalones,
    fechaActualizacion: fechaISO_MX(),
  });
}

/** Las inactivas no se ofrecen al asignar zona; sus artículos conservan
 *  la zona y su último precio. */
export async function activarZona(
  negocioId: string,
  zonaId: string,
  activa: boolean,
): Promise<void> {
  await updateDoc(doc(db, paths.zonaPrecio(negocioId, zonaId)), {
    activa,
    fechaActualizacion: fechaISO_MX(),
  });
}

/** "$35 · 10+ $30 · 25+ $27" para mostrar una zona en una línea. */
export function resumenZona(z: Pick<ZonaPrecio, "precioVenta" | "escalones">): string {
  return [`$${z.precioVenta}`, ...z.escalones.map((e) => `${e.minPz}+ $${e.precio}`)].join(" · ");
}
