/**
 * Helpers para extraer información canónica de URLs públicas de Firebase
 * Storage. Usado por el cache nativo (ImageCache.java replica esta lógica) y
 * por el GC reconciliador en `useArticulos`.
 *
 * Formato de URL pública de Firebase Storage:
 *
 *   https://firebasestorage.googleapis.com/v0/b/<BUCKET>/o/<ENCODED_PATH>?alt=media&token=<UUID>
 *
 * - `<BUCKET>` es el nombre del bucket (ej. `amise-nodo.appspot.com`).
 * - `<ENCODED_PATH>` es el path dentro del bucket con `/` codificado como
 *   `%2F` (lo hace `getDownloadURL`).
 * - `<UUID>` se rota cada vez que `uploadBytes` sobrescribe el archivo, lo
 *   que rompería un cache indexado por URL completa.
 *
 * El **path canónico** que producimos aquí es estable a través de uploads
 * y por eso sirve como key de cache:
 *
 *   <BUCKET>/o/<ENCODED_PATH>
 */

/** Resultado de parsear una URL de Storage. `null` si la URL no es del
 *  formato esperado. */
export type StorageUrlParts = {
  /** Path canónico estable: `<bucket>/o/<encodedPath>`. */
  canonicalPath: string;
  /** Token actual (`?token=…`). Cambia cada vez que se sube el archivo
   *  al mismo path. `null` si la URL no incluye token. */
  token: string | null;
};

const STORAGE_HOST = "firebasestorage.googleapis.com";

/**
 * Parsea una URL pública de Firebase Storage. Devuelve `null` si la URL
 * no es de Storage o no tiene el formato esperado.
 *
 * Diseñado para ser idempotente y barato: no normaliza casing, no decodea
 * el path (mantenemos `%2F`), no valida que el bucket exista.
 */
export function parseStorageUrl(url: string): StorageUrlParts | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.host !== STORAGE_HOST) return null;
  // Path esperado: `/v0/b/<BUCKET>/o/<ENCODED_PATH>`
  const m = u.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
  if (!m) return null;
  const bucket = m[1];
  const encodedPath = m[2];
  return {
    canonicalPath: `${bucket}/o/${encodedPath}`,
    token: u.searchParams.get("token"),
  };
}

/**
 * Atajo: solo el path canónico (lo que importa para el cache key). Devuelve
 * `null` si la URL no es de Storage.
 */
export function canonicalStoragePath(url: string): string | null {
  return parseStorageUrl(url)?.canonicalPath ?? null;
}
