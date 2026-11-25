// ============================================================
// Existencias de la tienda: bodega y tienda de cada artículo final
// ============================================================
// Puro (sin Firestore ni React). "Artículo final" = el artículo si no tiene
// variaciones, o cada variación (`articulosFinales` de @shared). Las páginas
// de Existencias y Mover leen de aquí las piezas de esta sucursal.

import {
  articuloVisibleEnSucursal,
  articulosFinales,
  coincidePalabras,
  FILTRO_SIN,
  leerExistenciasTienda,
  nombreArticuloFinal,
  nombreEnCaja,
  normalizarTexto,
  palabrasDeConsulta,
  type Articulo,
  type Categoria,
  type DireccionMovimientoExistencias,
  type ExistenciasTienda,
  type Subcategoria,
} from "@shared";

export type FilaExistencias = ExistenciasTienda & {
  /** Identifica el artículo final (ver `claveFinal`). */
  clave: string;
  articuloId: string;
  subvariacionCodigo?: string;
  /** Código de 8 dígitos; el `v-…` si la variación aún no tiene el suyo. */
  codigo: string;
  nombre: string;
  /** Solo si la categoría (o subcategoría) todavía existe. */
  categoriaId?: string;
  categoria: string;
  subcategoriaId?: string;
  subcategoria: string;
  /** Texto normalizado para el buscador (nombre, códigos, clasificación). */
  busqueda: string;
};

export function claveFinal(articuloId: string, subvariacionCodigo?: string): string {
  return `${articuloId}|${subvariacionCodigo ?? ""}`;
}

export type ContextoFilas = {
  sucursalId: string;
  esDefault: boolean;
  modoMayoreo: boolean | undefined;
  categorias: readonly Categoria[];
  subcategorias: readonly Subcategoria[];
};

const collator = new Intl.Collator("es", { sensitivity: "base", numeric: true });

/** Lo vacío (sin categoría o sin subcategoría) va al final. */
function compararTexto(a: string, b: string): number {
  if (!a || !b) return a ? -1 : b ? 1 : 0;
  return collator.compare(a, b);
}

function compararFilas(x: FilaExistencias, y: FilaExistencias): number {
  return (
    compararTexto(x.categoria, y.categoria) ||
    compararTexto(x.subcategoria, y.subcategoria) ||
    collator.compare(x.nombre, y.nombre)
  );
}

/** Artículos finales que se manejan en esta sucursal, con sus piezas en la
 *  bodega y en la tienda, ordenados por categoría, subcategoría y nombre. */
export function armarFilas(
  articulos: readonly Articulo[],
  ctx: ContextoFilas,
): FilaExistencias[] {
  const nombreCat = new Map(ctx.categorias.map((c) => [c.categoriaId, c.nombre]));
  const nombreSub = new Map(ctx.subcategorias.map((s) => [s.subcategoriaId, s.nombre]));
  const filas: FilaExistencias[] = [];
  for (const a of articulos) {
    if (!articuloVisibleEnSucursal(a, ctx.modoMayoreo)) continue;
    const categoria = (a.categoriaId && nombreCat.get(a.categoriaId)) || "";
    const subcategoria = (a.subcategoriaId && nombreSub.get(a.subcategoriaId)) || "";
    const base = { nombre: nombreEnCaja(a.nombre, categoria) };
    for (const final of articulosFinales(a)) {
      const sub = final.subvariacion;
      // Una variación sin `codigo` no se puede indicar al mover.
      if (sub && !sub.codigo) continue;
      const codigo = final.codigo || sub?.codigo || a.id;
      const nombre = nombreArticuloFinal(base, sub);
      filas.push({
        clave: claveFinal(a.id, sub?.codigo),
        articuloId: a.id,
        ...(sub?.codigo ? { subvariacionCodigo: sub.codigo } : {}),
        codigo,
        nombre,
        ...(categoria ? { categoriaId: a.categoriaId } : {}),
        categoria,
        ...(subcategoria ? { subcategoriaId: a.subcategoriaId } : {}),
        subcategoria,
        ...leerExistenciasTienda(sub ?? a, ctx.sucursalId, ctx.esDefault),
        busqueda: normalizarTexto(
          [nombre, codigo, sub?.codigo, a.id, a.sigla, categoria, subcategoria]
            .filter(Boolean)
            .join(" "),
        ),
      });
    }
  }
  return filas.sort(compararFilas);
}

// ---------- Buscador y filtros ----------

export type FiltroExistencias = {
  texto: string;
  /** id, `FILTRO_SIN` o "" (todas). */
  categoriaId: string;
  subcategoriaId: string;
};

function pasaId(id: string | undefined, filtro: string): boolean {
  if (!filtro) return true;
  return filtro === FILTRO_SIN ? !id : id === filtro;
}

/** Filas que pasan el texto (palabras en cualquier orden, o un código
 *  escaneado) y los filtros de clasificación. */
export function filtrarFilas(
  filas: readonly FilaExistencias[],
  f: FiltroExistencias,
): FilaExistencias[] {
  const palabras = palabrasDeConsulta(f.texto);
  return filas.filter(
    (x) =>
      pasaId(x.categoriaId, f.categoriaId) &&
      pasaId(x.subcategoriaId, f.subcategoriaId) &&
      coincidePalabras(x.busqueda, palabras),
  );
}

export type OpcionFiltro = { id: string; nombre: string };

/** Categorías (o subcategorías) que aparecen en `filas`, en el orden de las
 *  filas; al final «Sin …» si alguna no tiene. */
export function opcionesDe(
  filas: readonly FilaExistencias[],
  campo: "categoria" | "subcategoria",
): OpcionFiltro[] {
  const vistas = new Map<string, string>();
  let haySin = false;
  for (const x of filas) {
    const id = campo === "categoria" ? x.categoriaId : x.subcategoriaId;
    if (!id) haySin = true;
    else if (!vistas.has(id)) vistas.set(id, x[campo]);
  }
  const opciones = [...vistas].map(([id, nombre]) => ({ id, nombre }));
  if (haySin) {
    opciones.push({
      id: FILTRO_SIN,
      nombre: campo === "categoria" ? "Sin categoría" : "Sin subcategoría",
    });
  }
  return opciones;
}

export function sumarExistencias(filas: readonly ExistenciasTienda[]): ExistenciasTienda {
  let bodega = 0;
  let tienda = 0;
  for (const x of filas) {
    bodega += x.bodega;
    tienda += x.tienda;
  }
  return { bodega, tienda };
}

// ---------- Movimientos ----------

export const ETIQUETA_DIRECCION: Record<DireccionMovimientoExistencias, string> = {
  bodega_a_tienda: "Bodega → Tienda",
  tienda_a_bodega: "Tienda → Bodega",
};

/** Piezas que hay en el lado de donde salen. */
export function piezasEnOrigen(
  direccion: DireccionMovimientoExistencias,
  e: ExistenciasTienda,
): number {
  return direccion === "bodega_a_tienda" ? e.bodega : e.tienda;
}

export function nombreOrigen(direccion: DireccionMovimientoExistencias): string {
  return direccion === "bodega_a_tienda" ? "bodega" : "tienda";
}

/** Un artículo final en la lista de Mover. Guarda nombre y código para
 *  seguir mostrándolo si el artículo se borra mientras tanto. */
export type LineaMover = {
  clave: string;
  articuloId: string;
  subvariacionCodigo?: string;
  codigo: string;
  nombre: string;
  piezas: number;
};

export function totalPiezas(lineas: readonly LineaMover[]): number {
  return lineas.reduce((acc, l) => acc + l.piezas, 0);
}

/** Una pieza más de `fila`: suma a su línea, o la agrega arriba. */
export function sumarPieza(
  lineas: readonly LineaMover[],
  fila: FilaExistencias,
): LineaMover[] {
  if (lineas.some((l) => l.clave === fila.clave)) {
    return lineas.map((l) => (l.clave === fila.clave ? { ...l, piezas: l.piezas + 1 } : l));
  }
  const nueva: LineaMover = {
    clave: fila.clave,
    articuloId: fila.articuloId,
    ...(fila.subvariacionCodigo ? { subvariacionCodigo: fila.subvariacionCodigo } : {}),
    codigo: fila.codigo,
    nombre: fila.nombre,
    piezas: 1,
  };
  return [nueva, ...lineas];
}

/** Por qué no se puede mover la línea, o `null` si se puede. `fila` es el
 *  artículo final en vivo (sin ella, ya no está en esta sucursal). */
export function problemaDeLinea(
  l: LineaMover,
  fila: ExistenciasTienda | undefined,
  direccion: DireccionMovimientoExistencias,
): string | null {
  if (!fila) return "Ya no está en esta sucursal: quítalo de la lista";
  if (!Number.isInteger(l.piezas) || l.piezas <= 0) return "Escribe cuántas piezas";
  const hay = piezasEnOrigen(direccion, fila);
  if (l.piezas > hay) return `En ${nombreOrigen(direccion)} solo hay ${hay}`;
  return null;
}

export function piezasTexto(n: number): string {
  return `${n} ${n === 1 ? "pieza" : "piezas"}`;
}

export function articulosTexto(n: number): string {
  return `${n} ${n === 1 ? "artículo" : "artículos"}`;
}
