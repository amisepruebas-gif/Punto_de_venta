// ============================================================
// TSPL — comandos para la impresora de etiquetas por USB
// ============================================================
//
// TSPL (TSC Printer Language) es texto ASCII, una orden por línea: la
// impresora interpreta los bytes tal cual. Es el mismo formato de la app
// Android "codigos" (y de `nodo_1`): etiqueta de 29 × 14 mm con 3 mm de
// separación, densidad 8 y velocidad 4. A 203 dpi la etiqueta mide
// 232 × 112 puntos; las posiciones de abajo son en puntos.
//
// El encabezado va una sola vez y cada etiqueta es `CLS … PRINT n`.

import { esCodigoEtiquetaLote, etiquetaLoteLegible } from "./lotes";
import type { RenglonEtiquetaPrecio } from "./schema";
import {
  IMPRESION_TOPE_PIEZAS,
  RE_CODIGO_ARTICULO_ETIQUETA,
  RE_PRECIO_ETIQUETA,
} from "./impresion";

/** Configuración de la etiqueta, idéntica a "codigos". */
export const TSPL_ENCABEZADO_29X14: readonly string[] = [
  "SIZE 29 mm, 14 mm",
  "GAP 3 mm, 0 mm",
  "DENSITY 8",
  "SPEED 4",
  "DIRECTION 0",
  "REFERENCE 0,0",
  "SET TEAR ON",
  "SET TEAR ADJUST 5",
];

function texto(lineas: readonly string[]): string {
  return lineas.join("\n") + "\n";
}

/**
 * Un texto libre en ASCII simple: las fuentes internas de la impresora no
 * traen acentos, y una comilla rompería el comando.
 */
export function asciiTspl(s: string, max = 22): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 .,:#/-]/g, "")
    .trim()
    .slice(0, max);
}

/**
 * Una etiqueta de lote: código de barras Code128 de los 12 dígitos, centrado,
 * y el número legible abajo (`8800 0000 0123`).
 *   - 12 dígitos en Code128 (subconjunto C) son 101 módulos; a 2 puntos por
 *     módulo, 202 de 232 puntos: x = 15 lo centra (el de 8 dígitos de
 *     "codigos" cabe en x = 40, este no).
 *   - El número en la fuente "2" (12 × 20 puntos) mide 168: x = 32.
 */
export function tsplCuerpoEtiquetaLote(codigo: string): string[] {
  if (!esCodigoEtiquetaLote(codigo)) throw new Error(`Código de etiqueta inválido: ${codigo}`);
  return [
    "CLS",
    `BARCODE 15,8,"128",62,0,0,2,3,"${codigo}"`,
    `TEXT 32,76,"2",0,1,1,"${etiquetaLoteLegible(codigo)}"`,
    "PRINT 1",
  ];
}

/** Comandos para imprimir estas etiquetas de lote, una por código. */
export function tsplEtiquetasLote(codigos: readonly string[]): string {
  if (codigos.length === 0) throw new Error("No hay etiquetas que imprimir");
  return texto([...TSPL_ENCABEZADO_29X14, ...codigos.flatMap(tsplCuerpoEtiquetaLote)]);
}

/**
 * Una etiqueta de precio (con sus piezas), exactamente como "codigos":
 *   - registrado: `$precio`, código de barras del artículo y su código;
 *   - sin código: `NO REGISTRADO` y `$precio`.
 */
export function tsplCuerpoEtiquetaPrecio(r: RenglonEtiquetaPrecio): string[] {
  if (!RE_PRECIO_ETIQUETA.test(r.precio)) throw new Error(`Precio inválido: ${r.precio}`);
  if (!Number.isInteger(r.piezas) || r.piezas < 1 || r.piezas > IMPRESION_TOPE_PIEZAS) {
    throw new Error(`Piezas inválidas: ${r.piezas}`);
  }
  if (r.codigo === undefined) {
    return [
      "CLS",
      `TEXT 21,10,"1",0,2,2,"NO REGISTRADO"`,
      `TEXT 40,70,"1",0,2,2,"$${r.precio}"`,
      `PRINT ${r.piezas}`,
    ];
  }
  if (!RE_CODIGO_ARTICULO_ETIQUETA.test(r.codigo)) {
    throw new Error(`El código del artículo debe tener 8 dígitos: ${r.codigo}`);
  }
  return [
    "CLS",
    `TEXT 85,10,"1",0,2,2,"$${r.precio}"`,
    `BARCODE 40,35,"128",30,0,0,2,3,"${r.codigo}"`,
    `TEXT 40,70,"1",0,2,2,"${r.codigo}"`,
    `PRINT ${r.piezas}`,
  ];
}

/** Comandos para imprimir estas etiquetas de precio. */
export function tsplEtiquetasPrecio(renglones: readonly RenglonEtiquetaPrecio[]): string {
  if (renglones.length === 0) throw new Error("No hay etiquetas que imprimir");
  return texto([...TSPL_ENCABEZADO_29X14, ...renglones.flatMap(tsplCuerpoEtiquetaPrecio)]);
}

/** Etiqueta de prueba del programa: nombre de la impresora y un código de
 *  barras de 8 dígitos para probar el lector. */
export function tsplPrueba(nombre: string): string {
  return texto([
    ...TSPL_ENCABEZADO_29X14,
    "CLS",
    `TEXT 16,6,"2",0,1,1,"AMISE PRUEBA"`,
    `TEXT 16,30,"1",0,1,1,"${asciiTspl(nombre)}"`,
    `BARCODE 16,52,"128",30,0,0,2,3,"12345678"`,
    `TEXT 16,86,"1",0,1,1,"12345678"`,
    "PRINT 1",
  ]);
}
