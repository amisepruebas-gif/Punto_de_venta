/**
 * Lealtad (cashback, tarjeta de cliente y tarjeta de regalo): reglas puras
 * compartidas por la caja (nodo-web) y admin-web.
 *
 * Cola de envíos de la caja. Lo que vale dinero (registro, acumular, ligar
 * tarjeta, emitir o recargar regalo) se anota ANTES de llamar y nunca se
 * descarta solo: si falla sin remedio pasa a "fallidos", a la vista. Solo los
 * candados (cerrar canje / cerrar regalo) se descartan, porque el servidor
 * los vence solo.
 */
import { subtotalLinea, type LineaCobro } from "./precio";

/** Tipos de la cola. No agregar tipos: la versión anterior de la caja manda
 *  cualquier tipo desconocido a "acumular" (compatibilidad al regresar). */
export type TipoLlamadaPuntos =
  | "register"
  | "earn"
  | "canje"
  | "card"
  | "cerrar"
  | "gift"
  | "giftRecarga"
  | "cerrarRegalo";

const TIPOS_CON_VALOR: readonly TipoLlamadaPuntos[] = [
  "register",
  "earn",
  "card",
  "gift",
  "giftRecarga",
];

/** ¿La operación vale dinero? (nunca se descarta sola). */
export function esValorPuntos(tipo: string): boolean {
  return (TIPOS_CON_VALOR as readonly string[]).includes(tipo);
}

/** Intentos tras los que un candado se descarta (el servidor lo vence solo). */
export const MAX_INTENTOS_CANDADO = 60;

/** Qué hacer tras un error:
 *  - reintentar: red caída o falla pasajera; queda en la cola.
 *  - definitivo: el servidor lo rechazó; pasa a "fallidos".
 *  - hecho: el registro ya existía; lo que esperaba puede seguir. */
export type ClaseErrorPuntos = "reintentar" | "definitivo" | "hecho";

const CODIGOS_DEFINITIVOS = [
  "invalid-argument",
  "failed-precondition",
  "permission-denied",
  "not-found",
  "out-of-range",
];

/** Código de un error de callable sin el prefijo "functions/". */
export function codigoErrorPuntos(err: unknown): string {
  const code = (err as { code?: unknown } | null)?.code;
  return String(code ?? "").replace(/^functions\//, "");
}

/**
 * Clasifica el error de una callable de lealtad. Ojo: del lado del navegador
 * una red caída llega como `internal` sin `details` (el SDK no distingue), y el
 * servidor manda `details.retriable` en los errores de amise.
 */
export function clasificarErrorPuntos(tipo: string, err: unknown): ClaseErrorPuntos {
  const code = codigoErrorPuntos(err);
  const details = (err as { details?: { retriable?: unknown } } | null)?.details;
  if (code === "already-exists") return tipo === "register" ? "hecho" : "definitivo";
  if (details?.retriable === false) return "definitivo";
  if (CODIGOS_DEFINITIVOS.includes(code)) return "definitivo";
  return "reintentar";
}

/** Espera antes del siguiente intento: 1 min, luego 5 min, luego 30 min. */
export function esperaReintentoMs(intentos: number): number {
  if (intentos <= 3) return 60_000;
  if (intentos <= 6) return 5 * 60_000;
  return 30 * 60_000;
}

/** ¿Se descarta tras este fallo? Solo candados, nunca lo que vale dinero. */
export function descartarTrasFallo(tipo: string, intentos: number): boolean {
  return !esValorPuntos(tipo) && intentos >= MAX_INTENTOS_CANDADO;
}

type ItemColaPuntos = {
  id: string;
  tipo: string;
  payload: Record<string, unknown>;
  intentos: number;
  creadoEn?: number;
};

/** Recorta la cola a `max` quitando candados, los más viejos primero. Lo que
 *  vale dinero nunca se recorta (antes se perdía con la cola llena). */
export function recortarColaPuntos<T extends { tipo: string }>(cola: T[], max = 100): T[] {
  let sobran = cola.length - max;
  if (sobran <= 0) return cola;
  return cola.filter((x) => {
    if (sobran > 0 && !esValorPuntos(x.tipo)) {
      sobran -= 1;
      return false;
    }
    return true;
  });
}

/** ¿El cajero debe enterarse? Valor con 5+ intentos o más de 15 min. */
export function necesitaAtencionPuntos(item: ItemColaPuntos, ahora: number): boolean {
  if (!esValorPuntos(item.tipo)) return false;
  if (item.intentos >= 5) return true;
  return item.creadoEn != null && ahora - item.creadoEn > 15 * 60_000;
}

const digitos = (s: unknown) => String(s ?? "").replace(/\D/g, "");

/** Mismo teléfono: compara los últimos 10 dígitos (E.164 o local). */
export function telefonosIguales(a: unknown, b: unknown): boolean {
  const x = digitos(a);
  const y = digitos(b);
  return x.length >= 10 && y.length >= 10 && x.slice(-10) === y.slice(-10);
}

/** ¿Este acumular o ligar tarjeta espera a un registro del mismo teléfono que
 *  sigue en la cola? (el monedero aún no existe en amise). */
export function esperaRegistroPuntos(item: ItemColaPuntos, cola: ItemColaPuntos[]): boolean {
  if (item.tipo !== "earn" && item.tipo !== "card") return false;
  const tel = item.payload.phone;
  return cola.some(
    (x) => x.tipo === "register" && x.id !== item.id && telefonosIguales(x.payload.phone, tel),
  );
}

// ── Desglose de una venta (ticket, confirmación, ticket en pantalla, admin) ──

/** Campos de una venta (o de su vista previa) que definen sus totales. */
export type VentaDesglosable = {
  articulos?: LineaCobro[];
  montoCobro?: string | number;
  descuentoPuntos?: string | number;
  descuentoRegalo?: string | number;
  comicion?: string | number;
  statusComision?: string;
  movimiento?: string;
};

export type DesgloseVenta = {
  /** Suma de las líneas cobradas (3x2, mayoreo y descuentos por línea). */
  articulos: number;
  /** Cashback usado (descuento). */
  cashback: number;
  /** Crédito de regalo usado (descuento). */
  regalo: number;
  /** Lo cobrado antes de comisión (`montoCobro`, ya neto de descuentos). */
  total: number;
  /** Comisión por pago con tarjeta; 0 si no aplica. */
  comision: number;
  /** Lo que paga el cliente con tarjeta: total + comisión. */
  totalConComision: number;
};

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Totales en el mismo orden en todos lados: Artículos → − Cashback → −
 * Crédito de regalo → (Subtotal → Comisión) → TOTAL. Antes el crédito de
 * regalo no aparecía en ningún lado y el cashback salía después del total,
 * así que las cuentas no cuadraban a la vista. `sumaArticulos` permite a
 * admin usar su propia suma (ventas legacy con `precioVenta`).
 */
export function desgloseVenta(v: VentaDesglosable, sumaArticulos?: number): DesgloseVenta {
  const articulos =
    sumaArticulos ?? (v.articulos ?? []).reduce((s, l) => s + subtotalLinea(l), 0);
  const total = num(v.montoCobro);
  const comision =
    v.movimiento === "pagoTarjeta" && v.statusComision === "con comision"
      ? Math.max(0, num(v.comicion))
      : 0;
  return {
    articulos,
    cashback: Math.max(0, num(v.descuentoPuntos)),
    regalo: Math.max(0, num(v.descuentoRegalo)),
    total,
    comision,
    totalConComision: total + comision,
  };
}

// ── Tarjeta, correo ──

/** EAN-13 con dígito verificador (mismo criterio que amise `validarEAN13`). */
export function ean13Ok(codigo: string): boolean {
  if (!/^\d{13}$/.test(codigo)) return false;
  const n = codigo.split("").map(Number);
  const suma = n.slice(0, 12).reduce((a, d, i) => a + d * (i % 2 === 0 ? 1 : 3), 0);
  return (10 - (suma % 10)) % 10 === n[12];
}

const CORREO_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Correo con forma válida (lo demás lo valida amise). */
export function correoValido(correo: string): boolean {
  return CORREO_RE.test(correo.trim());
}

/** "juan@gmail.com" → "ju•••@gmail.com". Un correo ya oculto queda igual
 *  (el servidor nuevo ya lo manda oculto; el viejo, completo). */
export function enmascararCorreo(correo: unknown): string {
  const s = String(correo ?? "").trim();
  if (!s || s.includes("•••")) return s;
  const at = s.indexOf("@");
  if (at < 1) return "•••";
  return `${s.slice(0, Math.min(2, at))}•••${s.slice(at)}`;
}
