import {
  deleteDoc,
  doc,
  getDoc,
  runTransaction,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import {
  paths,
  slugCategoria,
  fechaISO_MX,
  type Categoria,
  type Subcategoria,
} from "@shared";

// ============================================================
// Categoría — CRUD universal por negocio
// ============================================================

export async function crearCategoria(
  negocioId: string,
  nombre: string,
): Promise<Categoria> {
  const slug = slugCategoria(nombre);
  if (!slug) {
    throw new Error("Nombre de categoría inválido");
  }
  const ref = doc(db, paths.categoria(negocioId, slug));
  const data: Categoria = {
    categoriaId: slug,
    nombre: nombre.trim(),
    fechaCreacion: fechaISO_MX(),
  };
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists()) {
      throw new Error(`Ya existe una categoría llamada "${nombre.trim()}"`);
    }
    tx.set(ref, data);
  });
  return data;
}

/**
 * Renombrar mantiene el `categoriaId` (slug) intacto: los artículos no
 * requieren backfill. Solo cambia la etiqueta visible. Si el nuevo nombre
 * normalizado colisiona con otra categoría, se rechaza.
 */
export async function renombrarCategoria(
  negocioId: string,
  categoriaId: string,
  nuevoNombre: string,
): Promise<void> {
  const slug = slugCategoria(nuevoNombre);
  if (!slug) throw new Error("Nombre inválido");
  if (slug !== categoriaId) {
    // Verificar colisión con otro slug
    const colisionRef = doc(db, paths.categoria(negocioId, slug));
    const colisionSnap = await getDoc(colisionRef);
    if (colisionSnap.exists()) {
      throw new Error(
        `El nuevo nombre colisiona con la categoría existente "${colisionSnap.data()?.nombre}"`,
      );
    }
  }
  await updateDoc(doc(db, paths.categoria(negocioId, categoriaId)), {
    nombre: nuevoNombre.trim(),
  });
}

/**
 * Borrar una categoría deja huérfanas a sus subcategorías y a los artículos
 * que la referencian (decisión #12 del spec). La UI muestra los huérfanos
 * como "(sin categoría)".
 */
export async function borrarCategoria(
  negocioId: string,
  categoriaId: string,
): Promise<void> {
  await deleteDoc(doc(db, paths.categoria(negocioId, categoriaId)));
}

// ============================================================
// Subcategoría — anidada bajo Categoría
// ============================================================

export async function crearSubcategoria(
  negocioId: string,
  nombre: string,
  categoriaId: string,
): Promise<Subcategoria> {
  const slug = slugCategoria(nombre);
  if (!slug) throw new Error("Nombre de subcategoría inválido");
  // Validación: la categoría padre debe existir.
  const catSnap = await getDoc(doc(db, paths.categoria(negocioId, categoriaId)));
  if (!catSnap.exists()) {
    throw new Error("La categoría padre no existe");
  }
  const ref = doc(db, paths.subcategoria(negocioId, slug));
  const data: Subcategoria = {
    subcategoriaId: slug,
    nombre: nombre.trim(),
    categoriaId,
    fechaCreacion: fechaISO_MX(),
  };
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists()) {
      throw new Error(`Ya existe una subcategoría llamada "${nombre.trim()}"`);
    }
    tx.set(ref, data);
  });
  return data;
}

export async function renombrarSubcategoria(
  negocioId: string,
  subcategoriaId: string,
  nuevoNombre: string,
): Promise<void> {
  const slug = slugCategoria(nuevoNombre);
  if (!slug) throw new Error("Nombre inválido");
  if (slug !== subcategoriaId) {
    const colisionRef = doc(db, paths.subcategoria(negocioId, slug));
    const colisionSnap = await getDoc(colisionRef);
    if (colisionSnap.exists()) {
      throw new Error(
        `El nuevo nombre colisiona con la subcategoría "${colisionSnap.data()?.nombre}"`,
      );
    }
  }
  await updateDoc(doc(db, paths.subcategoria(negocioId, subcategoriaId)), {
    nombre: nuevoNombre.trim(),
  });
}

/**
 * Cambiar la categoría padre de una subcategoría sin renombrarla. El
 * `subcategoriaId` (slug) se preserva.
 */
export async function moverSubcategoria(
  negocioId: string,
  subcategoriaId: string,
  nuevaCategoriaId: string,
): Promise<void> {
  const catSnap = await getDoc(
    doc(db, paths.categoria(negocioId, nuevaCategoriaId)),
  );
  if (!catSnap.exists()) {
    throw new Error("La nueva categoría no existe");
  }
  await updateDoc(doc(db, paths.subcategoria(negocioId, subcategoriaId)), {
    categoriaId: nuevaCategoriaId,
  });
}

export async function borrarSubcategoria(
  negocioId: string,
  subcategoriaId: string,
): Promise<void> {
  await deleteDoc(doc(db, paths.subcategoria(negocioId, subcategoriaId)));
}
