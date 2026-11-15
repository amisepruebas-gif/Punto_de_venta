import { deleteDoc, doc, getDoc, runTransaction, updateDoc } from "firebase/firestore";
import { db } from "@/firebase/config";
import { paths, slugCategoria, fechaISO_MX, type Genero } from "@shared";

// ============================================================
// Género (temática) — CRUD universal por negocio
// ============================================================
// Mismo patrón que `categoriaService`: el id es el slug del nombre, así no
// hay dos géneros con el mismo nombre.
// ============================================================

export async function crearGenero(negocioId: string, nombre: string): Promise<Genero> {
  const slug = slugCategoria(nombre);
  if (!slug) throw new Error("Nombre de género inválido");
  const ref = doc(db, paths.genero(negocioId, slug));
  const data: Genero = { generoId: slug, nombre: nombre.trim(), fechaCreacion: fechaISO_MX() };
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists()) throw new Error(`Ya existe un género llamado "${nombre.trim()}"`);
    tx.set(ref, data);
  });
  return data;
}

/**
 * Género con ese nombre: el existente (mismo slug) o uno nuevo. Lo usa "+ Nuevo"
 * en el editor de artículo, la asignación en bloque y Fabricación.
 */
export async function asegurarGenero(negocioId: string, nombre: string): Promise<Genero> {
  const slug = slugCategoria(nombre);
  if (!slug) throw new Error("Nombre de género inválido");
  const ref = doc(db, paths.genero(negocioId, slug));
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists()) return snap.data() as Genero;
    const data: Genero = { generoId: slug, nombre: nombre.trim(), fechaCreacion: fechaISO_MX() };
    tx.set(ref, data);
    return data;
  });
}

/** Renombrar mantiene el `generoId`: los artículos no se tocan. */
export async function renombrarGenero(
  negocioId: string,
  generoId: string,
  nuevoNombre: string,
): Promise<void> {
  const slug = slugCategoria(nuevoNombre);
  if (!slug) throw new Error("Nombre inválido");
  if (slug !== generoId) {
    const colision = await getDoc(doc(db, paths.genero(negocioId, slug)));
    if (colision.exists()) {
      throw new Error(`El nuevo nombre colisiona con el género "${colision.data()?.nombre}"`);
    }
  }
  await updateDoc(doc(db, paths.genero(negocioId, generoId)), { nombre: nuevoNombre.trim() });
}

/**
 * Borrar un género no toca los artículos: los que lo tenían cuentan como
 * "(sin género)" en los filtros (igual que las categorías borradas).
 */
export async function borrarGenero(negocioId: string, generoId: string): Promise<void> {
  await deleteDoc(doc(db, paths.genero(negocioId, generoId)));
}
