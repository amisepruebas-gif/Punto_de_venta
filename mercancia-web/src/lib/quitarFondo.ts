/**
 * Cliente del callable `quitarFondoImagen` (Cloud Function que delega a
 * Gemini 2.5 Flash Image / "Nano Banana"). El cliente NO tiene acceso a
 * la API key — vive en Secret Manager y solo el CF puede leerla.
 *
 * Uso:
 *   const fileNuevo = await quitarFondoFromFile(file);
 *   // fileNuevo es un File con el fondo reemplazado por blanco.
 *
 * O si solo tienes la URL remota:
 *   const fileNuevo = await quitarFondoFromUrl(url);
 */

import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";

type RequestData = { imageBase64: string; mimeType: string };
type ResponseData = { imageBase64: string; mimeType: string };

const callable = httpsCallable<RequestData, ResponseData>(
  functions,
  "quitarFondoImagen",
);

/**
 * Convierte un `Uint8Array` a base64 sin reventar el call stack para
 * imágenes grandes (`btoa(String.fromCharCode(...bytes))` falla con
 * "Maximum call stack exceeded" cuando bytes.length es alto).
 */
function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(s);
}

function base64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** Mime types que acepta Gemini Flash Image. */
const MIME_SOPORTADOS = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
];
/** Máximo en bytes raw (15 MB). El callable tope es ~32 MB y base64
 *  agrega ~33% overhead, así que dejamos margen. */
const MAX_BYTES = 15 * 1024 * 1024;

export async function quitarFondoFromFile(file: File): Promise<File> {
  if (!MIME_SOPORTADOS.includes(file.type)) {
    throw new Error(
      `Formato no soportado: ${file.type || "desconocido"}. ` +
        `Usa PNG, JPEG, WebP, HEIC o HEIF.`,
    );
  }
  if (file.size > MAX_BYTES) {
    throw new Error(
      `Imagen demasiado grande (${(file.size / 1024 / 1024).toFixed(1)} MB). ` +
        `Máximo ${MAX_BYTES / 1024 / 1024} MB. Reduce la imagen primero.`,
    );
  }
  const buf = new Uint8Array(await file.arrayBuffer());
  const b64 = bytesToBase64(buf);
  const result = await callable({ imageBase64: b64, mimeType: file.type });
  const bytes = base64ToBytes(result.data.imageBase64);
  // Wrap en Uint8Array para que TS no se queje del tipo ArrayBufferLike.
  const blob = new Blob([new Uint8Array(bytes)], {
    type: result.data.mimeType,
  });
  const name = file.name.replace(/(\.[^.]+)$/, "_nofondo$1") || "nofondo.png";
  return new File([blob], name, { type: result.data.mimeType });
}

export async function quitarFondoFromUrl(url: string): Promise<File> {
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`No se pudo descargar la imagen (HTTP ${resp.status})`);
  }
  const blob = await resp.blob();
  const file = new File([blob], "imagen", {
    type: blob.type || "image/webp",
  });
  return quitarFondoFromFile(file);
}
