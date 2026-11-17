import { codigoEtiquetaLote, etiquetaLoteLegible } from "@shared";
import {
  ANCHO_ETIQUETA,
  acomodarEtiquetas,
  cargarPdfMake,
  codigoDeBarras,
  type FormatoEtiqueta,
} from "./etiquetasPdf";

/**
 * Etiquetas numeradas para los lotes de envío: cada una es un código único
 * de 12 dígitos (`88` + consecutivo) que se pega en una caja o un paquete.
 * El teléfono la escanea al armar y la caja de la sucursal al recibir.
 *
 * Code128 en modo C (pares de dígitos): 12 dígitos caben en 6 símbolos, así
 * que la barra queda corta y con módulos anchos (3 px) aun en el rollo de
 * 50 mm. Margen de 30 px = 10 módulos de zona de silencio por lado.
 */
export const OPCIONES_BARRAS_LOTE = {
  format: "CODE128C",
  width: 3,
  margin: 30,
  height: 60,
  displayValue: false,
} as const;

// Alto (pt) de la imagen: la mitad es margen (30 px arriba y abajo de 60 px
// de barras). En carta todo debe caber en los 60 pt de la celda: si crece,
// la fila se alarga y la hoja ya no coincide con las etiquetas adheribles.
const ALTO_BARRAS: Record<FormatoEtiqueta, number> = {
  "rollo-50x25": 40,
  "carta-3x10": 34,
};

function etiquetaNumerada(codigo: string, barras: string, formato: FormatoEtiqueta) {
  return {
    stack: [
      { text: "AMISE · LOTE", fontSize: 6, alignment: "center", characterSpacing: 1 },
      {
        image: barras,
        width: ANCHO_ETIQUETA[formato],
        height: ALTO_BARRAS[formato],
        margin: [0, 1, 0, 1],
      },
      {
        text: etiquetaLoteLegible(codigo),
        fontSize: 10,
        bold: true,
        alignment: "center",
        characterSpacing: 1,
      },
    ],
  };
}

/**
 * Documento pdfmake con una etiqueta por código (puro: `barras` trae el PNG
 * de cada código ya generado). Exportado para probar el acomodo.
 */
export function construirDocEtiquetasNumeradas(
  codigos: string[],
  formato: FormatoEtiqueta,
  barras: Record<string, string>,
): Record<string, unknown> {
  return acomodarEtiquetas(codigos.length, formato, (i) => {
    const codigo = codigos[i]!;
    const png = barras[codigo];
    if (!png) throw new Error(`Falta el código de barras de ${codigo}`);
    return etiquetaNumerada(codigo, png, formato);
  });
}

/** Carga pdfmake y jsbarcode. Se llama ANTES de apartar números: si no
 *  cargan (sin internet) no se gasta ningún número. */
export async function prepararEtiquetasNumeradas(): Promise<void> {
  await Promise.all([cargarPdfMake(), import("jsbarcode")]);
}

/** Genera y descarga el PDF con las etiquetas `desde`…`hasta` (inclusive). */
export async function descargarEtiquetasNumeradas(
  desde: number,
  hasta: number,
  formato: FormatoEtiqueta,
): Promise<void> {
  if (!Number.isInteger(desde) || !Number.isInteger(hasta) || desde < 1 || hasta < desde) {
    throw new Error("Rango de etiquetas inválido");
  }
  const codigos: string[] = [];
  for (let n = desde; n <= hasta; n++) codigos.push(codigoEtiquetaLote(n));
  const pdfMake = await cargarPdfMake();
  const barras: Record<string, string> = {};
  // Una por una: con 3000 en paralelo el navegador crea 3000 canvas a la vez.
  for (const codigo of codigos) {
    barras[codigo] = await codigoDeBarras(codigo, OPCIONES_BARRAS_LOTE);
  }
  const pdf = pdfMake.createPdf(construirDocEtiquetasNumeradas(codigos, formato, barras));
  pdf.download(`etiquetas-lote-${codigos[0]}-${codigos[codigos.length - 1]}.pdf`);
}
