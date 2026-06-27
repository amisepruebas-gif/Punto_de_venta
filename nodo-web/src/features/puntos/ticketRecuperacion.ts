/**
 * Ticket de RECUPERACIÓN de contraseña de puntos (formato ESC/POS, 48 mm).
 * Reutiliza el mismo lenguaje de etiquetas del ticket de venta. Imprime la
 * contraseña NUEVA re-emitida (la vieja no se puede leer; va hasheada).
 */
const ANCHO = 32;

function s(text: string | undefined | null): string {
  if (!text) return "";
  return text.replace(/\[/g, "(").replace(/]/g, ")").replace(/</g, "(").replace(/>/g, ")");
}

export function formatearTicketRecuperacion(opts: {
  email: string;
  code: string;
  fecha: string;
  sucursalNombre?: string;
}): string {
  const out: string[] = [];
  out.push(`[C]<font size='big'><b>${s(opts.sucursalNombre || "AMISE")}</b></font>\n`);
  out.push("[L]\n");
  out.push(`[C]${"-".repeat(ANCHO)}\n`);
  out.push("[C]<b>RECUPERACION DE CONTRASENA</b>\n");
  out.push("[C]Programa de puntos\n");
  out.push(`[C]${"-".repeat(ANCHO)}\n`);
  out.push(`[L]Fecha[R]${s(opts.fecha)}\n`);
  out.push(`[L]Correo[R]${s(opts.email)}\n`);
  out.push("[L]\n");
  out.push("[C]Tu contrasena temporal:\n");
  out.push(`[C]<font size='big'><b>${s(opts.code)}</b></font>\n`);
  out.push("[L]\n");
  out.push("[C]<font size='small'>Activa tu cuenta en amise.mx con</font>\n");
  out.push("[C]<font size='small'>tu correo y esta contrasena.</font>\n");
  out.push(`[C]${"-".repeat(ANCHO)}\n`);
  out.push("[C]Gracias por tu preferencia\n");
  out.push("[C]<b>Visita amise.mx para encontrar mas</b>\n");
  out.push("[L]\n");
  out.push("[L]\n");
  return out.join("");
}
