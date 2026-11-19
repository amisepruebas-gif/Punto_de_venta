// ============================================================
// Enlaces de lote (acceso por URL para un teléfono) — helpers puros
// ============================================================
//
// Un enlace es una llave al portador: quien tenga la URL entra. Por eso
//   - el secreto son 256 bits y viaja en el fragmento (`#...`), que no llega
//     a ningún servidor ni queda en bitácoras;
//   - de él solo se guarda su sha256 (`EnlaceLote.secretoHash`);
//   - se canjea por una sesión en la function `canjearEnlaceLote`, que
//     cuenta las entradas y pone el vencimiento con la hora del servidor.
//
// Las constantes de aquí tienen su espejo en `functions/lib/enlaceLote.js`
// (functions es CommonJS y no importa `shared`).

import type { EnlaceLoteTipo } from "./schema";

/** Cuántos teléfonos pueden entrar con un mismo enlace. */
export const ENLACE_MAX_CANJES: Record<EnlaceLoteTipo, number> = {
  armar: 1,
  recibir: 3,
  imprimir: 1,
  precio: 1,
};
/** Un enlace de fotos se debe canjear en este tiempo desde que se creó. */
export const ENLACE_RECIBIR_VENTANA_MS = 5 * 60_000;
/** Lo que dura la sesión de fotos desde que el teléfono entra. */
export const ENLACE_RECIBIR_DURACION_MS = 30 * 60_000;
/** Fotos por teléfono y por enlace (lo hace cumplir el nombre del archivo). */
export const ENLACE_FOTOS_MAX = 30;

/** Origen de mercancia-web, donde viven las pantallas del teléfono (`/enlace`).
 *  Cada app lo puede cambiar con `VITE_URL_MERCANCIA` (pruebas locales). */
export const URL_MERCANCIA_PRODUCCION = "https://amise-mercancia.web.app";

const RE_SECRETO = /^[A-Za-z0-9_-]{43}$/;

function base64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Secreto nuevo: 32 bytes aleatorios en base64url (43 caracteres). */
export function generarSecretoEnlace(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

export function esSecretoEnlace(secreto: unknown): secreto is string {
  return typeof secreto === "string" && RE_SECRETO.test(secreto);
}

/** sha256 en hex del secreto: lo único que se guarda (igual que
 *  `hashSecreto` de `functions/lib/accesoCaja.js`). */
export async function hashSecretoEnlace(secreto: string): Promise<string> {
  const datos = new TextEncoder().encode(secreto);
  const digest = await crypto.subtle.digest("SHA-256", datos);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** URL que se manda al teléfono. `base` es el origen de mercancia-web. */
export function urlEnlaceLote(
  base: string,
  negocioId: string,
  enlaceId: string,
  secreto: string,
): string {
  return `${base.replace(/\/+$/, "")}/enlace/${encodeURIComponent(negocioId)}/${encodeURIComponent(enlaceId)}#${secreto}`;
}

/** URL de la página aparte de etiquetas de precio (acceso `precio`): misma
 *  forma que la del teléfono pero en `/precio`, para que la pantalla de
 *  entrada diga de qué es antes de canjear el enlace. */
export function urlEnlacePrecio(
  base: string,
  negocioId: string,
  enlaceId: string,
  secreto: string,
): string {
  return `${base.replace(/\/+$/, "")}/precio/${encodeURIComponent(negocioId)}/${encodeURIComponent(enlaceId)}#${secreto}`;
}

/** El secreto que viene en `location.hash`, o `null` si no lo es. */
export function secretoDeFragmento(hash: string): string | null {
  const s = hash.startsWith("#") ? hash.slice(1) : hash;
  return esSecretoEnlace(s) ? s : null;
}

// ---------- Código de vinculación de una impresora (acceso `imprimir`) ----------

const PREFIJO_VINCULACION = "AMISE1";
const RE_ID_ENLACE = /^[A-Za-z0-9_-]{1,64}$/;
const RE_VINCULACION = /^AMISE1\.([A-Za-z0-9_-]{1,64})\.([A-Za-z0-9_-]{1,64})\.([A-Za-z0-9_-]{43})$/;

/**
 * Lo que admin le da a la PC para vincularla: se pega en el programa "AMISE
 * Impresora". NO es una URL a propósito: abierto en un teléfono no haría
 * nada (un acceso `imprimir` sirve para un solo equipo).
 */
export function codigoVinculacionImpresora(
  negocioId: string,
  enlaceId: string,
  secreto: string,
): string {
  if (!RE_ID_ENLACE.test(negocioId) || !RE_ID_ENLACE.test(enlaceId) || !esSecretoEnlace(secreto)) {
    throw new Error("Datos inválidos para el código de vinculación");
  }
  return `${PREFIJO_VINCULACION}.${negocioId}.${enlaceId}.${secreto}`;
}

/** Lee un código de vinculación pegado (con o sin espacios ni saltos). */
export function leerCodigoVinculacion(
  texto: string,
): { negocioId: string; enlaceId: string; secreto: string } | null {
  const m = RE_VINCULACION.exec(texto.replace(/\s+/g, ""));
  return m ? { negocioId: m[1]!, enlaceId: m[2]!, secreto: m[3]! } : null;
}

/** Id de la foto número `n` (0…29) de una sesión: `{uid}_{nn}`. Es también
 *  el nombre de su archivo; así las reglas limitan cuántas sube cada quien. */
export function idFotoLote(uid: string, n: number): string {
  if (!Number.isInteger(n) || n < 0 || n >= ENLACE_FOTOS_MAX) {
    throw new Error(`Máximo ${ENLACE_FOTOS_MAX} fotos por teléfono`);
  }
  return `${uid}_${String(n).padStart(2, "0")}`;
}
