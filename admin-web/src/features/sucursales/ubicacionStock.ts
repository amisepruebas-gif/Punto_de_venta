import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "@/firebase/config";
import {
  COL_SUCURSALES,
  paths,
  resolverUbicacionStock,
  type Negocio,
  type UbicacionStock,
} from "@shared";

/**
 * Carga la lista de IDs de sucursales del negocio ordenados alfabéticamente.
 * Sirve para resolver el fallback de la sucursal default cuando
 * `Negocio.sucursalDefaultId` no está seteado.
 *
 * Se llama FUERA de las transacciones: las tx del SDK web no pueden leer
 * colecciones, sólo docs.
 */
async function cargarSucursalesIds(negocioId: string): Promise<string[]> {
  const snap = await getDocs(
    collection(db, `${paths.negocio(negocioId)}/${COL_SUCURSALES}`),
  );
  const ids: string[] = [];
  snap.forEach((d) => ids.push(d.id));
  ids.sort();
  return ids;
}

/**
 * Resuelve sobre qué campo de stock opera la sucursal `sucursalId`
 * (`cantidad` si es la default, `cantidadPorSucursal[sid]` si no) leyendo
 * el negocio y las sucursales directo de Firestore. Mismo contrato que
 * `cargarUbicacionStock` de nodo-web.
 */
export async function cargarUbicacionStock(
  negocioId: string,
  sucursalId: string,
): Promise<UbicacionStock> {
  const [negocioSnap, sucursalesIds] = await Promise.all([
    getDoc(doc(db, paths.negocio(negocioId))),
    cargarSucursalesIds(negocioId),
  ]);
  const negocio = negocioSnap.exists() ? (negocioSnap.data() as Negocio) : null;
  return resolverUbicacionStock(
    sucursalId,
    negocio?.sucursalDefaultId,
    sucursalesIds,
  );
}
