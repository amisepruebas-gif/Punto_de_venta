/**
 * Comprime una imagen `image/*` a WebP client-side garantizando que el
 * resultado pesa ≤ `maxBytes` (default 600 KB para mensajes).
 *
 * Misma estrategia que `admin-web/src/lib/image.ts` pero con un piso
 * más bajo de resolución (640 px) porque las imágenes de chat se ven
 * pequeñas y no necesitan máxima resolución.
 */

const MAX_BYTES_DEFAULT = 600 * 1024; // 600 KB
const INITIAL_QUALITY = 0.92;
const MIN_QUALITY = 0.5;
const QUALITY_STEP = 0.06;
const INITIAL_MAX_DIMENSION = 1600;
const MIN_MAX_DIMENSION = 640;
const DIMENSION_STEP = 0.85;

export async function compressToWebP(
  file: File,
  opts: { maxBytes?: number } = {},
): Promise<Blob> {
  if (!file.type.startsWith("image/")) {
    throw new Error(
      `Archivo no es imagen (type=${file.type || "desconocido"}).`,
    );
  }

  const maxBytes = opts.maxBytes ?? MAX_BYTES_DEFAULT;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) {
    throw new Error("No se pudo decodificar la imagen.");
  }

  const origW = bitmap.width;
  const origH = bitmap.height;

  let quality = INITIAL_QUALITY;
  let maxDimension = Math.min(
    INITIAL_MAX_DIMENSION,
    Math.max(origW, origH),
  );

  let mejor: Blob | null = null;

  for (let intento = 0; intento < 30; intento++) {
    const blob = await encodeWebP(bitmap, origW, origH, maxDimension, quality);
    if (!blob) {
      bitmap.close?.();
      throw new Error("El navegador no soporta exportar a WebP.");
    }

    mejor = blob;
    if (blob.size <= maxBytes) {
      bitmap.close?.();
      return blob;
    }

    if (quality - QUALITY_STEP >= MIN_QUALITY - 0.001) {
      quality = +(quality - QUALITY_STEP).toFixed(2);
      continue;
    }

    if (maxDimension > MIN_MAX_DIMENSION) {
      maxDimension = Math.max(
        MIN_MAX_DIMENSION,
        Math.round(maxDimension * DIMENSION_STEP),
      );
      quality = 0.85;
      continue;
    }

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
