import type { Articulo } from "./schema";
import { normalizarEtiqueta, type Clasificable } from "./busqueda";

// ============================================================
// Asignación en bloque de categoría, subcategoría, género y etiquetas
// ============================================================
// Puro: calcula qué cambia en cada artículo. admin-web lo convierte en
// escrituras (`deleteField()` para lo que se quita). Tests en
// admin-web/src/lib/__tests__/clasificacion.test.ts.
// ============================================================

/** Qué hacer con un campo de catálogo. */
export type CambioCampo =
  | { accion: "igual" }
  | { accion: "quitar" }
  | { accion: "poner"; id: string };

export type CambiosClasificacion = {
  categoria: CambioCampo;
  /** "poner" solo aplica a los artículos que quedan en la categoría padre
   *  de esa subcategoría. */
  subcategoria: CambioCampo;
  genero: CambioCampo;
  /** Se guardan con `limpiarEtiqueta`. */
  agregarEtiquetas: readonly string[];
  /** Se comparan con `normalizarEtiqueta`. Si una etiqueta está en las dos
   *  listas, gana quitar. */
  quitarEtiquetas: readonly string[];
};

export const SIN_CAMBIOS_CLASIFICACION: CambiosClasificacion = {
  categoria: { accion: "igual" },
  subcategoria: { accion: "igual" },
  genero: { accion: "igual" },
  agregarEtiquetas: [],
  quitarEtiquetas: [],
};

export function hayCambiosClasificacion(c: CambiosClasificacion): boolean {
  return (
    c.categoria.accion !== "igual" ||
    c.subcategoria.accion !== "igual" ||
    c.genero.accion !== "igual" ||
    c.agregarEtiquetas.length > 0 ||
    c.quitarEtiquetas.length > 0
  );
}

export type CampoClasificacion = "categoriaId" | "subcategoriaId" | "generoId" | "etiquetas";

/** Lo que cambia en un artículo: campos con valor nuevo y campos a borrar. */
export type PatchClasificacion = {
  poner: Partial<Pick<Articulo, CampoClasificacion>>;
  borrar: CampoClasificacion[];
};

/** Etiqueta como se guarda: minúsculas, sin `#` al inicio y sin espacios de
 *  sobra (igual que el editor de admin y Fabricación). */
export function limpiarEtiqueta(t: string): string {
  return t.trim().replace(/^#+/, "").trim().toLowerCase().replace(/\s+/g, " ");
}

function mismasEtiquetas(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((t, i) => t === b[i]);
}

/**
 * El cambio que la asignación en bloque le hace a un artículo, o `null` si
 * queda igual.
 * - Sin categoría no hay subcategoría.
 * - Si la categoría cambia, la subcategoría anterior solo se queda si es de
 *   la nueva categoría.
 * - "igual" nunca toca el campo (aunque hoy esté inconsistente).
 * - Las etiquetas solo se reescriben si hay algo que agregar o quitar.
 *
 * @param padreDeSubcategoria subcategoriaId → categoriaId del catálogo.
 */
export function calcularCambioClasificacion(
  a: Clasificable,
  c: CambiosClasificacion,
  padreDeSubcategoria: ReadonlyMap<string, string>,
): PatchClasificacion | null {
  const catAntes = a.categoriaId || undefined;
  const subAntes = a.subcategoriaId || undefined;
  const genAntes = a.generoId || undefined;

  const catDespues =
    c.categoria.accion === "igual"
      ? catAntes
      : c.categoria.accion === "quitar"
        ? undefined
        : c.categoria.id;

  const esDe = (sub: string | undefined, cat: string | undefined) =>
    !!sub && !!cat && padreDeSubcategoria.get(sub) === cat;

  let subDespues: string | undefined;
  if (c.subcategoria.accion === "quitar" || c.categoria.accion === "quitar") {
    subDespues = undefined;
  } else if (c.subcategoria.accion === "poner" && esDe(c.subcategoria.id, catDespues)) {
    subDespues = c.subcategoria.id;
  } else if (catDespues === catAntes) {
    // La categoría no cambia: "igual" no toca la subcategoría (aunque hoy
    // esté inconsistente, p. ej. sin categoría).
    subDespues = subAntes;
  } else {
    subDespues = esDe(subAntes, catDespues) ? subAntes : undefined;
  }

  const genDespues =
    c.genero.accion === "igual"
      ? genAntes
      : c.genero.accion === "quitar"
        ? undefined
        : c.genero.id;

  const etiquetasAntes = a.etiquetas ?? [];
  let etiquetasDespues = etiquetasAntes;
  const tocarEtiquetas = c.agregarEtiquetas.length > 0 || c.quitarEtiquetas.length > 0;
  if (tocarEtiquetas) {
    const quitar = new Set(c.quitarEtiquetas.map(normalizarEtiqueta).filter(Boolean));
    const vistas = new Set<string>();
    const nuevas: string[] = [];
    for (const t of etiquetasAntes) {
      const k = normalizarEtiqueta(t);
      if (!k || quitar.has(k) || vistas.has(k)) continue;
      vistas.add(k);
      nuevas.push(t);
    }
    for (const t of c.agregarEtiquetas) {
      const limpia = limpiarEtiqueta(t);
      const k = normalizarEtiqueta(limpia);
      if (!k || quitar.has(k) || vistas.has(k)) continue;
      vistas.add(k);
      nuevas.push(limpia);
    }
    etiquetasDespues = nuevas;
  }

  const patch: PatchClasificacion = { poner: {}, borrar: [] };
  const campo = (
    nombre: "categoriaId" | "subcategoriaId" | "generoId",
    antes: string | undefined,
    despues: string | undefined,
  ) => {
    if (antes === despues) return;
    if (despues) patch.poner[nombre] = despues;
    else patch.borrar.push(nombre);
  };
  campo("categoriaId", catAntes, catDespues);
  campo("subcategoriaId", subAntes, subDespues);
  campo("generoId", genAntes, genDespues);
  if (tocarEtiquetas && !mismasEtiquetas(etiquetasAntes, etiquetasDespues)) {
    if (etiquetasDespues.length > 0) patch.poner.etiquetas = etiquetasDespues;
    else patch.borrar.push("etiquetas");
  }

  return Object.keys(patch.poner).length > 0 || patch.borrar.length > 0 ? patch : null;
}
