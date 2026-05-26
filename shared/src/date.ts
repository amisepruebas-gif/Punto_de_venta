// ============================================================
// Formato de fechas — compatible con esquemas legacy (Android usa MX)
// ============================================================

const TZ = "America/Mexico_City";

/** Date actual en zona horaria MX. */
export function nowMX(): Date {
  const now = new Date();
  // Para ops internas, un Date normal es suficiente — la zona horaria se
  // aplica al formatear, no al objeto Date.
  return now;
}

type YMD = { y: string; m: string; d: string };

/** Devuelve año/mes/día en formato string SIN padding ("2026", "3", "15") — compat legacy. */
export function ymdMX(date: Date = new Date()): YMD {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
  const parts = fmt.formatToParts(date);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = String(parseInt(parts.find((p) => p.type === "month")!.value, 10));
  const d = String(parseInt(parts.find((p) => p.type === "day")!.value, 10));
  return { y, m, d };
}

/** "YYYY-MM-DD" con padding — usado en contadorDia. */
export function ymdPaddedMX(date: Date = new Date()): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(date); // "YYYY-MM-DD"
}

/** "YYYY-MM-DD HH:mm:ss" MX — usado en field `fecha` del artículo y venta. */
export function fechaISO_MX(date: Date = new Date()): string {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

/** "4:20:45 p. m." — localizado MX, usado en field `hora` del mensaje. */
export function horaMX(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);
}

/** ISO 8601 estricto con Z — para field `fechaISO` de queries admin. */
export function fechaISOStrict(date: Date = new Date()): string {
  return date.toISOString();
}

/** "15 mar. 2026 4:20:45 p. m." — formato legacy Android field `fecha` de venta. */
export function fechaLegacyMX(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);
}

/** Parse relajado de "YYYY-MM-DD HH:mm:ss" o ISO. Retorna Date o null. */
export function parseFechaFlexible(s: string | undefined | null): Date | null {
  if (!s) return null;
  const d = new Date(s.replace(" ", "T"));
  return isNaN(d.getTime()) ? null : d;
}
