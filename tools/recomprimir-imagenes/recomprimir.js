#!/usr/bin/env node
'use strict';

/**
 * Recomprime a WebP (< 500 KB) las imágenes de artículos ya subidas a Firebase
 * Storage. Sobrescribe cada archivo en el MISMO path y conserva su
 * contentType y su metadata (en especial `firebaseStorageDownloadTokens`),
 * así las URLs guardadas en Firestore siguen funcionando.
 *
 * Uso: node recomprimir.js --bucket <bucket> [--dry-run] [--limit N]
 * Más detalle en README.md.
 */

const fs = require('node:fs/promises');
const path = require('node:path');
const { parseArgs } = require('node:util');
const { comprimirAWebP, MAX_BYTES } = require('./comprimir');

const PREFIJO = 'media_web_new_version/articulos/';
const TIPO_WEBP = 'image/webp';
const TOKEN = 'firebaseStorageDownloadTokens';
// Subir al mismo path REEMPLAZA el objeto completo, metadata incluida: lo que
// no se reenvíe en la subida se pierde (y con el token, las URLs guardadas en
// Firestore). Estos campos se copian del original; la metadata personalizada
// (donde vive el token) se copia aparte. contentEncoding no se copia: el
// archivo nuevo se sube tal cual, sin gzip.
const CAMPOS_CONSERVADOS = ['cacheControl', 'contentDisposition', 'contentLanguage'];

const USO = `Uso: node recomprimir.js --bucket <bucket> [opciones]

Recomprime a WebP (< ${MAX_BYTES / 1024} KB) las imágenes de ${PREFIJO}
que pesen más, sobrescribiéndolas en el mismo path.

Opciones:
  --bucket <nombre>       Bucket de Storage (o variable de entorno STORAGE_BUCKET).
  --dry-run               Solo lista los candidatos con su tamaño actual; no
                          descarga ni modifica nada.
  --limit <N>             Procesa como máximo N candidatos (los más pesados primero).
  --backup-dir <carpeta>  Guarda ahí una copia de cada original antes de sobrescribirlo.
  -h, --help              Muestra esta ayuda.

Credenciales: Application Default Credentials (variable GOOGLE_APPLICATION_CREDENTIALS
o "gcloud auth application-default login"). Ver README.md.
`;

class ErrorUso extends Error {}

function formatoBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function parsearArgumentos(argv, env = process.env) {
  let valores;
  try {
    ({ values: valores } = parseArgs({
      args: argv,
      options: {
        bucket: { type: 'string' },
        'dry-run': { type: 'boolean', default: false },
        limit: { type: 'string' },
        'backup-dir': { type: 'string' },
        help: { type: 'boolean', short: 'h', default: false },
      },
      allowPositionals: false,
      strict: true,
    }));
  } catch (e) {
    throw new ErrorUso(e.message);
  }

  if (valores.help) return { ayuda: true };

  let limit = null;
  if (valores.limit !== undefined) {
    if (!/^\d+$/.test(valores.limit) || Number(valores.limit) < 1) {
      throw new ErrorUso('--limit debe ser un entero positivo.');
    }
    limit = Number(valores.limit);
  }

  const bucket = (valores.bucket || env.STORAGE_BUCKET || '')
    .trim()
    .replace(/^gs:\/\//, '')
    .replace(/\/+$/, '');
  if (!bucket) {
    throw new ErrorUso(
      'Falta el bucket: pásalo con --bucket <nombre> o define STORAGE_BUCKET ' +
        '(Firebase Console > Configuración del proyecto, o "storageBucket" de la config web).',
    );
  }

  return {
    ayuda: false,
    bucket,
    dryRun: valores['dry-run'],
    limit,
    backupDir: valores['backup-dir'] || null,
  };
}

/**
 * Lista los archivos bajo el prefijo y separa los candidatos: los que pesan
 * más de `maxBytes`. Los que ya cumplen no se tocan: por eso correr el script
 * dos veces no recomprime dos veces la misma imagen.
 */
async function listarCandidatos(bucket, { maxBytes = MAX_BYTES, prefijo = PREFIJO } = {}) {
  const [archivos] = await bucket.getFiles({ prefix: prefijo });
  const candidatos = [];
  const noWebp = [];
  let total = 0;
  let yaLivianos = 0;
  for (const archivo of archivos) {
    if (archivo.name.endsWith('/')) continue; // marcador de carpeta
    total++;
    const size = Number(archivo.metadata.size);
    if (!(size > maxBytes)) {
      yaLivianos++;
      continue;
    }
    // Solo .webp: reescribir otro formato en su mismo path lo dejaría mal etiquetado.
    if (!/\.webp$/i.test(archivo.name)) {
      noWebp.push({ nombre: archivo.name, size });
      continue;
    }
    candidatos.push({
      archivo,
      nombre: archivo.name,
      size,
      generation: archivo.metadata.generation,
    });
  }
  candidatos.sort((a, b) => b.size - a.size);
  return { total, yaLivianos, noWebp, candidatos };
}

function metadataParaSubir(meta) {
  const nueva = { contentType: TIPO_WEBP };
  for (const campo of CAMPOS_CONSERVADOS) {
    if (meta[campo]) nueva[campo] = meta[campo];
  }
  if (meta.metadata && Object.keys(meta.metadata).length > 0) {
    nueva.metadata = { ...meta.metadata };
  }
  return nueva;
}

async function respaldar(backupDir, nombre, buffer) {
  const raiz = path.resolve(backupDir);
  const destino = path.resolve(raiz, ...nombre.split('/'));
  if (!destino.startsWith(raiz + path.sep)) {
    throw new Error(`el nombre sale de la carpeta de respaldo: ${nombre}`);
  }
  await fs.mkdir(path.dirname(destino), { recursive: true });
  await fs.writeFile(destino, buffer);
}

/**
 * Confirma que el objeto recién subido conserva el token de descarga y pesa lo
 * subido. Si el token se perdió lo repone; si no se logra, falla ruidosamente
 * (la URL guardada en Firestore dejaría de funcionar).
 */
async function verificarSubida(destino, metaOriginal, bytesSubidos) {
  const esperado = metaOriginal.metadata && metaOriginal.metadata[TOKEN];
  let [actual] = await destino.getMetadata();
  if (Number(actual.size) !== bytesSubidos) {
    throw new Error(
      `el tamaño en Storage (${actual.size}) no coincide con lo subido (${bytesSubidos})`,
    );
  }
  if (!esperado || (actual.metadata && actual.metadata[TOKEN]) === esperado) return;

  await destino.setMetadata(metadataParaSubir(metaOriginal));
  [actual] = await destino.getMetadata();
  if ((actual.metadata && actual.metadata[TOKEN]) !== esperado) {
    throw new Error(
      'se subió la imagen nueva pero NO se pudo conservar el token de descarga: ' +
        'la URL guardada en Firestore podría dejar de funcionar',
    );
  }
}

/**
 * Recomprime un candidato. Resultado `{ estado, ... }`:
 *   - 'recomprimido': subida y verificada.
 *   - 'no-alcanza':   ni a calidad 55 y 800 px entra; no se toca el original.
 *   - 'modificado':   el objeto cambió en Storage mientras se procesaba; no se
 *                     sobrescribe (podría ser una imagen nueva del usuario).
 * Los demás fallos se lanzan.
 */
async function recomprimirArchivo(bucket, candidato, { maxBytes = MAX_BYTES, backupDir = null } = {}) {
  const { nombre, size, generation, archivo } = candidato;
  const meta = archivo.metadata;

  // Se descarga la generación exacta listada y se sube con ifGenerationMatch:
  // si alguien reemplazó la imagen entre tanto, no se pisa con la vieja.
  let original;
  try {
    [original] = await bucket.file(nombre, { generation }).download();
  } catch (e) {
    if (e.code === 404) return { estado: 'modificado', antes: size };
    throw e;
  }

  const nuevo = await comprimirAWebP(original, { maxBytes });
  if (!nuevo) return { estado: 'no-alcanza', antes: size };

  if (backupDir) await respaldar(backupDir, nombre, original);

  const destino = bucket.file(nombre);
  try {
    await destino.save(nuevo.buffer, {
      resumable: false,
      contentType: TIPO_WEBP,
      metadata: metadataParaSubir(meta),
      preconditionOpts: { ifGenerationMatch: generation },
    });
  } catch (e) {
    if (e.code === 412) return { estado: 'modificado', antes: size };
    throw e;
  }
  await verificarSubida(destino, meta, nuevo.buffer.length);

  return {
    estado: 'recomprimido',
    antes: size,
    despues: nuevo.buffer.length,
    calidad: nuevo.calidad,
    ancho: nuevo.ancho,
    alto: nuevo.alto,
    reducida: nuevo.reducida,
  };
}

async function ejecutar(
  bucket,
  { dryRun = false, limit = null, backupDir = null, maxBytes = MAX_BYTES } = {},
  log = console.log,
) {
  const { total, yaLivianos, noWebp, candidatos } = await listarCandidatos(bucket, { maxBytes });
  const limiteKb = maxBytes / 1024;
  const lote = limit ? candidatos.slice(0, limit) : candidatos;

  const resumen = {
    total,
    yaLivianos,
    noWebp,
    candidatos: candidatos.length,
    recomprimidos: 0,
    noAlcanzan: [],
    modificados: [],
    fallidos: [],
    bytesAntes: 0,
    bytesDespues: 0,
  };

  log(
    `Archivos en ${PREFIJO}: ${total} | ya <= ${limiteKb} KB: ${yaLivianos} | ` +
      `candidatos (> ${limiteKb} KB): ${candidatos.length}`,
  );
  if (noWebp.length > 0) {
    log(`Se omiten ${noWebp.length} archivo(s) pesados que no son .webp:`);
    for (const o of noWebp) log(`  ${formatoBytes(o.size).padStart(9)}  ${o.nombre}`);
  }
  if (limit && candidatos.length > lote.length) {
    log(`--limit ${limit}: se procesan ${lote.length} de ${candidatos.length} (los más pesados).`);
  }

  if (dryRun) {
    log(`\nCandidatos${limit ? ' (los más pesados)' : ''}, de mayor a menor:`);
    for (const c of lote) log(`  ${formatoBytes(c.size).padStart(9)}  ${c.nombre}`);
    const suma = lote.reduce((s, c) => s + c.size, 0);
    log(`\nTotal de estos ${lote.length} candidatos: ${formatoBytes(suma)}.`);
    log('--dry-run: no se descargó ni se modificó nada.');
    return resumen;
  }

  log(`\nRecomprimiendo ${lote.length} imagen(es)...`);
  const ancho = String(lote.length).length;
  for (let i = 0; i < lote.length; i++) {
    const c = lote[i];
    const etiqueta = `[${String(i + 1).padStart(ancho)}/${lote.length}] ${c.nombre}`;
    try {
      const r = await recomprimirArchivo(bucket, c, { maxBytes, backupDir });
      if (r.estado === 'recomprimido') {
        resumen.recomprimidos++;
        resumen.bytesAntes += r.antes;
        resumen.bytesDespues += r.despues;
        log(
          `${etiqueta}: ${formatoBytes(r.antes)} -> ${formatoBytes(r.despues)} ` +
            `(calidad ${r.calidad}, ${r.ancho}x${r.alto}${r.reducida ? ', reducida' : ''})`,
        );
      } else if (r.estado === 'no-alcanza') {
        resumen.noAlcanzan.push(c.nombre);
        log(`${etiqueta}: no baja de ${limiteKb} KB ni con calidad mínima; se deja el original.`);
      } else {
        resumen.modificados.push(c.nombre);
        log(`${etiqueta}: cambió en Storage mientras se procesaba; se omite (vuelve a correr el script).`);
      }
    } catch (e) {
      resumen.fallidos.push({ nombre: c.nombre, error: e.message });
      log(`${etiqueta}: ERROR: ${e.message}`);
    }
  }

  log('\nResumen');
  log(
    `  Recomprimidas: ${resumen.recomprimidos}` +
      (resumen.recomprimidos > 0
        ? ` (${formatoBytes(resumen.bytesAntes)} -> ${formatoBytes(resumen.bytesDespues)}, ` +
          `ahorro ${formatoBytes(resumen.bytesAntes - resumen.bytesDespues)})`
        : ''),
  );
  if (resumen.noAlcanzan.length > 0) {
    log(`  No alcanzaron ${limiteKb} KB (original intacto): ${resumen.noAlcanzan.length}`);
    for (const n of resumen.noAlcanzan) log(`    - ${n}`);
  }
  if (resumen.modificados.length > 0) {
    log(`  Cambiaron durante el proceso (omitidas): ${resumen.modificados.length}`);
    for (const n of resumen.modificados) log(`    - ${n}`);
  }
  if (resumen.fallidos.length > 0) {
    log(`  Con error: ${resumen.fallidos.length}`);
    for (const f of resumen.fallidos) log(`    - ${f.nombre}: ${f.error}`);
  }
  return resumen;
}

function explicarError(e) {
  const msg = (e && e.message) || String(e);
  const codigo = e && e.code;
  if (codigo === 'MODULE_NOT_FOUND') {
    return `Faltan dependencias: corre "npm install" en tools/recomprimir-imagenes. (${msg})`;
  }
  // Sin credenciales, Storage contesta como "Anonymous caller" (401/403).
  if (
    codigo === 401 ||
    /anonymous caller|default credentials|credential file|GOOGLE_APPLICATION_CREDENTIALS|invalid_grant|reauth|metadata\.google\.internal/i.test(msg)
  ) {
    return (
      `No se pudo autenticar con Google Cloud: ${msg}\n` +
      'Define GOOGLE_APPLICATION_CREDENTIALS con la ruta de una clave de cuenta de servicio, ' +
      'o corre "gcloud auth application-default login" (ver README.md).'
    );
  }
  if (codigo === 403) {
    return (
      `Sin permiso sobre el bucket: ${msg}\n` +
      'La cuenta necesita listar, leer, crear y borrar objetos (rol "Storage Object Admin" o equivalente).'
    );
  }
  if (codigo === 404) {
    return `No se encontró el bucket: ${msg}\nRevisa el nombre en --bucket.`;
  }
  return `Error: ${msg}`;
}

// Cada descarga de @google-cloud/storage (vía teeny-request) agrega más de 10
// listeners a un PassThrough interno y Node avisa de una "fuga" que no lo es;
// con cientos de imágenes llenaría la consola. Solo se descarta ese aviso.
function silenciarAvisoDeListeners() {
  const originales = process.listeners('warning');
  process.removeAllListeners('warning');
  process.on('warning', (aviso) => {
    if (aviso.name === 'MaxListenersExceededWarning' && /PassThrough/.test(aviso.message)) return;
    for (const escuchar of originales) escuchar(aviso);
  });
}

async function main(argv = process.argv.slice(2)) {
  let opciones;
  try {
    opciones = parsearArgumentos(argv);
  } catch (e) {
    if (!(e instanceof ErrorUso)) throw e;
    console.error(`Error: ${e.message}\n\n${USO}`);
    return 2;
  }
  if (opciones.ayuda) {
    console.log(USO);
    return 0;
  }

  silenciarAvisoDeListeners();

  try {
    // firebase-admin se carga aquí para que las pruebas (que usan un bucket
    // falso) no dependan de él.
    const { initializeApp, applicationDefault } = require('firebase-admin/app');
    const { getStorage } = require('firebase-admin/storage');
    initializeApp({ credential: applicationDefault(), storageBucket: opciones.bucket });
    const bucket = getStorage().bucket();

    const emulador = process.env.FIREBASE_STORAGE_EMULATOR_HOST || process.env.STORAGE_EMULATOR_HOST;
    console.log(`Bucket: ${opciones.bucket}`);
    if (emulador) {
      console.log(`Usando el EMULADOR de Storage en ${emulador} (no es producción).`);
    } else {
      console.log(
        process.env.GOOGLE_APPLICATION_CREDENTIALS
          ? 'Credenciales: GOOGLE_APPLICATION_CREDENTIALS'
          : 'Credenciales: Application Default Credentials (gcloud)',
      );
    }
    console.log(opciones.dryRun ? 'Modo: --dry-run (solo lectura)\n' : 'Modo: REAL (se sobrescriben imágenes)\n');

    const resumen = await ejecutar(bucket, opciones);
    return resumen.fallidos.length > 0 ? 1 : 0;
  } catch (e) {
    console.error(explicarError(e));
    return 1;
  }
}

if (require.main === module) {
  main().then(
    (codigo) => {
      process.exitCode = codigo;
    },
    (e) => {
      console.error(e);
      process.exitCode = 1;
    },
  );
}

module.exports = {
  ErrorUso,
  parsearArgumentos,
  listarCandidatos,
  metadataParaSubir,
  explicarError,
  recomprimirArchivo,
  ejecutar,
  main,
  PREFIJO,
};
