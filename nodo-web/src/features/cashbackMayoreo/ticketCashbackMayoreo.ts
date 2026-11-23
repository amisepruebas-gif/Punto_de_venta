import {
  URL_CASHBACK_PRODUCCION,
  textoVigencia,
  type VigenciaCashback,
} from "@shared";

/**
 * Ticket de la cuenta de cashback de mayoreo (ESC/POS, 48 mm, 32 columnas):
 * al abrir la cuenta o al reponer el PIN. Lleva el PIN grande, la página
 * (con su QR) y lo esencial de las condiciones. Sin acentos: las térmicas
 * no los imprimen bien.
 */
const ANCHO = 32;

function s(text: string | undefined | null): string {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[[\]<>]/g, (c) => (c === "[" || c === "<" ? "(" : ")"));
}

/** Corta un texto en renglones de `ancho` sin partir palabras. */
function renglones(texto: string, ancho: number): string[] {
  const out: string[] = [];
  let linea = "";
  for (const p of s(texto).split(/\s+/)) {
    if (!p) continue;
    if ((linea + " " + p).trim().length > ancho) {
      if (linea) out.push(linea);
      linea = p;
    } else {
      linea = (linea + " " + p).trim();
    }
  }
  if (linea) out.push(linea);
  return out;
}

export function formatearTicketCuentaCashback(o: {
  /** "Bienvenido" (alta) o "PIN nuevo" (reposición). */
  titulo: string;
  nombre?: string;
  telefono: string;
  pin: string;
  pct: number;
  vigencia: VigenciaCashback;
  fecha: string;
  sucursalNombre?: string;
  url?: string;
}): string {
  const url = o.url ?? URL_CASHBACK_PRODUCCION;
  const sinHttps = url.replace(/^https?:\/\//, "");
  const out: string[] = [];
  const peque = (t: string) => {
    for (const r of renglones(t, ANCHO)) out.push(`[C]<font size='small'>${r}</font>\n`);
  };
  out.push(`[C]<font size='big'><b>${s(o.sucursalNombre || "AMISE")}</b></font>\n`);
  out.push(`[C]${"-".repeat(ANCHO)}\n`);
  out.push("[C]<b>CASHBACK MAYOREO</b>\n");
  out.push(`[C]<b>${s(o.titulo).toUpperCase()}</b>\n`);
  out.push(`[C]${"-".repeat(ANCHO)}\n`);
  out.push(`[L]Fecha[R]${s(o.fecha)}\n`);
  if (o.nombre) out.push(`[L]Cliente[R]${s(o.nombre).slice(0, 18)}\n`);
  out.push(`[L]Telefono[R]***${s(o.telefono.slice(-4))}\n`);
  out.push("[L]\n");
  out.push("[C]Tu PIN para la pagina:\n");
  out.push(`[C]<font size='big'><b>${s(o.pin)}</b></font>\n`);
  out.push("[C]<font size='small'>Puedes cambiarlo en la pagina.</font>\n");
  out.push("[L]\n");
  out.push("[C]Entra con tu telefono y tu PIN:\n");
  out.push(`[C]<b>${s(sinHttps)}</b>\n`);
  out.push(`[C]<qrcode size='20'>${s(url)}</qrcode>\n`);
  out.push("[L]\n");
  peque(`Ganas el ${o.pct} % de lo que pagas con dinero. Usa tu QR (de la pagina) o tu tarjeta para acumular y gastar.`);
  peque(`Tu saldo vence si pasan ${textoVigencia(o.vigencia)} sin comprar. Cada 1 de enero vuelve a $0.`);
  peque("Beneficio opcional de la tienda. Cuida tu QR, tarjeta y PIN: la tienda no se hace responsable. Problemas: acude a la tienda.");
  out.push(`[C]${"-".repeat(ANCHO)}\n`);
  out.push("[L]\n");
  out.push("[L]\n");
  return out.join("");
}
