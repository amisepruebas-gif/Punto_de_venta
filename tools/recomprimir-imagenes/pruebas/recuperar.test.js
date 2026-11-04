'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sharp = require('sharp');
const {
  ErrorUso,
  parsearArgumentos,
  parsearUrlStorage,
  recolectarImagenes,
  planear,
  prepararImagen,
  recuperar,
  PREFIJO,
  POR_DEFECTO,
} = require('../recuperar-de-tienda');
const { webpSintetico, pngSintetico, BucketFalso } = require('./ayudas');

const CAJA = 'caja.appspot.com';
const TIENDA = 'tienda.firebasestorage.app';
const MAX = 60 * 1024;
const silencio = () => {};

function urlFirebase(bucket, p, token) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(p)}?alt=media${token ? `&token=${token}` : ''}`;
}

// ------------------------------------------------------------ argumentos y URLs

test('argumentos: simulacro por defecto y proyectos de producción', () => {
  const o = parsearArgumentos([]);
  assert.equal(o.ejecutar, false);
  assert.equal(o.limit, null);
  assert.equal(o.cajaBucket, POR_DEFECTO.cajaBucket);
  assert.equal(o.tiendaBucket, POR_DEFECTO.tiendaBucket);
  assert.equal(o.negocio, 'amise');
});

test('argumentos: --ejecutar, --limit, buckets con gs://', () => {
  const o = parsearArgumentos(['--ejecutar', '--limit', '3', '--caja-bucket', 'gs://x.appspot.com/']);
  assert.equal(o.ejecutar, true);
  assert.equal(o.limit, 3);
  assert.equal(o.cajaBucket, 'x.appspot.com');
});

test('argumentos: inválidos', () => {
  assert.throws(() => parsearArgumentos(['--limit', '0']), ErrorUso);
  assert.throws(() => parsearArgumentos(['--limit', 'dos']), ErrorUso);
  assert.throws(() => parsearArgumentos(['--otra']), ErrorUso);
  assert.deepEqual(parsearArgumentos(['-h']), { ayuda: true });
});

test('parsearUrlStorage: URL de descarga, gs:// y basura', () => {
  assert.deepEqual(
    parsearUrlStorage(urlFirebase(CAJA, `${PREFIJO}123_v-1-AbC.webp`, 'tok-1')),
    { bucket: CAJA, path: `${PREFIJO}123_v-1-AbC.webp`, token: 'tok-1' },
  );
  assert.deepEqual(parsearUrlStorage(`gs://${TIENDA}/uploads/a.webp`), {
    bucket: TIENDA,
    path: 'uploads/a.webp',
    token: null,
  });
  assert.equal(parsearUrlStorage('https://ejemplo.com/a.webp'), null);
  assert.equal(parsearUrlStorage('gs://solo-bucket'), null);
  assert.equal(parsearUrlStorage(''), null);
  assert.equal(parsearUrlStorage(undefined), null);
  assert.equal(parsearUrlStorage('no es url'), null);
});

test('recolectarImagenes: principal y variaciones de la caja, sin repetir', () => {
  const articulos = [
    {
      id: '123',
      nombre: 'Peluche',
      imagenUrl: urlFirebase(CAJA, `${PREFIJO}123.webp`, 't0'),
      subvariaciones: [
        { codigo: 'v-1-AAA', nombre: 'Rojo', imagenUrl: urlFirebase(CAJA, `${PREFIJO}123_v-1-AAA.webp`, 't1') },
        { codigo: 'v-1-BBB', nombre: 'Sin foto' },
        { codigo: 'v-1-CCC', nombre: 'Otro bucket', imagenUrl: urlFirebase(TIENDA, 'uploads/x.webp', 't2') },
        { codigo: 'v-1-DDD', nombre: 'Repetida', imagenUrl: urlFirebase(CAJA, `${PREFIJO}123_v-1-AAA.webp`, 't1') },
      ],
    },
    { id: '124', nombre: 'Fuera del prefijo', imagenUrl: urlFirebase(CAJA, 'chat/x.webp', 't') },
  ];
  const imgs = recolectarImagenes(articulos, CAJA);
  assert.deepEqual(
    imgs.map((i) => [i.articuloId, i.cual, i.codigo, i.path, i.token]),
    [
      ['123', 'principal', undefined, `${PREFIJO}123.webp`, 't0'],
      ['123', 'variacion', 'v-1-AAA', `${PREFIJO}123_v-1-AAA.webp`, 't1'],
    ],
  );
});

// ------------------------------------------------------------------- plan

function escenario() {
  const art = (id, imagenes, subs = []) => ({
    id,
    nombre: `Art ${id}`,
    ...(imagenes ? { imagenUrl: urlFirebase(CAJA, `${PREFIJO}${id}.webp`, `tok-${id}`) } : {}),
    subvariaciones: subs.map((c) => ({
      codigo: c,
      nombre: `Var ${c}`,
      imagenUrl: urlFirebase(CAJA, `${PREFIJO}${id}_${c}.webp`, `tok-${id}-${c}`),
    })),
  });
  const articulos = [
    art('100', true, ['v-100-AAA', 'v-100-BBB', 'v-100-CCC', 'v-100-DDD']),
    art('200', true),
    art('300', true),
  ];
  const productos = [
    {
      id: 'p100',
      sourceArticuloId: '100',
      primaryImageUrl: urlFirebase(TIENDA, 'uploads/p100.webp', 'x'),
      variants: [
        // Reemplazada en la tienda → hay copia (por sourceCodigo).
        { id: 'v-100-AAA', sourceCodigo: 'v-100-AAA', imageUrl: urlFirebase(TIENDA, 'uploads/aaa.webp', 'x') },
        // Por id, sin sourceCodigo.
        { id: 'v-100-BBB', imageUrl: urlFirebase(TIENDA, 'uploads/bbb.webp', 'x') },
        // La tienda sigue usando la de la caja → no hay copia propia.
        { id: 'v-100-CCC', sourceCodigo: 'v-100-CCC', imageUrl: urlFirebase(CAJA, `${PREFIJO}100_v-100-CCC.webp`, 'x') },
        // v-100-DDD no está en la tienda.
      ],
    },
    { id: 'p300', sourceArticuloId: '300', primaryImageUrl: null, variants: [] },
  ];
  // Existe en la caja solo la principal de 200.
  const existentes = new Set([`${PREFIJO}200.webp`]);
  return { articulos, productos, existentes, cajaBucket: CAJA, tiendaBucket: TIENDA };
}

test('planear: separa existentes, con copia y sin copia', () => {
  const plan = planear(escenario());
  assert.equal(plan.total, 7); // 100: principal + 4 variaciones; 200 y 300: principal
  assert.equal(plan.existen, 1);
  assert.deepEqual(
    plan.conCopia.map((c) => [c.path.slice(PREFIJO.length), c.origen.path]),
    [
      ['100.webp', 'uploads/p100.webp'],
      ['100_v-100-AAA.webp', 'uploads/aaa.webp'],
      ['100_v-100-BBB.webp', 'uploads/bbb.webp'],
    ],
  );
  assert.deepEqual(
    plan.sinCopia.map((s) => [s.path.slice(PREFIJO.length), s.motivo]),
    [
      ['100_v-100-CCC.webp', 'la tienda no tiene una copia propia de esta imagen'],
      ['100_v-100-DDD.webp', 'la tienda no tiene una copia propia de esta imagen'],
      ['300.webp', 'la tienda no tiene una copia propia de esta imagen'],
    ],
  );
});

test('planear: artículo sin vincular a la tienda', () => {
  const datos = escenario();
  datos.productos = [];
  const plan = planear(datos);
  assert.equal(plan.conCopia.length, 0);
  assert.ok(plan.sinCopia.every((s) => s.motivo === 'el artículo no está vinculado a la tienda'));
});

// ------------------------------------------------------------ preparar imagen

test('prepararImagen: un WebP liviano se usa tal cual', async () => {
  const chica = await webpSintetico(200, 150, 0, { semilla: 7 });
  const r = await prepararImagen(chica, { maxBytes: MAX });
  assert.equal(r.convertida, false);
  assert.equal(r.buffer, chica);
});

test('prepararImagen: PNG y WebP pesado se convierten a WebP liviano', async () => {
  for (const entrada of [await pngSintetico(800, 600, 20, 3), await webpSintetico(800, 600, 20, { semilla: 4 })]) {
    assert.ok(entrada.length > MAX);
    const r = await prepararImagen(entrada, { maxBytes: MAX });
    assert.equal(r.convertida, true);
    assert.ok(r.buffer.length <= MAX);
    assert.equal((await sharp(r.buffer).metadata()).format, 'webp');
  }
});

test('prepararImagen: lo que no es imagen falla', async () => {
  await assert.rejects(prepararImagen(Buffer.from('hola')), /no se pudo leer como imagen/);
});

// -------------------------------------------------------------- recuperar

async function buckets() {
  const caja = new BucketFalso(CAJA);
  const tienda = new BucketFalso(TIENDA);
  tienda.poner('uploads/p100.webp', await webpSintetico(200, 150, 0, { semilla: 1 }), { contentType: 'image/webp' });
  tienda.poner('uploads/aaa.webp', await pngSintetico(800, 600, 20, 2), { contentType: 'image/png' });
  tienda.poner('uploads/bbb.webp', await webpSintetico(220, 160, 0, { semilla: 3 }), { contentType: 'image/webp' });
  return { caja, tienda };
}

test('recuperar (simulacro): no escribe en la caja y deja las muestras', async () => {
  const plan = planear(escenario());
  const { caja, tienda } = await buckets();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'recuperar-'));
  const r = await recuperar(plan, { bucketCaja: caja, bucketTienda: tienda, muestras: dir, maxBytes: MAX }, silencio);
  assert.equal(caja.escrituras.length, 0);
  assert.equal(caja.objetos.size, 0);
  assert.equal(r.listas.length, 3);
  assert.equal(r.recuperadas.length, 0);
  assert.deepEqual(fs.readdirSync(dir).sort(), ['100.webp', '100_v-100-AAA.webp', '100_v-100-BBB.webp']);
  assert.equal(r.listas.find((x) => x.path.endsWith('100_v-100-AAA.webp')).convertida, true);
});

test('recuperar (ejecutar): sube al mismo path con el token del artículo', async () => {
  const plan = planear(escenario());
  const { caja, tienda } = await buckets();
  const r = await recuperar(plan, { bucketCaja: caja, bucketTienda: tienda, ejecutar: true, maxBytes: MAX }, silencio);
  assert.equal(r.recuperadas.length, 3);
  assert.equal(r.fallidas.length, 0);
  for (const fila of r.recuperadas) {
    const obj = caja.objetos.get(fila.path);
    assert.ok(obj, `debe existir ${fila.path}`);
    assert.equal(obj.metadata.contentType, 'image/webp');
    const esperado = plan.conCopia.find((c) => c.path === fila.path).token;
    assert.equal(obj.metadata.metadata.firebaseStorageDownloadTokens, esperado);
    assert.ok(obj.data.length <= MAX);
    assert.equal((await sharp(obj.data).metadata()).format, 'webp');
  }
  // La tienda no se toca.
  assert.equal(tienda.escrituras.length, 0);
});

test('recuperar: nunca pisa una imagen que ya existe en la caja', async () => {
  const plan = planear(escenario());
  const { caja, tienda } = await buckets();
  const nueva = Buffer.from('imagen que alguien subió');
  caja.poner(`${PREFIJO}100.webp`, nueva, { contentType: 'image/webp' });
  // Y otra que "aparece" entre la revisión y la subida (exists dice que no).
  const carrera = `${PREFIJO}100_v-100-AAA.webp`;
  caja.poner(carrera, nueva, { contentType: 'image/webp' });
  const file = caja.file.bind(caja);
  caja.file = (n, o) => {
    const a = file(n, o);
    if (n === carrera) a.exists = async () => [false];
    return a;
  };
  const r = await recuperar(plan, { bucketCaja: caja, bucketTienda: tienda, ejecutar: true, maxBytes: MAX }, silencio);
  assert.deepEqual(r.yaExistian.map((x) => x.path).sort(), [`${PREFIJO}100.webp`, carrera]);
  assert.equal(r.recuperadas.length, 1);
  assert.deepEqual(caja.objetos.get(`${PREFIJO}100.webp`).data, nueva);
  assert.deepEqual(caja.objetos.get(carrera).data, nueva);
});

test('recuperar: un error no detiene las demás; --limit respeta el tope', async () => {
  const plan = planear(escenario());
  const { caja, tienda } = await buckets();
  tienda.objetos.delete('uploads/p100.webp'); // la copia de la principal ya no está
  const r = await recuperar(plan, { bucketCaja: caja, bucketTienda: tienda, ejecutar: true, maxBytes: MAX }, silencio);
  assert.equal(r.fallidas.length, 1);
  assert.equal(r.fallidas[0].path, `${PREFIJO}100.webp`);
  assert.equal(r.recuperadas.length, 2);

  const otra = await buckets();
  const r2 = await recuperar(plan, { bucketCaja: otra.caja, bucketTienda: otra.tienda, ejecutar: true, limit: 1, maxBytes: MAX }, silencio);
  assert.equal(r2.procesadas, 1);
  assert.equal(otra.caja.objetos.size, 1);
});

test('recuperar: si el artículo no traía token, sube sin token', async () => {
  const datos = escenario();
  datos.articulos = [{ id: '200', nombre: 'x', imagenUrl: urlFirebase(CAJA, `${PREFIJO}201.webp`) }];
  datos.productos = [{ id: 'p', sourceArticuloId: '200', primaryImageUrl: urlFirebase(TIENDA, 'uploads/p100.webp', 'x') }];
  const plan = planear(datos);
  const { caja, tienda } = await buckets();
  const r = await recuperar(plan, { bucketCaja: caja, bucketTienda: tienda, ejecutar: true, maxBytes: MAX }, silencio);
  assert.equal(r.recuperadas.length, 1);
  assert.equal(caja.objetos.get(`${PREFIJO}201.webp`).metadata.metadata, undefined);
});
