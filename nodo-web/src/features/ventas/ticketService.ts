import QRCode from "qrcode";
import { mostrarMetaTicket } from "@shared";
import type { Venta, Sucursal, TicketLinea } from "@shared";

type PdfBlock = Record<string, unknown>;

function lineaAPdf(l: TicketLinea): PdfBlock {
  const alignment =
    l.alineacion === "left"
      ? "left"
      : l.alineacion === "right"
        ? "right"
        : "center";
  let fontSize = 9;
  let bold = false;
  switch (l.estilo) {
    case "big":
      fontSize = 14;
      bold = true;
      break;
    case "bold":
      bold = true;
      break;
    case "small":
      fontSize = 8;
      break;
  }
  return { text: l.texto, alignment, fontSize, bold };
}

/**
 * Genera un PDF del ticket. Retorna Blob para que el caller decida:
 * abrir en nueva pestaña, descargar, o compartir via `navigator.share`.
 *
 * `pdfmake` se carga dinámicamente para no inflar el bundle principal.
 */
export async function generarTicketPDF(params: {
  venta: Venta;
  sucursal: Sucursal | null;
  negocioNombre?: string;
}): Promise<Blob> {
  const { venta, sucursal, negocioNombre = "Amise" } = params;

  // Import dinámico + vfs fonts. La estructura de `vfs_fonts` cambia entre
  // versiones de pdfmake y bundlers (CJS/ESM). Probamos las 4 ubicaciones
  // conocidas; si ninguna trae un objeto utilizable, lanzamos error claro
  // en vez de dejar que pdfmake falle silenciosamente luego.
  // @ts-expect-error — pdfmake types no están bien expuestos en el build
  const pdfMakeMod = await import("pdfmake/build/pdfmake");
  const pdfMake = pdfMakeMod.default ?? pdfMakeMod;
  // @ts-expect-error — vfs-fonts es JS puro
  const pdfFontsMod = await import("pdfmake/build/vfs_fonts");
  const pdfFonts =
    (pdfFontsMod as { default?: unknown }).default ?? pdfFontsMod;
  const fonts = pdfFonts as {
    vfs?: Record<string, string>;
    pdfMake?: { vfs?: Record<string, string> };
  };
  const vfs =
    fonts.pdfMake?.vfs ??
    fonts.vfs ??
    (typeof fonts === "object" && fonts && "Roboto-Regular.ttf" in fonts
      ? (fonts as unknown as Record<string, string>)
      : undefined);
  if (!vfs) {
    throw new Error(
      "pdfmake vfs_fonts no se cargó (estructura inesperada del módulo).",
    );
  }
  (pdfMake as { vfs: unknown }).vfs = vfs;

  const metodoPago = metodoLegible(venta.movimiento);
  const subtotal = venta.articulos.reduce((acc, a) => {
    return acc + (Number(a.cantidad) || 0) * (Number(a.precio) || 0);
  }, 0);

  const itemsTable = [
    [
      { text: "Cant", style: "tableHeader" },
      { text: "Artículo", style: "tableHeader" },
      { text: "Precio", style: "tableHeader", alignment: "right" },
      { text: "Subtotal", style: "tableHeader", alignment: "right" },
    ],
    ...venta.articulos.map((a) => {
      const cant = Number(a.cantidad) || 0;
      const precio = Number(a.precio) || 0;
      return [
        { text: String(cant) },
        {
          text: a.nombrePublico + (a.talla ? ` (${a.talla})` : ""),
        },
        { text: `$${precio.toFixed(2)}`, alignment: "right" },
        { text: `$${(cant * precio).toFixed(2)}`, alignment: "right" },
      ];
    }),
  ];

  const encabezado = sucursal?.ticketConfig?.encabezado ?? [];
  const pie = sucursal?.ticketConfig?.pie ?? [];
  const qr = sucursal?.ticketConfig?.qr;

  // Genera el dataURL del QR antes de armar el doc (pdfmake espera string
  // base64, no Promise). Si falla, omitimos el bloque sin tirar el ticket.
  let qrDataUrl: string | null = null;
  if (qr && qr.contenido.trim().length > 0) {
    try {
      qrDataUrl = await QRCode.toDataURL(qr.contenido.trim(), {
        margin: 1,
        errorCorrectionLevel: "M",
        width: 200,
      });
    } catch (e) {
      console.warn("ticketService: QR no se pudo generar:", e);
    }
  }

  const headerBlocks: PdfBlock[] =
    encabezado.length > 0
      ? encabezado.map(lineaAPdf)
      : [
          {
            text: negocioNombre,
            style: "negocio",
            alignment: "center",
          },
          sucursal
            ? {
                text: `${sucursal.nombre}\n${sucursal.direccion}`,
                style: "sucursal",
                alignment: "center",
              }
            : {},
        ];

  const cfg = sucursal?.ticketConfig;
  const mostrarNumero = mostrarMetaTicket(cfg, "numeroTicket");
  const mostrarFecha = mostrarMetaTicket(cfg, "fecha");
  const mostrarVendedor = mostrarMetaTicket(cfg, "vendedor");
  const algunMeta = mostrarNumero || mostrarFecha || mostrarVendedor;

  const metaBlocks: PdfBlock[] = [];
  if (mostrarNumero || mostrarFecha) {
    const cols: PdfBlock[] = [];
    if (mostrarNumero) {
      cols.push({ text: `Venta #${venta.numeroDeVenta}`, fontSize: 9 });
    }
    if (mostrarFecha) {
      cols.push({
        text: venta.fecha,
        alignment: mostrarNumero ? "right" : "left",
        fontSize: 9,
      });
    }
    metaBlocks.push({
      columns: cols,
      margin: [0, 4, 0, 2] as [number, number, number, number],
    });
  }
  if (mostrarVendedor) {
    metaBlocks.push({ text: `Vendedor: ${venta.enTurno}`, fontSize: 9 });
  }

  // pdfmake puede atorarse silenciosamente con bloques vacíos `{}` mezclados
  // en el array `content`. Filtramos para mandar solo objetos con contenido
  // real. Cada entrada del content puede ser string, columns/table block,
  // texto, etc. — basta con descartar `{}` y `null`.
  function bloqueValido(b: unknown): boolean {
    if (b == null) return false;
    if (typeof b === "string") return b.length > 0;
    if (typeof b !== "object") return true;
    return Object.keys(b as Record<string, unknown>).length > 0;
  }

  const rawContent: unknown[] = [
      ...headerBlocks,
      { text: "─".repeat(32), alignment: "center", fontSize: 8 },
      ...metaBlocks,
      ...(algunMeta
        ? [
            {
              text: "─".repeat(32),
              alignment: "center",
              fontSize: 8,
              margin: [0, 4, 0, 4] as [number, number, number, number],
            } as PdfBlock,
          ]
        : []),
      {
        table: {
          widths: ["auto", "*", "auto", "auto"],
          body: itemsTable,
        },
        layout: "noBorders",
        fontSize: 9,
      },
      { text: "─".repeat(32), alignment: "center", fontSize: 8, margin: [0, 4, 0, 4] as [number, number, number, number] },
      ...(subtotal !== Number(venta.montoCobro)
        ? [
            {
              columns: [
                { text: "Subtotal" },
                { text: `$${subtotal.toFixed(2)}`, alignment: "right" },
              ],
              fontSize: 9,
            },
          ]
        : []),
      {
        columns: [
          { text: "Total", bold: true },
          {
            text: `$${Number(venta.montoCobro).toFixed(2)}`,
            alignment: "right",
            bold: true,
          },
        ],
        fontSize: 11,
        margin: [0, 2, 0, 2] as [number, number, number, number],
      },
      {
        columns: [
          { text: "Pago", fontSize: 9 },
          { text: metodoPago, alignment: "right", fontSize: 9 },
        ],
      },
      venta.movimiento === "pagoEfectivo"
        ? {
            columns: [
              { text: "Recibido", fontSize: 9 },
              {
                text: `$${Number(venta.montoPago).toFixed(2)}`,
                alignment: "right",
                fontSize: 9,
              },
            ],
          }
        : {},
      venta.movimiento === "pagoEfectivo" && Number(venta.cambio) > 0
        ? {
            columns: [
              { text: "Cambio", fontSize: 9 },
              {
                text: `$${Number(venta.cambio).toFixed(2)}`,
                alignment: "right",
                fontSize: 9,
              },
            ],
          }
        : {},
      venta.apartado === "1"
        ? {
            text: `APARTADO · ${venta.idApartado ?? ""}`,
            fontSize: 9,
            margin: [0, 4, 0, 0] as [number, number, number, number],
            bold: true,
          }
        : {},
      venta.descuentoPuntos && Number(venta.descuentoPuntos) > 0
        ? {
            columns: [
              { text: "Descuento por puntos", fontSize: 9 },
              {
                text: `-$${venta.descuentoPuntos}`,
                alignment: "right",
                fontSize: 9,
                bold: true,
              },
            ],
          }
        : {},
      venta.codigoPuntos
        ? {
            text: "* PUNTOS AMISE *",
            alignment: "center",
            fontSize: 9,
            bold: true,
            margin: [0, 4, 0, 0] as [number, number, number, number],
          }
        : {},
      venta.codigoPuntos
        ? {
            columns: [
              { text: "Contraseña temporal", fontSize: 9 },
              { text: venta.codigoPuntos, alignment: "right", fontSize: 9, bold: true },
            ],
          }
        : {},
      venta.codigoPuntos
        ? {
            text: "Actívala en amise.mx con tu correo",
            alignment: "center",
            fontSize: 8,
            italics: true,
          }
        : {},
      { text: "─".repeat(32), alignment: "center", fontSize: 8, margin: [0, 6, 0, 6] as [number, number, number, number] },
      ...(pie.length > 0
        ? pie.map(lineaAPdf)
        : [
            {
              text: "Gracias por su compra",
              alignment: "center",
              fontSize: 9,
              italics: true,
            },
          ]),
      ...(qrDataUrl
        ? [
            {
              image: qrDataUrl,
              width: 110,
              alignment: "center",
              margin: [0, 8, 0, 2] as [number, number, number, number],
            } as PdfBlock,
            ...(qr?.leyenda
              ? [
                  {
                    text: qr.leyenda,
                    alignment: "center",
                    fontSize: 8,
                  } as PdfBlock,
                ]
              : []),
          ]
        : []),
    ];

  const docDefinition = {
    pageSize: { width: 226.77, height: "auto" }, // 80mm
    pageMargins: [10, 15, 10, 15] as [number, number, number, number],
    content: rawContent.filter(bloqueValido),
    styles: {
      negocio: { fontSize: 14, bold: true, margin: [0, 0, 0, 2] },
      sucursal: { fontSize: 9 },
      tableHeader: { bold: true, fontSize: 9 },
    },
    defaultStyle: { fontSize: 10 },
  };

  // Timeout safety net: si pdfmake no llama el callback en 15s asumimos
  // que falló silenciosamente. Es preferible mostrar error visible al
  // usuario que dejar el botón "Generando…" para siempre.
  return new Promise<Blob>((resolve, reject) => {
    let resolved = false;
    const timer = window.setTimeout(() => {
      if (resolved) return;
      resolved = true;
      reject(new Error("Generación de PDF excedió 15s — pdfmake no respondió."));
    }, 15000);
    try {
      pdfMake.createPdf(docDefinition).getBlob((blob: Blob) => {
        if (resolved) return;
        resolved = true;
        window.clearTimeout(timer);
        resolve(blob);
      });
    } catch (e) {
      if (resolved) return;
      resolved = true;
      window.clearTimeout(timer);
      reject(e);
    }
  });
}

function metodoLegible(m: Venta["movimiento"]): string {
  switch (m) {
    case "pagoEfectivo":
      return "Efectivo";
    case "pagoTransferencia":
      return "Transferencia";
    case "pagoTarjeta":
      return "Tarjeta";
    case "pagoDividido":
      return "Dividido";
  }
}

/** Abre el PDF en nueva pestaña (permite imprimir con el diálogo nativo). */
export function abrirPDF(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank");
  if (!w) {
    // Popups bloqueados — descargar el PDF
    const a = document.createElement("a");
    a.href = url;
    a.download = "ticket.pdf";
    a.click();
  }
  // URL.revokeObjectURL(url) eventualmente; dejamos que navegador lo limpie
}

/** Comparte el PDF si el navegador soporta Web Share Level 2 (files). */
export async function compartirPDF(
  blob: Blob,
  nombre = "ticket.pdf",
): Promise<boolean> {
  const file = new File([blob], nombre, { type: "application/pdf" });
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
  };
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: nombre });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}
