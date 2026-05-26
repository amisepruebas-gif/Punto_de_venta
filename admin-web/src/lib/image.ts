/**
 * Comprime cualquier imagen (image/*) a WebP client-side garantizando que el
 * resultado pesa ≤ `maxBytes` (default 800 KB).
 *
 * Estrategia: empieza con la mejor resolución posible y baja iterativamente:
 *   1. Reduce `quality` en pasos de 0.05 desde 0.95 hasta 0.55.
 *   2. Si aún no entra, reduce `maxDimension` × 0.85 y reinicia quality a 0.85.
 *   3. Repite hasta que entre o llegue al piso (800 px × quality 0.55), en
 *      cuyo caso devuelve la mejor aproximación con un warning en consola.
 *
 * Lanza error si:
 *   - el archivo no es imagen (`type` no empieza con "image/").
 *   - el navegador no puede decodificar la imagen.
 *   - el navegador no soporta `canvas.toBlob("image/webp")`.
 */

const MAX_BYTES_DEFAULT = 800 * 1024; // 800 KB
const INITIAL_QUALITY = 0.95;
const MIN_QUALITY = 0.55;
const QUALITY_STEP = 0.05;
const INITIAL_MAX_DIMENSION = 2400;
const MIN_MAX_DIMENSION = 800;
const DIMENSION_STEP = 0.85;

export async function compressToWebP(
  file: File,
  opts: { maxBytes?: number } = {},
): Promise<Blob> {
  if (!file.type.startsWith("image/")) {
    throw new Error(
      `Archivo no es imagen (type=${file.type || "desconocido"}). Solo se aceptan tipos image/*.`,
    );
  }

  const maxBytes = opts.maxBytes ?? MAX_BYTES_DEFAULT;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) {
    throw new Error(
      "No se pudo decodificar la imagen. Probablemente esté corrupta o sea un formato no soportado por el navegador.",
    );
  }

  const origW = bitmap.width;
  const origH = bitmap.height;

  let quality = INITIAL_QUALITY;
  let maxDimension = Math.min(
    INITIAL_MAX_DIMENSION,
    Math.max(origW, origH), // no agrandar la imagen original
  );

  // Tracking del mejor candidato — si todo lo demás falla, devolvemos el
  // último blob aunque exceda el límite (aviso en consola).
  let mejor: Blob | null = null;

  for (let intento = 0; intento < 30; intento++) {
    const blob = await encodeWebP(bitmap, origW, origH, maxDimension, quality);
    if (!blob) {
      bitmap.close?.();
      throw new Error(
        "El navegador no soporta exportar a WebP. Usa una versión reciente de Chrome, Edge, Firefox o Safari.",
      );
    }

    mejor = blob;
    if (blob.size <= maxBytes) {
      bitmap.close?.();
      return blob;
    }

    // Bajar quality primero (más rápido y menos destructivo que escalar).
    if (quality - QUALITY_STEP >= MIN_QUALITY - 0.001) {
      quality = +(quality - QUALITY_STEP).toFixed(2);
      continue;
    }

    // Quality al mínimo — bajamos resolución y reseteamos quality a 0.85.
    if (maxDimension > MIN_MAX_DIMENSION) {
      maxDimension = Math.max(
        MIN_MAX_DIMENSION,
        Math.round(maxDimension * DIMENSION_STEP),
      );
      quality = 0.85;
      continue;
    }

    // Llegamos al piso — devolver lo mejor que pudimos.
    break;
  }

  bitmap.close?.();
  console.warn(
    `[compressToWebP] no se pudo bajar de ${maxBytes} bytes; devolviendo ${mejor!.size} bytes`,
  );
  return mejor!;
}

async function encodeWebP(
  bitmap: ImageBitmap,
  origW: number,
  origH: number,
  maxDimension: number,
  quality: number,
): Promise<Blob | null> {
  let w = origW;
  let h = origH;
  if (w > maxDimension || h > maxDimension) {
    const ratio = Math.min(maxDimension / w, maxDimension / h);
    w = Math.round(w * ratio);
    h = Math.round(h * ratio);
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, w, h);
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/webp", quality);
  });
}

/** Byte size humano. */
export function bytesHuman(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Dimensiones de una imagen sin decodificarla completa (para mostrar info). */
export async function imagenDimensiones(
  file: File,
): Promise<{ width: number; height: number } | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const out = { width: bitmap.width, height: bitmap.height };
    bitmap.close?.();
    return out;
  } catch {
    return null;
  }
}
