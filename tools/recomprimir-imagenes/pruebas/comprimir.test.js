'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const { comprimirAWebP, codificar, MAX_BYTES, CALIDAD_MIN, LADO_MIN } = require('../comprimir');
const { pngSintetico } = require('./ayudas');

test('si la calidad 95 ya entra, la usa y no prueba más', async () => {
  const entrada = await pngSintetico(800, 600, 0);
  const r = await comprimirAWebP(entrada);
  assert.equal(r.calidad, 95);
  assert.equal(r.intentos, 1);
  assert.equal(r.reducida, false);
  assert.deepEqual([r.ancho, r.alto], [800, 600]);
  assert.ok(r.buffer.length <= MAX_BYTES);
  assert.equal((await sharp(r.buffer).metadata()).format, 'webp');
});

test('busca la MAYOR calidad que deja el archivo <= 500 KB', async () => {
  // A calidad 95 pesa ~900 KB; a 55, ~100 KB: la respuesta está entre medio.
  const entrada = await pngSintetico(2400, 1800, 10);
  const r = await comprimirAWebP(entrada);

  assert.ok(r.calidad > CALIDAD_MIN && r.calidad < 95, `calidad ${r.calidad}`);
  assert.ok(r.buffer.length <= MAX_BYTES, `pesa ${r.buffer.length}`);
  assert.equal(r.reducida, false);
  assert.deepEqual([r.ancho, r.alto], [2400, 1800], 'no debe reducir resolución');

  // Una calidad más ya no entra (si no, no sería la mayor).
  const mas = await codificar(entrada, null, r.calidad + 1);
  assert.ok(mas.buffer.length > MAX_BYTES, `q${r.calidad + 1} pesa ${mas.buffer.length}`);
  // Menos de 8 intentos: búsqueda binaria, no barrido.
  assert.ok(r.intentos <= 8, `intentos ${r.intentos}`);
});

test('si ni con calidad 55 entra, reduce el lado mayor conservando la proporción', async () => {
  // A calidad 55 y tamaño completo pesa ~800 KB.
  const entrada = await pngSintetico(2400, 1800, 60);
  const completa = await codificar(entrada, null, CALIDAD_MIN);
  assert.ok(completa.buffer.length > MAX_BYTES, 'precondición de la prueba');

  const r = await comprimirAWebP(entrada);
  assert.ok(r.buffer.length <= MAX_BYTES, `pesa ${r.buffer.length}`);
  assert.equal(r.reducida, true);
  assert.ok(r.ancho < 2400 && r.ancho >= LADO_MIN, `ancho ${r.ancho}`);
  assert.ok(Math.abs(r.ancho / r.alto - 4 / 3) < 0.01, `proporción ${r.ancho}x${r.alto}`);
  assert.ok(r.calidad >= CALIDAD_MIN && r.calidad <= 95);
});

test('devuelve null si ni a calidad 55 y 800 px entra', async () => {
  const entrada = await pngSintetico(1600, 1200, 60);
  const r = await comprimirAWebP(entrada, { maxBytes: 5 * 1024 });
  assert.equal(r, null);
});

test('no agranda ni reduce una imagen chica que ya entra', async () => {
  const entrada = await pngSintetico(300, 200, 5);
  const r = await comprimirAWebP(entrada);
  assert.deepEqual([r.ancho, r.alto], [300, 200]);
});

test('conserva la transparencia', async () => {
  const ancho = 400;
  const alto = 400;
  const rgba = Buffer.alloc(ancho * alto * 4);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const i = (y * ancho + x) * 4;
      rgba[i] = x % 256;
      rgba[i + 1] = y % 256;
      rgba[i + 2] = 128;
      rgba[i + 3] = x < ancho / 2 ? 0 : 255; // mitad transparente
    }
  }
  const entrada = await sharp(rgba, { raw: { width: ancho, height: alto, channels: 4 } })
    .png()
    .toBuffer();
  const r = await comprimirAWebP(entrada);
  const meta = await sharp(r.buffer).metadata();
  assert.equal(meta.format, 'webp');
  assert.equal(meta.hasAlpha, true);
  const { data } = await sharp(r.buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(data[3], 0, 'el lado izquierdo sigue transparente');
  assert.equal(data[(ancho - 1) * 4 + 3], 255, 'el lado derecho sigue opaco');
});

test('aplica la orientación EXIF (la salida no lleva el tag)', async () => {
  const jpeg = await sharp({
    create: { width: 1200, height: 800, channels: 3, background: '#336699' },
  })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();
  const r = await comprimirAWebP(jpeg);
  assert.deepEqual([r.ancho, r.alto], [800, 1200]);
  const meta = await sharp(r.buffer).metadata();
  assert.deepEqual([meta.width, meta.height], [800, 1200]);
});

test('rechaza lo que no es una imagen', async () => {
  await assert.rejects(() => comprimirAWebP(Buffer.from('esto no es una imagen')));
});

test('rechaza imágenes animadas (no se aplanan a un solo cuadro)', async () => {
  const cuadro = (color) =>
    sharp({ create: { width: 64, height: 64, channels: 3, background: color } })
      .png()
      .toBuffer();
  const animada = await sharp([await cuadro('#ff0000'), await cuadro('#0000ff')], {
    join: { animated: true },
  })
    .webp({ loop: 0, delay: [100, 100] })
    .toBuffer();
  await assert.rejects(() => comprimirAWebP(animada), /animada/);
});
