// ============================================================
// Artículos de mayoreo — registro simplificado, precios en escalera y
// códigos de artículo final. Helpers puros (sin Firestore ni React).
// ============================================================
//
// Un artículo «Solo mayoreo» lleva categoría y subcategoría obligatorias. Su
// precio (mayoreo y menudeo) sale de una escalera: el del artículo si tiene
// `precioPropio`, si no el de su subcategoría, si no el de su categoría
// (`PreciosMayoreo`, doc `datos/_preciosMayoreo`). El artículo guarda copia
// del precio vigente en `precioVenta`/`precioMenudeo`, igual que con las
// zonas, para que la caja, el ticket y las etiquetas lean solo el artículo.
//
// "Artículo final" = lo que se etiqueta, se cuenta y se vende: el artículo
// si no tiene variaciones, o cada variación. Todos tienen un código de 8
// dígitos: el `id` del artículo o el `codigoBarras` de la variación.
//
// Espejo en functions (CommonJS, no importa shared): lib/preciosMayoreo.js.
// Tests: admin-web/src/lib/__tests__/articuloMayoreo.test.ts.

import { normalizarTexto } from "./busqueda";
import { validarPrecioMenudeo } from "./mayoreo";
import type {
  Articulo,
  ArticuloSubvariacion,
  PrecioMayoreoNivel,
  PreciosMayoreo,
} from "./schema";

// ---------- Precios en escalera ----------

export type OrigenPrecioMayoreo = "articulo" | "subcategoria" | "categoria";

export type PrecioMayoreoResuelto = PrecioMayoreoNivel & {
  origen: OrigenPrecioMayoreo;
};

/** Un nivel sirve si el precio es mayor que 0 y el menudeo es mayor que el
 *  precio. Uno incompleto o inválido se trata como si no existiera. */
export function nivelPrecioValido(n: unknown): n is PrecioMayoreoNivel {
  if (!n || typeof n !== "object") return false;
  const { precio, menudeo } = n as Partial<PrecioMayoreoNivel>;
  return (
    typeof precio === "number" &&
    typeof menudeo === "number" &&
    Number.isFinite(precio) &&
    Number.isFinite(menudeo) &&
    precio > 0 &&
    menudeo > precio
  );
}

/** Precio que el artículo hereda: el de su subcategoría si tiene uno
 *  válido; si no, el de su categoría. `null` si ninguna lo tiene. */
export function resolverPrecioHeredado(
  art: Pick<Articulo, "categoriaId" | "subcategoriaId">,
  precios: PreciosMayoreo | null | undefined,
): PrecioMayoreoResuelto | null {
  const sub = art.subcategoriaId
    ? precios?.subcategorias?.[art.subcategoriaId]
    : undefined;
  if (nivelPrecioValido(sub)) {
    return { precio: sub.precio, menudeo: sub.menudeo, origen: "subcategoria" };
  }
  const cat = art.categoriaId ? precios?.categorias?.[art.categoriaId] : undefined;
  if (nivelPrecioValido(cat)) {
    return { precio: cat.precio, menudeo: cat.menudeo, origen: "categoria" };
  }
  return null;
}

/** Precio vigente de un artículo de mayoreo y de dónde sale. Con
 *  `precioPropio` es el del artículo (o `null` si lo tiene mal). */
export function resolverPrecioMayoreo(
  art: Pick<
    Articulo,
    "categoriaId" | "subcategoriaId" | "precioPropio" | "precioVenta" | "precioMenudeo"
  >,
  precios: PreciosMayoreo | null | undefined,
): PrecioMayoreoResuelto | null {
  if (art.precioPropio) {
    const nivel = {
      precio: Number(art.precioVenta),
      menudeo: Number(art.precioMenudeo),
    };
    return nivelPrecioValido(nivel) ? { ...nivel, origen: "articulo" } : null;
  }
  return resolverPrecioHeredado(art, precios);
}

/** Valida los dos precios que captura un editor (como texto). Devuelve el
 *  mensaje de error o `null`. */
export function validarPrecioNivel(precio: string, menudeo: string): string | null {
  const raw = (precio ?? "").trim();
  if (!raw) return "Falta el precio de mayoreo";
  const p = Number(raw);
  if (!Number.isFinite(p) || p <= 0) {
    return "El precio de mayoreo debe ser mayor que 0";
  }
  return validarPrecioMenudeo(true, menudeo, p);
}

/** Los dos precios capturados como texto → nivel numérico. Validar antes
 *  con `validarPrecioNivel`. */
export function nivelDeTexto(precio: string, menudeo: string): PrecioMayoreoNivel {
  return { precio: Number(precio.trim()), menudeo: Number(menudeo.trim()) };
}

/** Campos de precio que se guardan en el artículo para `nivel`. La utilidad
 *  se calcula igual que en el editor general y en las zonas. */
export function camposPrecioMayoreo(
  nivel: PrecioMayoreoNivel,
  art: Pick<Articulo, "preciCompra" | "cantidad">,
): Pick<Articulo, "precioVenta" | "precioMenudeo" | "utilidad" | "utilidadTotal"> {
  const utilidad = nivel.precio - (Number(art.preciCompra) || 0);
  return {
    precioVenta: String(nivel.precio),
    precioMenudeo: String(nivel.menudeo),
    utilidad: String(utilidad),
    utilidadTotal: String(utilidad * (Number(art.cantidad) || 0)),
  };
}

// ---------- Nombres automáticos ----------

function numeroVariacion(nombre: string): number | null {
  const m = /^m(\d{1,6})$/i.exec((nombre ?? "").trim());
  return m ? Number(m[1]) : null;
}

/** Siguiente número libre para una variación sin nombre: el mayor «mN» que
 *  ya exista más uno. */
export function siguienteNumeroVariacion(nombres: Iterable<string>): number {
  let max = 0;
  for (const nombre of nombres) {
    const n = numeroVariacion(nombre);
    if (n !== null && n > max) max = n;
  }
  return max + 1;
}

/** Copia de las variaciones con nombre en todas: las vacías reciben «m1»,
 *  «m2»… sin repetir los que ya hay. Las demás quedan igual (sin espacios
 *  a los lados). */
export function nombrarVariaciones<T extends { nombre: string }>(
  subs: readonly T[],
): T[] {
  let n = siguienteNumeroVariacion(subs.map((s) => s.nombre));
  return subs.map((s) => {
    const nombre = (s.nombre ?? "").trim();
    return { ...s, nombre: nombre || `m${n++}` };
  });
}

/** Nombre para un artículo que se guarda sin nombre: la subcategoría y el
 *  siguiente número libre («Metálico 3»). `nombresExistentes` son los
 *  nombres de los demás artículos. */
export function nombreAutomaticoArticulo(
  subcategoriaNombre: string,
  nombresExistentes: Iterable<string>,
): string {
  const base = (subcategoriaNombre ?? "").trim();
  const baseN = normalizarTexto(base);
  let max = 0;
  for (const nombre of nombresExistentes) {
    const n = normalizarTexto(nombre ?? "");
    if (!n.startsWith(`${baseN} `)) continue;
    const resto = n.slice(baseN.length + 1);
    if (/^\d{1,6}$/.test(resto)) max = Math.max(max, Number(resto));
  }
  return `${base} ${max + 1}`;
}

// ---------- Validación del registro ----------

export type ArticuloMayoreoEntrada = {
  categoriaId: string;
  subcategoriaId: string;
  tieneVariaciones: boolean;
  /** Cuántas variaciones trae el formulario. */
  variaciones: number;
  precioPropio: boolean;
  /** Solo con `precioPropio`: los dos precios como texto. */
  precio: string;
  menudeo: string;
};

/** Valida el registro simplificado. Devuelve el mensaje o `null`. */
export function validarArticuloMayoreo(
  e: ArticuloMayoreoEntrada,
  precios: PreciosMayoreo | null | undefined,
): string | null {
  if (!e.categoriaId) return "Elige la categoría";
  if (!e.subcategoriaId) return "Elige la subcategoría";
  if (e.tieneVariaciones && e.variaciones < 1) {
    return "Agrega al menos una variación, o marca que no tiene";
  }
  if (e.precioPropio) return validarPrecioNivel(e.precio, e.menudeo);
  if (!resolverPrecioHeredado(e, precios)) {
    return "Esta categoría todavía no tiene precio de mayoreo: captúralo o marca «Este artículo tiene precio diferente»";
  }
  return null;
}

// ---------- Artículos finales y sus códigos ----------

/** Forma de un código de artículo final (el `id` o un `codigoBarras`). */
export function esCodigoArticuloFinal(codigo: string): boolean {
  return /^\d{8}$/.test(codigo);
}

/** «Artículo — variación», o solo el nombre del artículo. */
export function nombreArticuloFinal(
  art: Pick<Articulo, "nombre">,
  sub?: Pick<ArticuloSubvariacion, "nombre"> | null,
): string {
  return sub ? `${art.nombre} — ${sub.nombre}` : art.nombre;
}

export type ArticuloFinal = {
  articulo: Articulo;
  subvariacion?: ArticuloSubvariacion;
  /** Código de 8 dígitos; "" si la variación todavía no tiene el suyo. */
  codigo: string;
  nombre: string;
};

/** Lo que se etiqueta y se cuenta de un artículo: él mismo, o cada una de
 *  sus variaciones. */
export function articulosFinales(art: Articulo): ArticuloFinal[] {
  const subs = art.subvariaciones ?? [];
  if (subs.length === 0) {
    return [{ articulo: art, codigo: art.id, nombre: art.nombre }];
  }
  return subs.map((s) => ({
    articulo: art,
    subvariacion: s,
    codigo: s.codigoBarras ?? "",
    nombre: nombreArticuloFinal(art, s),
  }));
}

export type VariacionPorCodigo = {
  articulo: Articulo;
  subvariacion: ArticuloSubvariacion;
};

/** Índice `codigoBarras` → variación, para los lectores de código. */
export function indiceCodigosVariacion(
  articulos: Iterable<Articulo>,
): Map<string, VariacionPorCodigo> {
  const indice = new Map<string, VariacionPorCodigo>();
  for (const articulo of articulos) {
    for (const subvariacion of articulo.subvariaciones ?? []) {
      const c = subvariacion.codigoBarras;
      if (c && esCodigoArticuloFinal(c) && !indice.has(c)) {
        indice.set(c, { articulo, subvariacion });
      }
    }
  }
  return indice;
}

/** Variaciones que todavía necesitan su código de 8 dígitos. */
export function variacionesSinCodigo(
  subs: readonly Pick<ArticuloSubvariacion, "codigoBarras">[],
): number {
  return subs.filter((s) => !s.codigoBarras).length;
}

/** Reparte `codigos` (en orden) entre las variaciones que no tienen
 *  `codigoBarras`; las que ya lo tienen lo conservan. */
export function repartirCodigosVariacion<
  T extends Pick<ArticuloSubvariacion, "codigoBarras">,
>(subs: readonly T[], codigos: readonly string[]): T[] {
  let i = 0;
  return subs.map((s) => {
    if (s.codigoBarras) return s;
    const codigo = codigos[i++];
    if (!codigo) throw new Error("Faltan códigos para las variaciones");
    return { ...s, codigoBarras: codigo };
  });
}
