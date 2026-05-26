import type { ArticuloSubvariacion } from "./schema";

// ============================================================
// Generadores de IDs
// ============================================================

/**
 * Genera una huella tipo timestamp — equivalente a Android `generarID()`.
 * Formato: "YYYYMMDDHHmmssSSS" (milisegundos) + 3 chars random para colisiones.
 */
export function generarID(): string {
  const d = new Date();
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  const base =
    String(d.getFullYear()) +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds()) +
    pad(d.getMilliseconds(), 3);
  const rand = Math.random().toString(36).slice(2, 5);
  return base + rand;
}

/**
 * Genera un ID corto para nodos — 12 chars base36. No alphanumeric puro para
 * evitar confusión con artículos (que son numéricos base 10 desde 12300001).
 */
export function genNodoId(): string {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 8);
  return (t + r).padEnd(12, "0").slice(0, 12);
}

/** Genera ID secuencial de artículo. Base inicial: "12300001" */
export const ARTICULO_ID_INICIAL = "12300001";

export function siguienteArticuloId(ultimoId: string | null | undefined): string {
  const base = ultimoId && /^\d+$/.test(ultimoId)
    ? parseInt(ultimoId, 10) + 1
    : parseInt(ARTICULO_ID_INICIAL, 10);
  return String(base);
}

/** Genera apartadoId. Timestamp-based, como huella pero prefijado. */
export function genApartadoId(): string {
  return "ap_" + generarID();
}

/** Genera corteId. Timestamp-based, prefijado. */
export function genCorteId(): string {
  return "c_" + generarID();
}

/** Genera ID para sucursal. Timestamp-based, prefijado. */
export function genSucursalId(): string {
  return "suc_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);
}

// ============================================================
// Subvariaciones de artículo — códigos `v-NN-XXX`
// ============================================================
// Forma: `v-{núcleo}-{rand3}`
//   - núcleo = id del padre sin el prefijo "123" y sin ceros a la izquierda.
//     `12300011` → `00011` → `11`
//     `12300100` → `00100` → `100`
//   - rand3  = 3 caracteres alfanuméricos random `[A-Za-z0-9]`.
//
// Reconstrucción inversa: `idDesdeNucleo("11") = "12300011"` (left-pad 5).
// El random sólo necesita ser único dentro de las variaciones de un mismo
// padre — colisión cross-padre es irrelevante porque cada uno se resuelve
// por su propio núcleo.
// ============================================================

const NUCLEO_PADDING = 5;
const ID_PREFIJO = "123";
const RAND_LEN = 3;
const RAND_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/**
 * Extrae el núcleo del id de un artículo. `12300011` → `"11"`.
 * Devuelve `null` si el id no respeta el formato esperado.
 */
export function nucleoDesdeId(id: string): string | null {
  if (!/^\d{8}$/.test(id)) return null;
  if (!id.startsWith(ID_PREFIJO)) return null;
  const tras123 = id.slice(ID_PREFIJO.length); // "00011"
  const sinCeros = tras123.replace(/^0+/, ""); // "11"
  return sinCeros === "" ? "0" : sinCeros;
}

/**
 * Reconstruye el id de 8 dígitos del padre a partir del núcleo.
 * `"11"` → `"12300011"`.
 * Devuelve `null` si el núcleo no es numérico o desborda el padding.
 */
export function idDesdeNucleo(nucleo: string): string | null {
  if (!/^\d+$/.test(nucleo)) return null;
  if (nucleo.length > NUCLEO_PADDING) return null;
  return ID_PREFIJO + nucleo.padStart(NUCLEO_PADDING, "0");
}

export type VariacionCodigoParts = {
  /** Código completo recibido. */
  codigo: string;
  /** Id del padre reconstruido (8 dig). */
  idPadre: string;
  /** Núcleo (sin padding). */
  nucleo: string;
  /** Sufijo aleatorio de 3 chars. */
  rand: string;
};

/**
 * Parsea un código de subvariación `v-NN-XXX`. Devuelve `null` si el código
 * no coincide con la forma esperada (incluyendo si el núcleo no es numérico,
 * el rand no tiene 3 chars, o el id padre reconstruido excede 8 dígitos).
 */
export function parseVariacionCodigo(
  codigo: string,
): VariacionCodigoParts | null {
  if (!codigo.startsWith("v-")) return null;
  const partes = codigo.split("-");
  if (partes.length !== 3) return null;
  const [, nucleo, rand] = partes;
  if (!nucleo || !rand) return null;
  if (rand.length !== RAND_LEN) return null;
  if (!/^[A-Za-z0-9]+$/.test(rand)) return null;
  const idPadre = idDesdeNucleo(nucleo);
  if (!idPadre) return null;
  return { codigo, idPadre, nucleo, rand };
}

/**
 * Genera un código `v-NN-XXX` único dentro del array de subvariaciones de
 * un mismo padre. Reintenta hasta 50 veces ante colisión local antes de
 * rendirse (eventualidad astronómica con espacio 62³ = 238 328).
 */
export function generarVariacionCodigo(
  idPadre: string,
  existentes: ArticuloSubvariacion[],
): string {
  const nucleo = nucleoDesdeId(idPadre);
  if (!nucleo) {
    throw new Error(
      `idDesdeNucleo: id padre inválido "${idPadre}" (se espera 8 dígitos empezando en 123)`,
    );
  }
  const ocupados = new Set(
    existentes
      .map((sv) => sv.codigo)
      .filter((c): c is string => typeof c === "string"),
  );
  for (let i = 0; i < 50; i++) {
    const rand = randAlphanumeric(RAND_LEN);
    const codigo = `v-${nucleo}-${rand}`;
    if (!ocupados.has(codigo)) return codigo;
  }
  throw new Error(
    `generarVariacionCodigo: 50 colisiones consecutivas para padre ${idPadre}. Algo está muy mal.`,
  );
}

function randAlphanumeric(len: number): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += RAND_ALPHABET[Math.floor(Math.random() * RAND_ALPHABET.length)];
  }
  return out;
}

// ============================================================
// Slug de categoría / subcategoría
// ============================================================

/**
 * Normaliza el nombre de una categoría/subcategoría a un slug determinístico.
 * Lowercase, sin diacríticos, espacios y signos no alfanuméricos a `-`,
 * colapsa múltiples `-` y trimea los de los extremos.
 *
 * Ejemplos:
 *   "Camisas" → "camisas"
 *   "Pantalones de mezclilla" → "pantalones-de-mezclilla"
 *   "  Niños / Bebés  " → "ninos-bebes"
 */
export function slugCategoria(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
