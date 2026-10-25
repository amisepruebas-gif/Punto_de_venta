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
  listarCandidatos,
  ejecutar,
  explicarError,
  main,
  PREFIJO,
} = require('../recomprimir');
const { webpSintetico, BucketFalso } = require('./ayudas');

// Límite chico para que las pruebas usen imágenes chicas y sean rápidas.
const MAX = 60 * 1024;
const silencio = () => {};

function metaFirebase(nombre, token) {
  return {
    contentType: 'image/webp',
    cacheControl: 'public, max-age=3600',
    contentDisposition: `inline; filename*=utf-8''${nombre}`,
    metadata: { firebaseStorageDownloadTokens: token },
  };
}

/** Imagen que pesa más que MAX y se puede bajar de MAX. */
async function pesada(semilla) {
  const buf = await webpSintetico(800, 600, 20, { semilla });
  assert.ok(buf.length > MAX, `la imagen de prueba debe pesar > ${MAX} (pesa ${buf.length})`);
  return buf;
}

async function bucketConImagenes() {
  const bucket = new BucketFalso('proyecto.firebasestorage.app');
  const originales = {
    [`${PREFIJO}a.webp`]: await pesada(1),
    [`${PREFIJO}b.webp`]: await pesada(2),
    [`${PREFIJO}123_AB-01.webp`]: await pesada(3),
  };
  for (const [nombre, datos] of Object.entries(originales)) {
    const corto = nombre.split('/').pop();
    bucket.poner(nombre, datos, metaFirebase(corto, `token-${corto}`));
  }
  return { bucket, originales };
}

// ---------------------------------------------------------------- argumentos

test('argumentos: opciones válidas', () => {
  assert.deepEqual(
    parsearArgumentos(['--bucket', 'b', '--dry-run', '--limit', '5', '--backup-dir', 'resp']),
    { ayuda: false, bucket: 'b', dryRun: true, limit: 5, backupDir: 'resp' },
  );
  assert.deepEqual(parsearArgumentos(['--bucket=b'], {}), {
    ayuda: false,
    bucket: 'b',
    dryRun: false,
    limit: null,
    backupDir: null,
  });
});

test('argumentos: el bucket también sale de STORAGE_BUCKET y acepta gs://', () => {
  assert.equal(parsearArgumentos([], { STORAGE_BUCKET: 'gs://mi-bucket/' }).bucket, 'mi-bucket');
  assert.equal(parsearArgumentos(['--bucket', 'otro'], { STORAGE_BUCKET: 'x' }).bucket, 'otro');
});

test('argumentos: errores de uso', () => {
  assert.throws(() => parsearArgumentos([], {}), (e) => e instanceof ErrorUso && /Falta el bucket/.test(e.message));
  for (const limit of ['0', 'abc', '2.5']) {
    assert.throws(
      () => parsearArgumentos(['--bucket', 'b', '--limit', limit]),
      (e) => e instanceof ErrorUso,
      `--limit ${limit}`,
    );
  }
  assert.throws(() => parsearArgumentos(['--bucket', 'b', '--rapido']), ErrorUso);
  assert.throws(() => parsearArgumentos(['--bucket', 'b', 'suelto']), ErrorUso);
});

test('argumentos: --help no exige bucket', () => {
  assert.deepEqual(parsearArgumentos(['--help'], {}), { ayuda: true });
});

test('main: --help devuelve 0 y un error de uso devuelve 2, sin tocar Firebase', async (t) => {
  t.mock.method(console, 'log', silencio);
  t.mock.method(console, 'error', silencio);
  // Sin bucket en el entorno, `main([])` es un error de uso (y no conecta a nada).
  const previo = process.env.STORAGE_BUCKET;
  delete process.env.STORAGE_BUCKET;
  t.after(() => {
    if (previo !== undefined) process.env.STORAGE_BUCKET = previo;
  });
  assert.equal(await main(['--help']), 0);
  assert.equal(await main(['--limit', '0']), 2);
  assert.equal(await main([]), 2);
});

test('explicarError: orienta según el tipo de falla', () => {
  const con = (message, code) => Object.assign(new Error(message), { code });
  assert.match(
    explicarError(con('Anonymous caller does not have storage.objects.list access', 401)),
    /GOOGLE_APPLICATION_CREDENTIALS/,
  );
  assert.match(explicarError(con('Could not load the default credentials.')), /gcloud auth application-default login/);
  assert.match(explicarError(con('denied', 403)), /Storage Object Admin/);
  assert.match(explicarError(con('The specified bucket does not exist.', 404)), /--bucket/);
  assert.match(explicarError(con("Cannot find module 'firebase-admin/app'", 'MODULE_NOT_FOUND')), /npm install/);
  assert.match(explicarError(new Error('boom')), /boom/);
});

// ------------------------------------------------------------------- listado

test('listado: solo candidatos > límite, .webp, bajo el prefijo, de mayor a menor', async () => {
  const { bucket, originales } = await bucketConImagenes();
  bucket.poner(`${PREFIJO}chica.webp`, await webpSintetico(100, 80, 0), metaFirebase('chica.webp', 't'));
  bucket.poner(`${PREFIJO}foto.png`, Buffer.alloc(MAX * 2), { contentType: 'image/png' });
  bucket.poner(PREFIJO, Buffer.alloc(0), {}); // marcador de carpeta
  bucket.poner('chat_media_web_new_version/x.webp', await pesada(9), {}); // fuera del prefijo

  const r = await listarCandidatos(bucket, { maxBytes: MAX });
  assert.equal(r.total, 5); // 3 pesadas + chica + png (sin marcador ni lo de afuera)
  assert.equal(r.yaLivianos, 1);
  assert.deepEqual(r.noWebp.map((o) => o.nombre), [`${PREFIJO}foto.png`]);
  const nombres = r.candidatos.map((c) => c.nombre);
  assert.deepEqual(new Set(nombres), new Set(Object.keys(originales)));
  for (let i = 1; i < r.candidatos.length; i++) {
    assert.ok(r.candidatos[i - 1].size >= r.candidatos[i].size, 'orden descendente');
  }
});

// ------------------------------------------------------------------- dry-run

test('--dry-run lista los candidatos y no descarga ni escribe nada', async () => {
  const { bucket } = await bucketConImagenes();
  const lineas = [];
  const antes = structuredClone([...bucket.objetos.values()].map((o) => o.metadata));

  const r = await ejecutar(bucket, { dryRun: true, maxBytes: MAX }, (l) => lineas.push(l));

  assert.equal(bucket.escrituras.length, 0);
  assert.equal(bucket.descargas, 0);
  assert.deepEqual([...bucket.objetos.values()].map((o) => o.metadata), antes);
  assert.equal(r.recomprimidos, 0);
  assert.equal(r.candidatos, 3);
  const texto = lineas.join('\n');
  for (const n of ['a.webp', 'b.webp', '123_AB-01.webp']) assert.ok(texto.includes(n), n);
  assert.match(texto, /--dry-run/);
});

test('--dry-run respeta --limit', async () => {
  const { bucket } = await bucketConImagenes();
  const lineas = [];
  await ejecutar(bucket, { dryRun: true, limit: 2, maxBytes: MAX }, (l) => lineas.push(l));
  const listados = lineas.filter((l) => /\.webp$/.test(l));
  assert.equal(listados.length, 2);
});

// ---------------------------------------------------------- corrida real

test('recomprime al mismo path conservando contentType, metadata y token', async () => {
  const { bucket, originales } = await bucketConImagenes();
  const generaciones = Object.fromEntries(
    [...bucket.objetos].map(([n, o]) => [n, o.metadata.generation]),
  );
  const chica = await webpSintetico(100, 80, 0);
  bucket.poner(`${PREFIJO}chica.webp`, chica, metaFirebase('chica.webp', 'token-chica'));
  const generacionChica = bucket.objetos.get(`${PREFIJO}chica.webp`).metadata.generation;

  const r = await ejecutar(bucket, { maxBytes: MAX }, silencio);

  assert.equal(r.recomprimidos, 3);
  assert.deepEqual(r.fallidos, []);
  for (const nombre of Object.keys(originales)) {
    const obj = bucket.objetos.get(nombre);
    const corto = nombre.split('/').pop();
    assert.ok(obj.data.length <= MAX, `${corto} pesa ${obj.data.length}`);
    assert.ok(obj.data.length < originales[nombre].length);
    assert.notEqual(obj.metadata.generation, generaciones[nombre], 'se reescribió');
    assert.equal(obj.metadata.contentType, 'image/webp');
    assert.equal(obj.metadata.cacheControl, 'public, max-age=3600');
    assert.equal(obj.metadata.contentDisposition, `inline; filename*=utf-8''${corto}`);
    assert.equal(obj.metadata.metadata.firebaseStorageDownloadTokens, `token-${corto}`);
    assert.equal((await sharp(obj.data).metadata()).format, 'webp');
  }
  // Lo que ya cumplía no se toca: recomprimir una vez, no dos.
  const objChica = bucket.objetos.get(`${PREFIJO}chica.webp`);
  assert.equal(objChica.metadata.generation, generacionChica);
  assert.ok(objChica.data.equals(chica));

  // Segunda corrida: ya no queda nada por hacer.
  const escriturasAntes = bucket.escrituras.length;
  const segunda = await ejecutar(bucket, { maxBytes: MAX }, silencio);
  assert.equal(segunda.candidatos, 0);
  assert.equal(bucket.escrituras.length, escriturasAntes);
});

test('la subida pide resumable:false, reenvía la metadata y exige la generación listada', async () => {
  const { bucket } = await bucketConImagenes();
  const generacion = bucket.objetos.get(`${PREFIJO}a.webp`).metadata.generation;
  await ejecutar(bucket, { maxBytes: MAX, limit: 3 }, silencio);

  const escritura = bucket.escrituras.find((e) => e.nombre === `${PREFIJO}a.webp`);
  assert.equal(escritura.opciones.resumable, false);
  assert.equal(escritura.opciones.contentType, 'image/webp');
  assert.equal(escritura.opciones.preconditionOpts.ifGenerationMatch, generacion);
  assert.equal(escritura.opciones.metadata.metadata.firebaseStorageDownloadTokens, 'token-a.webp');
});

test('--limit procesa solo los N más pesados', async () => {
  const { bucket, originales } = await bucketConImagenes();
  const r = await ejecutar(bucket, { maxBytes: MAX, limit: 1 }, silencio);
  assert.equal(r.recomprimidos, 1);
  const masPesada = Object.entries(originales).sort((x, y) => y[1].length - x[1].length)[0][0];
  const tocados = [...bucket.objetos]
    .filter(([n, o]) => !o.data.equals(originales[n]))
    .map(([n]) => n);
  assert.deepEqual(tocados, [masPesada]);
});

test('un archivo dañado da error pero no detiene a los demás ni se sobrescribe', async () => {
  const { bucket, originales } = await bucketConImagenes();
  const basura = Buffer.alloc(MAX * 2, 7);
  bucket.poner(`${PREFIJO}zz-dañada.webp`, basura, metaFirebase('zz', 'token-zz'));

  const r = await ejecutar(bucket, { maxBytes: MAX }, silencio);

  assert.equal(r.recomprimidos, 3);
  assert.equal(r.fallidos.length, 1);
  assert.equal(r.fallidos[0].nombre, `${PREFIJO}zz-dañada.webp`);
  assert.ok(bucket.objetos.get(`${PREFIJO}zz-dañada.webp`).data.equals(basura));
  for (const [nombre, datos] of Object.entries(originales)) {
    assert.ok(bucket.objetos.get(nombre).data.length < datos.length, `${nombre} se recomprimió`);
  }
});

test('si no baja del límite, deja el original intacto y lo reporta', async () => {
  const { bucket, originales } = await bucketConImagenes();
  const r = await ejecutar(bucket, { maxBytes: 1024 }, silencio); // imposible
  assert.equal(r.recomprimidos, 0);
  assert.equal(r.noAlcanzan.length, 3);
  assert.equal(bucket.escrituras.length, 0);
  for (const [nombre, datos] of Object.entries(originales)) {
    assert.ok(bucket.objetos.get(nombre).data.equals(datos));
  }
});

test('si la imagen cambia mientras se procesa, no la pisa con la vieja', async () => {
  const { bucket } = await bucketConImagenes();
  const nueva = await webpSintetico(640, 480, 5, { semilla: 99 });
  const objetivo = `${PREFIJO}a.webp`;
  bucket.alDescargar = async (nombre) => {
    // El usuario sube una imagen nueva justo después de que el script descargó la vieja.
    if (nombre === objetivo) bucket.poner(objetivo, nueva, metaFirebase('a.webp', 'token-nuevo'));
  };

  const r = await ejecutar(bucket, { maxBytes: MAX }, silencio);

  assert.deepEqual(r.modificados, [objetivo]);
  assert.equal(r.recomprimidos, 2);
  const obj = bucket.objetos.get(objetivo);
  assert.ok(obj.data.equals(nueva), 'la imagen nueva del usuario sigue ahí');
  assert.equal(obj.metadata.metadata.firebaseStorageDownloadTokens, 'token-nuevo');
});

test('--backup-dir guarda el original antes de sobrescribir', async () => {
  const { bucket, originales } = await bucketConImagenes();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'respaldo-imagenes-'));
  try {
    await ejecutar(bucket, { maxBytes: MAX, backupDir: dir }, silencio);
    for (const [nombre, datos] of Object.entries(originales)) {
      const copia = fs.readFileSync(path.join(dir, ...nombre.split('/')));
      assert.ok(copia.equals(datos), nombre);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('si la subida pierde el token, lo repone', async () => {
  const { bucket } = await bucketConImagenes();
  bucket.descartarMetadataPersonalizada = true; // simula una subida que reemplaza la metadata
  // Con descartarMetadataPersonalizada la metadata llega sin token; setMetadata lo repone.
  const r = await ejecutar(bucket, { maxBytes: MAX }, silencio);
  assert.equal(r.recomprimidos, 3);
  assert.deepEqual(r.fallidos, []);
  assert.equal(
    bucket.objetos.get(`${PREFIJO}b.webp`).metadata.metadata.firebaseStorageDownloadTokens,
    'token-b.webp',
  );
});

test('si no puede conservar el token, falla en voz alta', async () => {
  const { bucket } = await bucketConImagenes();
  bucket.descartarMetadataPersonalizada = true;
  bucket.ignorarSetMetadata = true;
  const r = await ejecutar(bucket, { maxBytes: MAX }, silencio);
  assert.equal(r.recomprimidos, 0);
  assert.equal(r.fallidos.length, 3);
  assert.match(r.fallidos[0].error, /token de descarga/);
});
