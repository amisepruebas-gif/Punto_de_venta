import { desgloseVenta, etiquetaTarjetaClip, mostrarMetaTicket, subtotalLinea } from "@shared";
import type {
  Sucursal,
  Venta,
  MovimientoPago,
  TicketLinea,
} from "@shared";

/**
 * Formatea una venta como string ESC/POS para la impresora térmica
 * Bluetooth. Asume impresora de 48 mm (~32 caracteres por línea, dpi 203).
 *
 * Etiquetas soportadas (lib DantSu):
 *   [L] [C] [R]                  — alineación
 *   <b>...</b>                   — bold
 *   <u>...</u>                   — underline
 *   <font size='big'>...</font>  — 2x altura
 *   <font size='tall'>...</font> — solo alto 2x
 *   <font size='small'>...</font>— compacto
 *   \n                           — line feed
 */
const ANCHO_LINEA = 32;

const MOVIMIENTO_ETIQUETA: Record<MovimientoPago, string> = {
  pagoEfectivo: "EFECTIVO",
  pagoTarjeta: "TARJETA",
  pagoTransferencia: "TRANSFERENCIA",
  pagoDividido: "PAGO DIVIDIDO",
};

function divisor() {
  return `[C]${"-".repeat(ANCHO_LINEA)}\n`;
}

/** Limpia caracteres que confunden al parser ESC/POS de la lib (los `[`,
 *  `<`, `>` se interpretan como tags). Si tus nombres de artículo los
 *  pueden tener, tendrás que escaparlos antes. */
function s(text: string | undefined | null): string {
  if (!text) return "";
  return text
    .replace(/\[/g, "(")
    .replace(/]/g, ")")
    .replace(/</g, "(")
    .replace(/>/g, ")");
}

/** Renderiza una línea editable como string ESC/POS. */
function renderLinea(l: TicketLinea): string {
  const tagAlineacion =
    l.alineacion === "left" ? "[L]" : l.alineacion === "right" ? "[R]" : "[C]";
  const texto = s(l.texto);
  switch (l.estilo) {
    case "big":
      return `${tagAlineacion}<font size='big'>${texto}</font>\n`;
    case "bold":
      return `${tagAlineacion}<b>${texto}</b>\n`;
    case "small":
      return `${tagAlineacion}<font size='small'>${texto}</font>\n`;
    default:
      return `${tagAlineacion}${texto}\n`;
  }
}

export function formatearTicketEscPos(
  venta: Venta,
  sucursal: Sucursal | null,
): string {
  const out: string[] = [];

  // Header — usa ticketConfig.encabezado si tiene líneas; si no, fallback
  // automático con nombre/direccion/telefono de la sucursal.
  const encabezado = sucursal?.ticketConfig?.encabezado ?? [];
  if (encabezado.length > 0) {
    for (const l of encabezado) out.push(renderLinea(l));
  } else {
    out.push("[C]<u><font size='big'>AMISE</font></u>\n");
    if (sucursal?.nombre) {
      out.push(`[C]<b>${s(sucursal.nombre)}</b>\n`);
    }
    if (sucursal?.direccion) {
      out.push(`[C]<font size='small'>${s(sucursal.direccion)}</font>\n`);
    }
    if (sucursal?.telefono) {
      out.push(`[C]<font size='small'>Tel: ${s(sucursal.telefono)}</font>\n`);
    }
  }
  out.push("[L]\n");

  // Meta — cada línea respeta su toggle de `ticketConfig.mostrar`. Si los
  // tres están off, omitimos el divisor para no dejar líneas separadoras
  // huérfanas.
  const cfg = sucursal?.ticketConfig;
  const mostrarNumero = mostrarMetaTicket(cfg, "numeroTicket");
  const mostrarFecha = mostrarMetaTicket(cfg, "fecha");
  const mostrarVendedor = mostrarMetaTicket(cfg, "vendedor");
  if (mostrarNumero) {
    out.push(`[L]Ticket #${s(venta.numeroDeVenta)}\n`);
  }
  if (mostrarFecha && venta.fecha) {
    out.push(`[L]${s(venta.fecha)}\n`);
  }
  if (mostrarVendedor && venta.enTurno) {
    out.push(`[L]Vendedor: ${s(venta.enTurno)}\n`);
  }
  if (mostrarNumero || mostrarFecha || mostrarVendedor) {
    out.push(divisor());
  }

  // Items
  for (const a of venta.articulos) {
    const precioBase = Number(a.precio) || 0;
    const precioFinal = Number(a.descuento) || precioBase;
    // Subtotal cobrado: respeta 3x2 (antes lo ignoraba) y promo/mayoreo.
    const subtotal = subtotalLinea(a);

    const nombre = a.subvariacionNombre
      ? `${a.nombrePublico} - ${a.subvariacionNombre}`
      : a.nombrePublico;

    out.push(`[L]${a.cantidad}x ${s(nombre)}\n`);
    if (a.subvariacionCodigo) {
      out.push(
        `[L]<font size='small'>${s(a.subvariacionCodigo)}</font>\n`,
      );
    }
    if (a.talla) {
      out.push(`[L]<font size='small'>Talla: ${s(a.talla)}</font>\n`);
    }
    if (a.mayoreoAply) {
      // Igual que el ticket del Android nodo_1: "MAYOREO $precio c/u".
      out.push(
        `[L]<font size='small'>MAYOREO $${precioFinal} c/u</font>` +
          `[R]<b>$${subtotal}</b>\n`,
      );
    } else if (a.descuento) {
      out.push(
        `[L]<font size='small'>$${precioBase} c/u con desc.</font>` +
          `[R]<b>$${subtotal}</b>\n`,
      );
    } else {
      out.push(
        `[L]<font size='small'>$${precioFinal} c/u</font>` +
          `[R]<b>$${subtotal}</b>\n`,
      );
    }
  }

  out.push(divisor());

  // Totales, mismo orden que la confirmación, el ticket en pantalla y admin
  // (desgloseVenta): Artículos → − Cashback → − Crédito de regalo →
  // (Subtotal → Comisión) → TOTAL. montoCobro ya viene neto de descuentos.
  const d = desgloseVenta(venta);
  const m = (n: number) => String(Math.round(n * 100) / 100);
  if (d.cashback > 0 || d.regalo > 0) {
    out.push(`[L]Articulos[R]$${m(d.articulos)}\n`);
    if (d.cashback > 0) out.push(`[L]Cashback usado[R]-$${m(d.cashback)}\n`);
    if (d.regalo > 0) out.push(`[L]Credito de regalo[R]-$${m(d.regalo)}\n`);
  }

  if (d.comision > 0) {
    out.push(`[L]Subtotal[R]$${venta.montoCobro}\n`);
    out.push(`[L]Comision[R]+$${venta.comicion}\n`);
    out.push(
      `[L]<b>Total con tarjeta</b>[R]<b>$${venta.montoPago}</b>\n`,
    );
  } else {
    out.push(`[L]<font size='big'>TOTAL</font>` +
      `[R]<font size='big'><b>$${venta.montoCobro}</b></font>\n`);
  }

  out.push(`[L]Pago[R]$${venta.montoPago}\n`);
  if (venta.movimiento === "pagoEfectivo" && Number(venta.cambio) > 0) {
    out.push(`[L]Cambio[R]<b>$${venta.cambio}</b>\n`);
  }

  out.push("[L]\n");
  out.push(
    `[C]<b>${MOVIMIENTO_ETIQUETA[venta.movimiento] ?? venta.movimiento}</b>\n`,
  );
  // Cobro con la terminal Clip: marca y últimos 4 dígitos (sin "•", que la
  // impresora no tiene).
  if (venta.pagoClip) {
    const tarjeta = etiquetaTarjetaClip(venta.pagoClip).replace(/•/g, "*") || "Terminal Clip";
    out.push(`[C]${tarjeta}\n`);
  }
  out.push("[L]\n");

  // Aviso INTERNO de sobreventa (se cobró sin stock suficiente). Discreto
  // (letra chica) para auditoría/inventario sin alarmar al cliente.
  if (venta.sobreventa) {
    out.push("[C]<font size='small'>* articulo sin stock al cobrar *</font>\n");
    out.push("[L]\n");
  }

  // Cashback: lo acumulado en esta venta y, si es cliente nuevo, su contraseña
  // temporal para activar la cuenta en amise.mx. Un solo bloque.
  const acumulado = Number(venta.puntosGanados) > 0;
  if (acumulado || venta.codigoPuntos) {
    out.push("[C]<b>* CASHBACK AMISE *</b>\n");
    if (acumulado) {
      out.push(`[L]Cashback acumulado[R]<b>+$${s(venta.puntosGanados)}</b>\n`);
      if (venta.puntosSaldoDinero) {
        out.push(`[L]Saldo disponible[R]<b>$${s(venta.puntosSaldoDinero)}</b>\n`);
      }
    }
    if (venta.codigoPuntos) {
      out.push(`[L]Contrasena temporal[R]<b>${s(venta.codigoPuntos)}</b>\n`);
      out.push("[C]<font size='small'>Activala en amise.mx con tu correo</font>\n");
    } else {
      out.push("[C]<font size='small'>Consulta tu cashback en amise.mx</font>\n");
    }
    out.push("[L]\n");
  }

  // Pie — usa ticketConfig.pie si tiene líneas; si no, fallback automático.
  const pie = sucursal?.ticketConfig?.pie ?? [];
  if (pie.length > 0) {
    for (const l of pie) out.push(renderLinea(l));
  } else {
    out.push("[C]<font size='small'>¡Gracias por tu compra!</font>\n");
  }
  out.push("[L]\n");

  // QR opcional al cierre — DantSu interpreta <qrcode size='N'>...</qrcode>
  // nativamente. `size` es el tamaño del módulo: 25 da un QR cómodo en
  // impresora térmica de 48 mm sin desbordar.
  const qr = sucursal?.ticketConfig?.qr;
  if (qr && qr.contenido.trim().length > 0) {
    const contenido = s(qr.contenido.trim());
    out.push(`[C]<qrcode size='25'>${contenido}</qrcode>\n`);
    if (qr.leyenda) {
      out.push(`[C]<font size='small'>${s(qr.leyenda)}</font>\n`);
    }
    out.push("[L]\n");
  }

  return out.join("");
}
