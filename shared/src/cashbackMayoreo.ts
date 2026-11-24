// ============================================================
// Cashback de mayoreo — propio de la tienda (sin amise.mx)
// ============================================================
//
// Solo en las cajas de sucursales con `modoMayoreo`. Una cuenta por teléfono
// (10 dígitos), con PIN de 4 dígitos para la página del cliente y un QR (o la
// tarjeta física) para acumular y gastar en la caja.
//   - Gana `pct` % de lo que paga con dinero (centavos, redondeo hacia abajo).
//   - Todo el saldo vence si no compra en `vigencia`; cada compra renueva.
//   - Además, cada 1 de enero (hora de México) el saldo vuelve a $0.
// La lógica del servidor (functions/lib/cashbackMayoreo.js) es una copia a
// mano de la de aquí: si cambias una, cambia la otra. Tests en
// admin-web/src/lib/__tests__/cashbackMayoreo.test.ts.
// Puro: sin Firestore ni React.

export type UnidadVigencia = "dias" | "meses" | "anios";

export type VigenciaCashback = { cantidad: number; unidad: UnidadVigencia };

/** `negocios/{nid}/cashback_mayoreo_web_new_version/config`. Lo edita admin. */
export type ConfigCashbackMayoreo = {
  activo: boolean;
  /** Porcentaje de cada compra que gana el cliente (3 = 3 %). */
  pct: number;
  vigencia: VigenciaCashback;
  actualizadoEn?: string;
  actualizadoPor?: string;
};

/** `negocios/{nid}/clientes_mayoreo_web_new_version/{telefono10}`. Solo lo
 *  escribe el servidor; admin lo lee. El PIN y el QR van aparte, en
 *  `privado/acceso` (cerrado). */
export type CuentaCashbackMayoreo = {
  telefono: string;
  nombre?: string;
  saldoCentavos: number;
  /** Última venta ligada a la cuenta (renueva la vigencia). */
  ultimaCompraISO?: string;
  /** Cuándo vence el saldo (ver `calcularVence`). */
  venceISO?: string;
  /** Tarjeta física ligada (13 dígitos), si tiene. */
  tarjeta?: string;
  fechaAltaISO: string;
  sucursalAlta: string;
  nodoAlta?: string;
  /** Sube al cambiar o reponer el PIN: invalida las sesiones de la página. */
  gen: number;
};

export type TipoMovimientoCashback =
  | "ganado"
  | "usado"
  | "vencido"
  | "devuelto"
  | "ajuste"
  /** Registro (sin dinero): la caja repuso el PIN. */
  | "pin_repuesto"
  /** Registro (sin dinero): la caja ligó una tarjeta. */
  | "tarjeta_ligada";

/** `.../clientes_mayoreo_web_new_version/{tel}/movimientos/{id}`. */
export type MovimientoCashbackMayoreo = {
  tipo: TipoMovimientoCashback;
  /** Siempre positivo; el tipo dice si suma o resta (el ajuste lleva signo). */
  centavos: number;
  /** Falta en los registros sin dinero. */
  saldoDespuesCentavos?: number;
  fechaISO: string;
  ventaId?: string;
  sucursalId?: string;
  nodoId?: string;
  motivo?: string;
  por?: string;
  /** Solo en `uso_{ventaId}`: "usado" (la venta aún no sube), "devuelto" o "confirmado". */
  estado?: "usado" | "devuelto" | "confirmado";
  /** Lo hizo el servidor solo (devolución tras 6 h sin venta, o recobro). */
  automatico?: boolean;
  tarjetaUltimos4?: string;
  verificadoCon?: string;
};

/** Lo que la venta lleva del cashback de mayoreo (lo lee el disparador que
 *  acredita). Va aparte del cashback de amise (`descuentoPuntos`). */
export type CashbackMayoreoVenta = {
  telefono: string;
  /** Lo que se usó de saldo en esta venta (ya descontado en el servidor). */
  usadoCentavos?: number;
  /** Lo que la caja calculó que gana (informativo: el servidor recalcula). */
  ganadoEstimadoCentavos?: number;
};

export const DEFAULT_CONFIG_CASHBACK: ConfigCashbackMayoreo = {
  activo: false,
  pct: 3,
  vigencia: { cantidad: 1, unidad: "meses" },
};

/** Página del cliente (producción). */
export const URL_CASHBACK_PRODUCCION = "https://amise-cashback.web.app";

// ---------- Teléfono ----------

/** Últimos 10 dígitos, o null si no hay 10. */
export function normalizarTelefono10(s: string | null | undefined): string | null {
  const d = String(s ?? "").replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : null;
}

/** "5512345678" → "•••• •• 5678". */
export function enmascararTelefono(tel: string): string {
  return `•••• •• ${tel.slice(-4)}`;
}

// ---------- QR ----------

/** Sin 0/O ni 1/I/L (como los códigos de caja): se lee y teclea sin dudas. */
export const ALFABETO_QR = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const PREFIJO_QR = "CBM";
export const LARGO_QR = 22;
const RE_QR = new RegExp(`^${PREFIJO_QR}[${ALFABETO_QR}]{${LARGO_QR}}$`);

/** Lo que manda el lector (o la cámara) → token del QR, o null si no es uno. */
export function leerQrCashback(texto: string | null | undefined): string | null {
  const t = String(texto ?? "").trim().toUpperCase();
  return RE_QR.test(t) ? t : null;
}

// ---------- Dinero ----------

/** Centavos que gana con `montoPesos` pagados con dinero (hacia abajo). */
export function ganadoCentavos(montoPesos: number, pct: number): number {
  const centavos = Math.round((Number(montoPesos) || 0) * 100);
  const pctCent = Math.round((Number(pct) || 0) * 100); // 2.5 % → 250
  if (centavos <= 0 || pctCent <= 0) return 0;
  return Math.floor((centavos * pctCent) / 10000);
}

/** 1234 → "$12.34"; 1200 → "$12". */
export function pesosDeCentavos(c: number): string {
  const n = Math.max(0, Math.round(c)) / 100;
  return `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
}

// ---------- Vencimiento (hora de México, UTC−6 fija desde 2022) ----------

const OFFSET_MX_MS = 6 * 60 * 60 * 1000;

/** 1 de enero 00:00 (México) del año siguiente al de `ms`. */
export function inicioAnioSiguienteMX(ms: number): number {
  const local = new Date(ms - OFFSET_MX_MS);
  return Date.UTC(local.getUTCFullYear() + 1, 0, 1) + OFFSET_MX_MS;
}

/** `ms` + la vigencia, contando meses y años en el calendario de México. */
export function sumarVigencia(ms: number, v: VigenciaCashback): number {
  const n = Math.max(0, Math.floor(Number(v.cantidad) || 0));
  if (v.unidad === "dias") return ms + n * 86_400_000;
  const local = new Date(ms - OFFSET_MX_MS);
  const dia = local.getUTCDate();
  const meses = v.unidad === "anios" ? n * 12 : n;
  local.setUTCDate(1);
  local.setUTCMonth(local.getUTCMonth() + meses);
  // 31-ene + 1 mes → 28/29-feb (último día del mes), no 3-mar.
  const ultimo = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 0)).getUTCDate();
  local.setUTCDate(Math.min(dia, ultimo));
  return local.getTime() + OFFSET_MX_MS;
}

/** Vence = mínimo(compra + vigencia, 1 de enero siguiente). */
export function calcularVence(compraMs: number, v: VigenciaCashback): number {
  return Math.min(sumarVigencia(compraMs, v), inicioAnioSiguienteMX(compraMs));
}

/** Saldo que se puede usar ahora: 0 si ya venció. */
export function saldoVigenteCentavos(
  c: Pick<CuentaCashbackMayoreo, "saldoCentavos" | "venceISO">,
  ahoraMs: number,
): number {
  if (c.venceISO && ahoraMs >= Date.parse(c.venceISO)) return 0;
  return Math.max(0, Math.floor(c.saldoCentavos || 0));
}

/** "10 días", "1 mes", "2 años". */
export function textoVigencia(v: VigenciaCashback): string {
  const n = Math.max(0, Math.floor(Number(v.cantidad) || 0));
  if (v.unidad === "dias") return `${n} ${n === 1 ? "día" : "días"}`;
  if (v.unidad === "meses") return `${n} ${n === 1 ? "mes" : "meses"}`;
  return `${n} ${n === 1 ? "año" : "años"}`;
}

/** Mensaje de error de la config, o null si es válida. */
export function validarConfigCashback(c: Pick<ConfigCashbackMayoreo, "pct" | "vigencia">): string | null {
  const pct = Number(c.pct);
  if (!Number.isFinite(pct) || pct <= 0 || pct > 50) {
    return "El porcentaje debe ser mayor que 0 y como máximo 50";
  }
  const n = Number(c.vigencia?.cantidad);
  if (!Number.isInteger(n) || n < 1) return "La vigencia debe ser un número entero de 1 o más";
  if (!["dias", "meses", "anios"].includes(c.vigencia?.unidad)) return "Elige días, meses o años";
  if (c.vigencia.unidad === "dias" && n > 3660) return "Máximo 3660 días";
  return null;
}

// ---------- PIN ----------

/** PIN fácil de adivinar: repetido (1111), en serie (1234, 9876), año
 *  típico (19xx/20xx) o los últimos 4 dígitos del teléfono. */
export function pinTrivial(pin: string, telefono?: string | null): boolean {
  if (!/^\d{4}$/.test(pin)) return true;
  const d = pin.split("").map(Number);
  if (d.every((x) => x === d[0])) return true;
  const sube = d.every((x, i) => i === 0 || x === d[i - 1] + 1);
  const baja = d.every((x, i) => i === 0 || x === d[i - 1] - 1);
  if (sube || baja) return true;
  if (/^(19|20)\d\d$/.test(pin)) return true;
  if (telefono && telefono.slice(-4) === pin) return true;
  return false;
}

// ---------- Textos (caja, ticket y página dicen lo mismo) ----------

/** Lo que el encargado le lee al cliente al abrir su cuenta. */
export function textoAperturaCuenta(c: Pick<ConfigCashbackMayoreo, "pct" | "vigencia">): string[] {
  return [
    `Con tu cuenta de cashback ganas el ${c.pct} % de lo que pagues con dinero en nuestras sucursales de mayoreo.`,
    "Para acumular o usar tu saldo muestra tu QR (en la página) o tu tarjeta al pagar. Puedes usar todo o una parte, si quieres.",
    `Tu saldo vence si pasan ${textoVigencia(c.vigencia)} sin que compres; cada compra renueva la fecha.`,
    "Además, cada 1 de enero el saldo de todas las cuentas vuelve a $0.",
    "Tu PIN de 4 dígitos viene en tu ticket: con tu teléfono y ese PIN entras a la página, ves tu saldo y puedes cambiar el PIN.",
    "Quien tenga tu QR o tu tarjeta puede usar tu saldo: cuídalos. El cashback es un beneficio opcional de la tienda; para cualquier problema acude a la tienda.",
  ];
}

/** Aviso de privacidad y condiciones (página, caja y ticket corto). */
export const AVISO_CASHBACK: string[] = [
  "El cashback es un beneficio opcional que la tienda ofrece por gusto. La tienda no está obligada a darlo y puede cambiar sus condiciones o terminarlo en cualquier momento.",
  "Para tu cuenta solo guardamos tu teléfono, tu nombre si nos lo das y tus movimientos de cashback. No los compartimos con nadie y solo los usamos para este beneficio.",
  "El cuidado de tu PIN, tu QR y tu tarjeta depende 100 % de ti. Quien los tenga puede usar tu saldo. La tienda no se hace responsable del uso que otras personas hagan de ellos ni de saldos perdidos, vencidos o usados.",
  "Tu saldo vence si no compras dentro del tiempo indicado, y cada 1 de enero vuelve a $0. El cashback no se cambia por dinero en efectivo.",
  "Si tienes cualquier problema o duda, acude en persona a la tienda.",
];

export const AVISO_CASHBACK_CORTO =
  "Beneficio opcional de la tienda. Cuida tu QR, tarjeta y PIN: la tienda no se hace responsable. Problemas: acude a la tienda.";
