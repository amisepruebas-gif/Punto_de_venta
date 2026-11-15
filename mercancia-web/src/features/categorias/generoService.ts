import { deleteDoc, doc, getDoc, runTransaction, updateDoc } from "firebase/firestore";
import { db } from "@/firebase/config";
import { paths, slugCategoria, fechaISO_MX, type Genero } from "@shared";

// ============================================================
// Género (temática) — CRUD universal por negocio
// ============================================================
// Copia del de admin-web (como pasa con categorías): el id es el slug del
// nombre, así no hay dos géneros con el mismo nombre.
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

/** Borrar no toca los artículos: quedan "(sin género)". */
export async function borrarGenero(negocioId: string, generoId: string): Promise<void> {
  await deleteDoc(doc(db, paths.genero(negocioId, generoId)));
}
