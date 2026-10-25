'use strict';

/**
 * Re-codifica una imagen a WebP con la MAYOR calidad que deje el archivo en
 * `maxBytes` o menos.
 *
 * Misma estrategia que `compressToWebP` (admin-web / mercancia-web):
 *   1. Calidad de 95 hacia abajo hasta 55. Aquí es una búsqueda binaria sobre
 *      calidades enteras (el navegador baja en pasos de 0.05).
 *   2. Si ni con calidad 55 entra, reduce el lado mayor × 0.85 y repite la
 *      búsqueda, hasta el piso de 800 px.
 *
 * Cada intento se codifica desde la imagen ORIGINAL, nunca desde un intento
 * previo: la recompresión es de una sola generación.
 */

const sharp = require('sharp');

const MAX_BYTES = 500 * 1024;
const CALIDAD_MAX = 95;
const CALIDAD_MIN = 55;
const FACTOR_LADO = 0.85;
const LADO_MIN = 800;
// effort 5: casi tan rápido como el 4 por defecto y bastante más chico; el 6
// no mejoró en las pruebas y tarda 2-3 veces más.
const ESFUERZO_WEBP = 5;

async function codificar(entrada, lado, calidad) {
  let imagen = sharp(entrada).autoOrient();
  if (lado) {
    imagen = imagen.resize({
      width: lado,
      height: lado,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }
  const { data, info } = await imagen
    .webp({ quality: calidad, effort: ESFUERZO_WEBP })
    .toBuffer({ resolveWithObject: true });
  return { buffer: data, calidad, ancho: info.width, alto: info.height };
}

/**
 * @param {Buffer} entrada Imagen en cualquier formato que sharp decodifique.
 * @param {{ maxBytes?: number }} [opciones]
 * @returns {Promise<null | {
 *   buffer: Buffer, calidad: number, ancho: number, alto: number,
 *   reducida: boolean, intentos: number }>}
 *   `null` si ni con calidad 55 a 800 px entra en `maxBytes`.
 * @throws Si la entrada no es una imagen válida o es animada.
 */
async function comprimirAWebP(entrada, { maxBytes = MAX_BYTES } = {}) {
  let meta;
  try {
    meta = await sharp(entrada).metadata();
  } catch (e) {
    throw new Error(`no se pudo leer como imagen (${e.message})`);
  }
  if ((meta.pages || 1) > 1) {
    throw new Error(`imagen animada (${meta.pages} fotogramas): no se recomprime`);
  }
  const ladoOriginal = Math.max(meta.width, meta.height);
  if (!(ladoOriginal > 0)) throw new Error('no se pudieron leer las dimensiones de la imagen');

  let intentos = 0;
  const probar = async (lado, calidad) => {
    intentos++;
    return codificar(entrada, lado, calidad);
  };
  const resultado = (intento, reducida) => ({
    buffer: intento.buffer,
    calidad: intento.calidad,
    ancho: intento.ancho,
    alto: intento.alto,
    reducida,
    intentos,
  });

  // `lado` null = tamaño original (sin resize).
  let lado = null;
  let ladoActual = ladoOriginal;
  for (;;) {
    // Mejor caso: la calidad máxima ya entra.
    const alta = await probar(lado, CALIDAD_MAX);
    if (alta.buffer.length <= maxBytes) return resultado(alta, lado !== null);

    // Búsqueda binaria: `lo` entra (54 = centinela "ninguna"), `hi` no entra.
    let mejor = null;
    let lo = CALIDAD_MIN - 1;
    let hi = CALIDAD_MAX;
    while (hi - lo > 1) {
      const medio = (lo + hi) >> 1;
      const intento = await probar(lado, medio);
      if (intento.buffer.length <= maxBytes) {
        mejor = intento;
        lo = medio;
      } else {
        hi = medio;
      }
    }
    if (mejor) return resultado(mejor, lado !== null);

    // Ni con calidad mínima entra: reducir el lado mayor.
    if (ladoActual <= LADO_MIN) return null;
    ladoActual = Math.max(LADO_MIN, Math.round(ladoActual * FACTOR_LADO));
    lado = ladoActual;
  }
}

module.exports = {
  comprimirAWebP,
  codificar, // expuesto para las pruebas
  MAX_BYTES,
  CALIDAD_MAX,
  CALIDAD_MIN,
  LADO_MIN,
};
