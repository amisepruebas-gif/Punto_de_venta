import type { Articulo } from "./schema";

// ============================================================
// Búsqueda de artículos por texto y por clasificación
// ============================================================
// Puro (sin Firestore ni React): lo usan la caja (buscador y panel de
// filtros) y admin (lista de artículos). Tests en
// admin-web/src/lib/__tests__/busqueda.test.ts.
// ============================================================

/**
 * Texto listo para comparar: minúsculas, sin acentos ni diéresis ("ñ" → "n")
 * y con los espacios colapsados. "  Películas   K-POP " → "peliculas k-pop".
 * Mismo tratamiento de acentos que `slugCategoria`.
 */
export function normalizarTexto(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Palabras normalizadas de una consulta (sin vacías). */
export function palabrasDeConsulta(consulta: string): string[] {
  const n = normalizarTexto(consulta);
  return n ? n.split(" ") : [];
}

/**
 * true si TODAS las palabras aparecen en el texto, en cualquier orden y como
 * parte de una palabra ("llav anim" encuentra "Llavero … Anime"). `texto`
 * debe venir ya normalizado. Sin palabras → true.
 */
export function coincidePalabras(texto: string, palabras: readonly string[]): boolean {
  for (const p of palabras) if (!texto.includes(p)) return false;
  return true;
}

/** Atajo de `coincidePalabras` para una consulta suelta. */
export function coincideConsulta(texto: string, consulta: string): boolean {
  return coincidePalabras(texto, palabrasDeConsulta(consulta));
}

/** Clave de comparación de una etiqueta: normalizada y sin `#` al inicio. */
export function normalizarEtiqueta(t: string): string {
  return normalizarTexto(t).replace(/^#+/, "").trim();
}

// ---------- Filtros por clasificación ----------

/** Valor de filtro "sin ese dato": el artículo no lo tiene, o tiene un id
 *  que ya no existe en el catálogo (se borró la categoría o el género). */
export const FILTRO_SIN = "__sin__";

export type FiltrosClasificacion = {
  /** id de categoría, o `FILTRO_SIN`. */
  categoriaId?: string;
  /** id de subcategoría, o `FILTRO_SIN`. */
  subcategoriaId?: string;
  /** id de género, o `FILTRO_SIN`. */
  generoId?: string;
  /** Etiqueta (se compara con `normalizarEtiqueta`). */
  etiqueta?: string;
};

export type GrupoFiltro = keyof FiltrosClasificacion;

export type Clasificable = Pick<
  Articulo,
  "categoriaId" | "subcategoriaId" | "generoId" | "etiquetas"
>;

/**
 * Ids que existen hoy en cada catálogo. Un id del artículo que no esté aquí
 * cuenta como "sin …". Si falta un set, ese catálogo no se valida (cualquier
 * id cuenta como vigente).
 */
export type CatalogosVigentes = {
  categorias?: ReadonlySet<string>;
  subcategorias?: ReadonlySet<string>;
  generos?: ReadonlySet<string>;
};

/** Clasificación efectiva: ids huérfanos o vacíos → undefined; etiquetas
 *  normalizadas y sin repetir. */
export type ClasificacionVigente = {
  categoriaId?: string;
  subcategoriaId?: string;
  generoId?: string;
  etiquetas: string[];
};

function vigente(id: string | undefined, set?: ReadonlySet<string>): string | undefined {
  if (!id) return undefined;
  if (set && !set.has(id)) return undefined;
  return id;
}

export function clasificacionVigente(
  a: Clasificable,
  catalogos: CatalogosVigentes = {},
): ClasificacionVigente {
  const etiquetas: string[] = [];
  for (const t of a.etiquetas ?? []) {
    const k = normalizarEtiqueta(t);
    if (k && !etiquetas.includes(k)) etiquetas.push(k);
  }
  return {
    categoriaId: vigente(a.categoriaId, catalogos.categorias),
    subcategoriaId: vigente(a.subcategoriaId, catalogos.subcategorias),
    generoId: vigente(a.generoId, catalogos.generos),
    etiquetas,
  };
}

function pasaId(valor: string | undefined, filtro: string | undefined): boolean {
  if (!filtro) return true;
  if (filtro === FILTRO_SIN) return valor === undefined;
  return valor === filtro;
}

/**
 * true si la clasificación pasa todos los filtros, menos el grupo `excepto`
 * (para contar las opciones de ese grupo con los demás filtros puestos).
 */
export function pasaFiltrosVigente(
  c: ClasificacionVigente,
  f: FiltrosClasificacion,
  excepto?: GrupoFiltro,
): boolean {
  if (excepto !== "categoriaId" && !pasaId(c.categoriaId, f.categoriaId)) return false;
  if (excepto !== "subcategoriaId" && !pasaId(c.subcategoriaId, f.subcategoriaId)) return false;
  if (excepto !== "generoId" && !pasaId(c.generoId, f.generoId)) return false;
  if (excepto !== "etiqueta" && f.etiqueta) {
    const k = normalizarEtiqueta(f.etiqueta);
    if (k && !c.etiquetas.includes(k)) return false;
  }
  return true;
}

/** `pasaFiltrosVigente` desde el artículo crudo. */
export function pasaFiltros(
  a: Clasificable,
  f: FiltrosClasificacion,
  catalogos?: CatalogosVigentes,
): boolean {
  return pasaFiltrosVigente(clasificacionVigente(a, catalogos), f);
}

/** true si hay al menos un filtro puesto. */
export function hayFiltros(f: FiltrosClasificacion): boolean {
  return !!(f.categoriaId || f.subcategoriaId || f.generoId || f.etiqueta);
}

export type ConteoOpciones = {
  /** id (o `FILTRO_SIN`) → artículos que quedarían al elegirlo. */
  categorias: Map<string, number>;
  subcategorias: Map<string, number>;
  generos: Map<string, number>;
  /** clave normalizada → artículos que quedarían al elegirla. */
  etiquetas: Map<string, number>;
  /** Artículos que pasan todos los filtros puestos. */
  total: number;
};

function sumar(m: Map<string, number>, k: string) {
  m.set(k, (m.get(k) ?? 0) + 1);
}

/**
 * Cuántos artículos quedarían al elegir cada opción, con los OTROS filtros
 * puestos (al cambiar de categoría no se cuenta el filtro de categoría
 * actual, etc.). Las opciones que no aparecen darían 0.
 */
export function contarOpciones(
  clasificaciones: readonly ClasificacionVigente[],
  f: FiltrosClasificacion,
): ConteoOpciones {
  const r: ConteoOpciones = {
    categorias: new Map(),
    subcategorias: new Map(),
    generos: new Map(),
    etiquetas: new Map(),
    total: 0,
  };
  for (const c of clasificaciones) {
    if (pasaFiltrosVigente(c, f)) r.total++;
    if (pasaFiltrosVigente(c, f, "categoriaId")) sumar(r.categorias, c.categoriaId ?? FILTRO_SIN);
    if (pasaFiltrosVigente(c, f, "subcategoriaId")) {
      sumar(r.subcategorias, c.subcategoriaId ?? FILTRO_SIN);
    }
    if (pasaFiltrosVigente(c, f, "generoId")) sumar(r.generos, c.generoId ?? FILTRO_SIN);
    if (pasaFiltrosVigente(c, f, "etiqueta")) for (const t of c.etiquetas) sumar(r.etiquetas, t);
  }
  return r;
}
