import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import { paths, slugCategoria, fechaISO_MX, type Genero } from "@shared";

// ============================================================
// Género (temática) — CRUD universal por negocio
// ============================================================
// Copia del de admin-web (como pasa con categorías): el id es el slug del
// nombre, y se compara también contra el NOMBRE visible de los demás
// (renombrar conserva el id) para que no queden dos que se ven iguales.
// ============================================================

/** Otro género cuyo nombre visible normaliza igual (la colección es chica). */
async function generoConMismoNombre(
  negocioId: string,
  nombre: string,
  excepto?: string,
): Promise<Genero | null> {
  const slug = slugCategoria(nombre);
  const snap = await getDocs(collection(db, paths.generosCol(negocioId)));
  for (const d of snap.docs) {
    const g = d.data() as Genero;
    if (d.id !== excepto && slugCategoria(g.nombre ?? "") === slug) return { ...g, generoId: d.id };
  }
  return null;
}

export async function crearGenero(negocioId: string, nombre: string): Promise<Genero> {
  const slug = slugCategoria(nombre);
  if (!slug) throw new Error("Nombre de género inválido");
  const igual = await generoConMismoNombre(negocioId, nombre);
  if (igual) throw new Error(`Ya existe un género llamado "${igual.nombre}"`);
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
  const igual = await generoConMismoNombre(negocioId, nuevoNombre, generoId);
  if (igual) throw new Error(`El nuevo nombre colisiona con el género "${igual.nombre}"`);
  await updateDoc(doc(db, paths.genero(negocioId, generoId)), { nombre: nuevoNombre.trim() });
}

/** Borrar no toca los artículos: quedan "(sin género)". */
export async function borrarGenero(negocioId: string, generoId: string): Promise<void> {
  await deleteDoc(doc(db, paths.genero(negocioId, generoId)));
}
