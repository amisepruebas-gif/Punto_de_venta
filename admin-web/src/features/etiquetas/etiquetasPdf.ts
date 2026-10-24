import { resolverEscalones, type Articulo } from "@shared";

/**
 * Hoja PDF de etiquetas para artículos (Fabricación): nombre, precio,
 * primer precio de mayoreo y código de barras Code128 del id de 8 dígitos
 * (lo que el lector del POS teclea + Enter). Una etiqueta por pieza.
 *
 * pdfmake (~2 MB con fuentes) y jsbarcode se cargan solo al generar, igual
 * que el ticket PDF de nodo-web.
 */
export type FormatoEtiqueta = "carta-3x10" | "rollo-50x25";

export const FORMATOS_ETIQUETA: Record<FormatoEtiqueta, string> = {
  "carta-3x10": "Hoja carta, 30 por hoja (3 × 10, 6.7 × 2.5 cm)",
  "rollo-50x25": "Rollo térmico 50 × 25 mm (una por etiqueta)",
};

const PT_POR_MM = 72 / 25.4;

/** PNG (data URL) del código de barras Code128 de `codigo`. */
async function codigoDeBarras(codigo: string): Promise<string> {
  const { default: JsBarcode } = await import("jsbarcode");
  const canvas = document.createElement("canvas");
  JsBarcode(canvas, codigo, {
    format: "CODE128",
    displayValue: false,
    // Zona de silencio de 10 módulos por lado (2 px por módulo): sin ella
    // algunos lectores no leen la etiqueta pegada a la siguiente.
    margin: 20,
    height: 60,
    width: 2,
  });
  return canvas.toDataURL("image/png");
}

async function cargarPdfMake() {
  // @ts-expect-error — pdfmake no expone tipos de su build
  const pdfMakeMod = await import("pdfmake/build/pdfmake");
  const pdfMake = pdfMakeMod.default ?? pdfMakeMod;
  // @ts-expect-error — vfs_fonts es JS puro
  const pdfFontsMod = await import("pdfmake/build/vfs_fonts");
  const fonts = ((pdfFontsMod as { default?: unknown }).default ??
    pdfFontsMod) as {
    vfs?: Record<string, string>;
    pdfMake?: { vfs?: Record<string, string> };
  };
  const vfs =
    fonts.pdfMake?.vfs ??
    fonts.vfs ??
    ("Roboto-Regular.ttf" in fonts
      ? (fonts as unknown as Record<string, string>)
      : undefined);
  if (!vfs) throw new Error("No se cargaron las fuentes del PDF");
  (pdfMake as { vfs: unknown }).vfs = vfs;
  return pdfMake as {
    createPdf: (doc: unknown) => PdfEtiquetas;
  };
}

export type PdfEtiquetas = {
  download: (nombre: string) => void;
  getBlob: (cb: (blob: Blob) => void) => void;
};

function recortar(texto: string, max: number): string {
  return texto.length > max ? `${texto.slice(0, max - 1)}…` : texto;
}

/** Contenido de una etiqueta: `ancho` y `altoBarras` en pt; el nombre se
 *  recorta para que la etiqueta no crezca de alto. */
function etiqueta(
  art: Articulo,
  barras: string,
  { ancho, altoBarras, maxNombre }: { ancho: number; altoBarras: number; maxNombre: number },
) {
  const mayoreo = resolverEscalones(art)[0];
  return {
    stack: [
      {
        columns: [
          {
            text: recortar(art.nombre, maxNombre),
            bold: true,
            fontSize: 7,
          },
          {
            text: `$${art.precioVenta}`,
            bold: true,
            fontSize: 11,
            alignment: "right",
            width: "auto",
          },
        ],
        columnGap: 4,
      },
      ...(mayoreo
        ? [
            {
              text: `Mayoreo ${mayoreo.minPz}+ pz: $${mayoreo.precio} c/u`,
              fontSize: 6,
            },
          ]
        : []),
      { image: barras, width: ancho, height: altoBarras, margin: [0, 2, 0, 0] },
      { text: art.id, fontSize: 7, alignment: "center", characterSpacing: 1 },
    ],
  };
}

/** PDF con `cantidad` etiquetas de `art` (sin descargar todavía). */
export async function crearPdfEtiquetas(
  art: Articulo,
  cantidad: number,
  formato: FormatoEtiqueta,
): Promise<PdfEtiquetas> {
  if (!Number.isInteger(cantidad) || cantidad <= 0) {
    throw new Error("Indica cuántas etiquetas (entero mayor que 0)");
  }
  if (cantidad > 3000) throw new Error("Máximo 3000 etiquetas por PDF");
  const [pdfMake, barras] = await Promise.all([
    cargarPdfMake(),
    codigoDeBarras(art.id),
  ]);
  return pdfMake.createPdf(construirDocEtiquetas(art, cantidad, formato, barras));
}

/** Genera y descarga el PDF con `cantidad` etiquetas de `art`. */
export async function descargarEtiquetas(
  art: Articulo,
  cantidad: number,
  formato: FormatoEtiqueta,
): Promise<void> {
  const pdf = await crearPdfEtiquetas(art, cantidad, formato);
  pdf.download(`etiquetas-${art.id}-${cantidad}.pdf`);
}

/**
 * Documento pdfmake con `cantidad` etiquetas (puro: `barras` es el PNG del
 * código de barras ya generado). Exportado para probar el acomodo.
 */
export function construirDocEtiquetas(
  art: Articulo,
  cantidad: number,
  formato: FormatoEtiqueta,
  barras: string,
): Record<string, unknown> {
  let docDefinition: Record<string, unknown>;
  if (formato === "rollo-50x25") {
    const opts = { ancho: 50 * PT_POR_MM - 8, altoBarras: 26, maxNombre: 40 };
    docDefinition = {
      pageSize: { width: 50 * PT_POR_MM, height: 25 * PT_POR_MM },
      pageMargins: [4, 3, 4, 2],
      content: Array.from({ length: cantidad }, (_, i) => ({
        ...etiqueta(art, barras, opts),
        ...(i < cantidad - 1 ? { pageBreak: "after" } : {}),
      })),
      defaultStyle: { font: "Roboto" },
    };
  } else {
    // Carta 3 × 10 (medidas tipo Avery 5160): etiquetas de 189 × 72 pt,
    // 9 pt entre columnas, márgenes 13.5 pt a los lados y 36 pt arriba y
    // abajo. Columnas 0, 2 y 4 = etiquetas (con relleno); 1 y 3 = separación.
    const ANCHO = 189;
    const ALTO = 72;
    const SEPARACION = 9;
    const RELLENO = 6;
    const esEtiqueta = (col: number) => col % 2 === 0;
    const opts = { ancho: ANCHO - RELLENO * 2, altoBarras: 22, maxNombre: 46 };
    const filas: unknown[][] = [];
    for (let i = 0; i < cantidad; i += 3) {
      const fila: unknown[] = [];
      for (let c = 0; c < 3; c++) {
        if (c > 0) fila.push({ text: "" });
        fila.push(i + c < cantidad ? etiqueta(art, barras, opts) : { text: "" });
      }
      filas.push(fila);
    }
    const anchoCol = ANCHO - RELLENO * 2;
    docDefinition = {
      pageSize: "LETTER",
      pageMargins: [13.5, 36, 13.5, 36],
      content: [
        {
          table: {
            widths: [anchoCol, SEPARACION, anchoCol, SEPARACION, anchoCol],
            heights: ALTO - RELLENO * 2,
            dontBreakRows: true,
            body: filas,
          },
          layout: {
            hLineWidth: () => 0,
            vLineWidth: () => 0,
            paddingLeft: (col: number) => (esEtiqueta(col) ? RELLENO : 0),
            paddingRight: (col: number) => (esEtiqueta(col) ? RELLENO : 0),
            paddingTop: () => RELLENO,
            paddingBottom: () => RELLENO,
          },
        },
      ],
      defaultStyle: { font: "Roboto" },
    };
  }
  return docDefinition;
}
