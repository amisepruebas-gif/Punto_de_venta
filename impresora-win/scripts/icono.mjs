// Genera los iconos del programa (sin dependencias): una etiqueta blanca con
// código de barras sobre un cuadro morado.
//   recursos/icono.png    256 × 256 (instalador y ventana)
//   recursos/bandeja.png   32 × 32  (junto al reloj)
// Uso: node scripts/icono.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TABLA = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = TABLA[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function trozo(tipo, datos) {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, "ascii"), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([largo, cuerpo, crc]);
}
function png(lado, pixel) {
  const crudo = Buffer.alloc((lado * 4 + 1) * lado);
  for (let y = 0; y < lado; y++) {
    const fila = y * (lado * 4 + 1);
    crudo[fila] = 0;
    for (let x = 0; x < lado; x++) {
      const [r, g, b, a] = pixel((x + 0.5) / lado, (y + 0.5) / lado);
      crudo.set([r, g, b, a], fila + 1 + x * 4);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(lado, 0);
  ihdr.writeUInt32BE(lado, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo("IHDR", ihdr),
    trozo("IDAT", deflateSync(crudo)),
    trozo("IEND", Buffer.alloc(0)),
  ]);
}

function dentroRedondeado(u, v, x0, y0, x1, y1, r) {
  if (u < x0 || u > x1 || v < y0 || v > y1) return false;
  const cx = Math.min(Math.max(u, x0 + r), x1 - r);
  const cy = Math.min(Math.max(v, y0 + r), y1 - r);
  return (u - cx) ** 2 + (v - cy) ** 2 <= r * r;
}
// Barras del código (ancho relativo de cada barra y espacio).
const PATRON = [2, 1, 1, 2, 3, 1, 1, 1, 2, 2, 1, 3, 1, 1, 2, 1, 1, 2, 3, 1, 2];
const TOTAL = PATRON.reduce((a, b) => a + b, 0);
function esBarra(u) {
  const x0 = 0.25, x1 = 0.75;
  if (u < x0 || u > x1) return false;
  let pos = ((u - x0) / (x1 - x0)) * TOTAL;
  for (let i = 0; i < PATRON.length; i++) {
    if (pos < PATRON[i]) return i % 2 === 0;
    pos -= PATRON[i];
  }
  return false;
}
const MORADO = [109, 40, 217, 255];
const BLANCO = [255, 255, 255, 255];
const NEGRO = [24, 24, 27, 255];
const NADA = [0, 0, 0, 0];
function pixel(u, v) {
  if (!dentroRedondeado(u, v, 0.02, 0.02, 0.98, 0.98, 0.2)) return NADA;
  if (!dentroRedondeado(u, v, 0.14, 0.27, 0.86, 0.73, 0.06)) return MORADO;
  if (v >= 0.35 && v <= 0.56 && esBarra(u)) return NEGRO;
  if (v >= 0.61 && v <= 0.65 && u >= 0.3 && u <= 0.7) return NEGRO;
  return BLANCO;
}

const dir = path.join(raiz, "recursos");
mkdirSync(dir, { recursive: true });
writeFileSync(path.join(dir, "icono.png"), png(256, pixel));
writeFileSync(path.join(dir, "bandeja.png"), png(32, pixel));
console.log("iconos en recursos/");
