#!/usr/bin/env node
'use strict';

/**
 * Recupera las imágenes de artículos de la caja que se borraron de Storage
 * usando la copia que guarda la tienda amise.mx.
 *
 * Qué pasó: la tienda vincula artículos de la caja copiando sus URLs de
 * imagen. Cuando ahí se reemplazó una imagen (p. ej. con "fondo blanco IA"),
 * la tienda borró la "anterior", que era el archivo de la caja. El artículo
 * siguió apuntando a ese archivo y en la caja se ve roto.
 *
 * Qué hace este script, para cada imagen de artículo cuyo archivo ya no existe:
 *   1. Busca el producto de la tienda vinculado al artículo
 *      (`products.sourceArticuloId`) y su imagen actual: la principal o la de
 *      la variación con el mismo código. Solo sirve si esa imagen está en el
 *      bucket de la TIENDA (si apunta a la caja, también está borrada).
 *   2. La descarga y la deja en WebP de 500 KB o menos (si ya lo es, tal cual).
 *   3. La sube al MISMO path de antes en la caja, con el MISMO token de la URL
 *      guardada en el artículo: la URL vuelve a funcionar sin tocar Firestore.
 *      Nunca pisa un archivo que ya exista.
 *
 * Sin `--ejecutar` es un simulacro: solo lee (también descarga y convierte,
 * para comprobar que todo se puede recuperar), no sube nada.
 *
 * Uso: node recuperar-de-tienda.js [--ejecutar] [--limit N] [--reporte x.json] [--muestras carpeta]
 * Más detalle en README.md.
 */

const fs = require('node:fs/promises');
const path = require('node:path');
const { parseArgs } = require('node:util');
const sharp = require('sharp');
const { comprimirAWebP, MAX_BYTES } = require('./comprimir');
const { silenciarAvisoDeListeners } = require('./recomprimir');

const PREFIJO = 'media_web_new_version/articulos/';
const TOKEN = 'firebaseStorageDownloadTokens';
const TIPO_WEBP = 'image/webp';

const POR_DEFECTO = {
  cajaProyecto: 'amisetienda-c7eab',
  cajaBucket: 'amisetienda-c7eab.appspot.com',
  negocio: 'amise',
  tiendaProyecto: 'pagina-tienda-b02af',
  tiendaBucket: 'pagina-tienda-b02af.firebasestorage.app',
};

const USO = `Uso: node recuperar-de-tienda.js [opciones]

Recupera las imágenes de artículos de la caja que ya no existen en Storage,
con la copia que tiene la tienda amise.mx. Sin --ejecutar no sube nada.

Opciones:
  --ejecutar              Sube las imágenes recuperadas (sin esto: simulacro, solo lectura).
  --limit <N>             Procesa como máximo N imágenes recuperables.
  --reporte <archivo>     Guarda el detalle en JSON (recuperables, sin copia, errores).
  --muestras <carpeta>    Guarda ahí las imágenes ya convertidas, para revisarlas.
  --caja-proyecto <id>    Proyecto de la caja (${POR_DEFECTO.cajaProyecto}).
  --caja-bucket <nombre>  Bucket de la caja (${POR_DEFECTO.cajaBucket}).
  --negocio <id>          Negocio de la caja (${POR_DEFECTO.negocio}).
  --tienda-proyecto <id>  Proyecto de la tienda (${POR_DEFECTO.tiendaProyecto}).
  --tienda-bucket <nombre> Bucket de la tienda (${POR_DEFECTO.tiendaBucket}).
  -h, --help              Muestra esta ayuda.

Credenciales: Application Default Credentials con acceso a los DOS proyectos
("gcloud auth application-default login"). Ver README.md.
`;

class ErrorUso extends Error {}

function formatoBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function parsearArgumentos(argv) {
  let v;
  try {
    ({ values: v } = parseArgs({
      args: argv,
      options: {
        ejecutar: { type: 'boolean', default: false },
        limit: { type: 'string' },
        reporte: { type: 'string' },
        muestras: { type: 'string' },
        'caja-proyecto': { type: 'string' },
        'caja-bucket': { type: 'string' },
        negocio: { type: 'string' },
        'tienda-proyecto': { type: 'string' },
        'tienda-bucket': { type: 'string' },
        help: { type: 'boolean', short: 'h', default: false },
      },
      allowPositionals: false,
      strict: true,
    }));
  } catch (e) {
    throw new ErrorUso(e.message);
  }
  if (v.help) return { ayuda: true };
  let limit = null;
  if (v.limit !== undefined) {
    if (!/^\d+$/.test(v.limit) || Number(v.limit) < 1) {
      throw new ErrorUso('--limit debe ser un entero positivo.');
    }
    limit = Number(v.limit);
  }
  const limpiarBucket = (b) => b.trim().replace(/^gs:\/\//, '').replace(/\/+$/, '');
  return {
    ayuda: false,
    ejecutar: v.ejecutar,
    limit,
    reporte: v.reporte || null,
    muestras: v.muestras || null,
    cajaProyecto: v['caja-proyecto'] || POR_DEFECTO.cajaProyecto,
    cajaBucket: limpiarBucket(v['caja-bucket'] || POR_DEFECTO.cajaBucket),
    negocio: v.negocio || POR_DEFECTO.negocio,
    tiendaProyecto: v['tienda-proyecto'] || POR_DEFECTO.tiendaProyecto,
    tiendaBucket: limpiarBucket(v['tienda-bucket'] || POR_DEFECTO.tiendaBucket),
  };
}

/**
 * Lee bucket, path y token de una URL de descarga de Firebase Storage
 * (`https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<path>?...&token=`)
 * o de una URL `gs://<bucket>/<path>`. `null` si no es de Storage.
 */
function parsearUrlStorage(url) {
  if (typeof url !== 'string' || !url) return null;
  if (url.startsWith('gs://')) {
    const resto = url.slice(5);
    const i = resto.indexOf('/');
    if (i <= 0 || i === resto.length - 1) return null;
    return { bucket: resto.slice(0, i), path: resto.slice(i + 1), token: null };
  }
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const m = u.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
  if (!m) return null;
  try {
    return {
      bucket: decodeURIComponent(m[1]),
      path: decodeURIComponent(m[2]),
      token: u.searchParams.get('token'),
    };
  } catch {
    return null;
  }
}

/**
 * Imágenes que apuntan los artículos (principal y variaciones), solo las del
 * bucket de la caja bajo `media_web_new_version/articulos/`. Sin repetir path.
 */
function recolectarImagenes(articulos, cajaBucket) {
  const vistas = new Set();
  const out = [];
  const agregar = (a, url, extra) => {
    const p = parsearUrlStorage(url);
    if (!p || p.bucket !== cajaBucket || !p.path.startsWith(PREFIJO)) return;
    if (vistas.has(p.path)) return;
    vistas.add(p.path);
    out.push({
      articuloId: a.id,
      articulo: a.nombre || '',
      path: p.path,
      token: p.token,
      ...extra,
    });
  };
  for (const a of articulos) {
    if (a.imagenUrl) agregar(a, a.imagenUrl, { cual: 'principal' });
    for (const sv of Array.isArray(a.subvariaciones) ? a.subvariaciones : []) {
      if (sv && sv.imagenUrl) {
        agregar(a, sv.imagenUrl, { cual: 'variacion', codigo: sv.codigo || '', variacion: sv.nombre || '' });
      }
    }
  }
  return out;
}

/**
 * Imagen de la tienda que reemplazó a `img`: la principal del producto o la de
 * la variación con el mismo código. Solo vale si está en el bucket de la tienda.
 */
function buscarCopiaEnTienda(img, productosPorArticulo, tiendaBucket) {
  const productos = productosPorArticulo.get(img.articuloId) || [];
  const urls = [];
  for (const p of productos) {
    if (img.cual === 'principal') {
      urls.push(p.primaryImageUrl);
    } else {
      for (const v of Array.isArray(p.variants) ? p.variants : []) {
        if (v && (v.sourceCodigo === img.codigo || v.id === img.codigo)) urls.push(v.imageUrl);
      }
    }
  }
  for (const url of urls) {
    const p = parsearUrlStorage(url);
    if (p && p.bucket === tiendaBucket) return { url, path: p.path, productos: productos.map((x) => x.id) };
  }
  return null;
}

/**
 * Arma el plan sin tocar nada: qué imágenes faltan en la caja y, de esas,
 * cuáles tienen copia en la tienda.
 * @param {{ articulos: object[], productos: object[], existentes: Set<string>,
 *           cajaBucket: string, tiendaBucket: string }} datos
 */
function planear({ articulos, productos, existentes, cajaBucket, tiendaBucket }) {
  const imagenes = recolectarImagenes(articulos, cajaBucket);
  const productosPorArticulo = new Map();
  for (const p of productos) {
    if (!p || !p.sourceArticuloId) continue;
    const k = String(p.sourceArticuloId);
    if (!productosPorArticulo.has(k)) productosPorArticulo.set(k, []);
    productosPorArticulo.get(k).push(p);
  }
  const conCopia = [];
  const sinCopia = [];
  let existen = 0;
  for (const img of imagenes) {
    if (existentes.has(img.path)) {
      existen++;
      continue;
    }
    const copia = buscarCopiaEnTienda(img, productosPorArticulo, tiendaBucket);
    if (copia) conCopia.push({ ...img, origen: copia });
    else {
      sinCopia.push({
        ...img,
        motivo: productosPorArticulo.has(img.articuloId)
          ? 'la tienda no tiene una copia propia de esta imagen'
          : 'el artículo no está vinculado a la tienda',
      });
    }
  }
  return { total: imagenes.length, existen, conCopia, sinCopia };
}

/** WebP de `maxBytes` o menos: si ya lo es, tal cual; si no, se convierte. */
async function prepararImagen(entrada, { maxBytes = MAX_BYTES } = {}) {
  let meta;
  try {
    meta = await sharp(entrada).metadata();
  } catch (e) {
    throw new Error(`no se pudo leer como imagen (${e.message})`);
  }
  if (meta.format === 'webp' && (meta.pages || 1) === 1 && entrada.length <= maxBytes) {
    return { buffer: entrada, convertida: false, formato: meta.format };
  }
  const r = await comprimirAWebP(entrada, { maxBytes });
  if (!r) throw new Error(`no baja de ${formatoBytes(maxBytes)} ni con calidad mínima`);
  return { buffer: r.buffer, convertida: true, formato: meta.format };
}

function nombreMuestra(img) {
  return img.path.slice(PREFIJO.length).replace(/[\\/]/g, '_');
}

/**
 * Recupera (o simula) cada imagen con copia. Un error en una no detiene las demás.
 * `bucketCaja` y `bucketTienda` siguen la API de @google-cloud/storage.
 */
async function recuperar(
  plan,
  { bucketCaja, bucketTienda, ejecutar = false, limit = null, muestras = null, maxBytes = MAX_BYTES },
  log = console.log,
) {
  const lote = limit ? plan.conCopia.slice(0, limit) : plan.conCopia;
  const resumen = { procesadas: 0, recuperadas: [], listas: [], yaExistian: [], fallidas: [] };
  if (muestras) await fs.mkdir(muestras, { recursive: true });
  const ancho = String(lote.length).length;

  for (let i = 0; i < lote.length; i++) {
    const img = lote[i];
    const etiqueta = `[${String(i + 1).padStart(ancho)}/${lote.length}] ${img.path.slice(PREFIJO.length)}`;
    resumen.procesadas++;
    try {
      const [original] = await bucketTienda.file(img.origen.path).download();
      const lista = await prepararImagen(original, { maxBytes });
      if (muestras) await fs.writeFile(path.join(muestras, nombreMuestra(img)), lista.buffer);
      const fila = {
        articuloId: img.articuloId,
        cual: img.cual,
        codigo: img.codigo,
        path: img.path,
        origen: img.origen.path,
        bytes: lista.buffer.length,
        convertida: lista.convertida,
      };

      const destino = bucketCaja.file(img.path);
      const [yaExiste] = await destino.exists();
      if (yaExiste) {
        resumen.yaExistian.push(fila);
        log(`${etiqueta}: ya existe en la caja; no se toca.`);
        continue;
      }
      if (!ejecutar) {
        resumen.listas.push(fila);
        log(`${etiqueta}: lista (${formatoBytes(lista.buffer.length)}${lista.convertida ? `, convertida de ${lista.formato}` : ''}).`);
        continue;
      }

      try {
        await destino.save(lista.buffer, {
          resumable: false,
          contentType: TIPO_WEBP,
          metadata: img.token ? { metadata: { [TOKEN]: img.token } } : {},
          // 0 = solo si NO existe: nunca pisa una imagen que alguien subió.
          preconditionOpts: { ifGenerationMatch: 0 },
        });
      } catch (e) {
        if (e.code === 412) {
          resumen.yaExistian.push(fila);
          log(`${etiqueta}: apareció en la caja mientras corría; no se toca.`);
          continue;
        }
        throw e;
      }
      const [subido] = await destino.getMetadata();
      if (Number(subido.size) !== lista.buffer.length) {
        throw new Error(`el tamaño en Storage (${subido.size}) no coincide con lo subido (${lista.buffer.length})`);
      }
      if (img.token && !(subido.metadata && String(subido.metadata[TOKEN] || '').split(',').includes(img.token))) {
        throw new Error('se subió pero sin el token de la URL guardada en el artículo');
      }
      resumen.recuperadas.push(fila);
      log(`${etiqueta}: recuperada (${formatoBytes(lista.buffer.length)}).`);
    } catch (e) {
      resumen.fallidas.push({ articuloId: img.articuloId, cual: img.cual, codigo: img.codigo, path: img.path, error: e.message });
      log(`${etiqueta}: ERROR: ${e.message}`);
    }
  }
  return resumen;
}

function explicarError(e) {
  const msg = (e && e.message) || String(e);
  const codigo = e && e.code;
  if (codigo === 'MODULE_NOT_FOUND') {
    return `Faltan dependencias: corre "npm install" en tools/recomprimir-imagenes. (${msg})`;
  }
  if (
    codigo === 401 ||
    codigo === 16 ||
    /anonymous caller|default credentials|credential file|GOOGLE_APPLICATION_CREDENTIALS|invalid_grant|reauth|metadata\.google\.internal/i.test(msg)
  ) {
    return (
      `No se pudo autenticar con Google Cloud: ${msg}\n` +
      'Corre "gcloud auth application-default login" con una cuenta que tenga acceso a los dos proyectos (ver README.md).'
    );
  }
  if (codigo === 403 || codigo === 7) {
    return `Sin permiso: ${msg}\nLa cuenta necesita leer Firestore y Storage de los dos proyectos y crear objetos en el bucket de la caja.`;
  }
  return `Error: ${msg}`;
}

/** Firestore → objetos planos con `id`, para `planear`. */
async function leerColeccion(db, ruta, campos) {
  const snap = await db.collection(ruta).select(...campos).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function listarNombres(bucket, prefijo) {
  const [archivos] = await bucket.getFiles({ prefix: prefijo });
  return new Set(archivos.map((a) => a.name));
}

async function guardarReporte(archivo, datos) {
  await fs.mkdir(path.dirname(path.resolve(archivo)), { recursive: true });
  await fs.writeFile(archivo, JSON.stringify(datos, null, 2));
}

async function main(argv = process.argv.slice(2)) {
  let o;
  try {
    o = parsearArgumentos(argv);
  } catch (e) {
    if (!(e instanceof ErrorUso)) throw e;
    console.error(`Error: ${e.message}\n\n${USO}`);
    return 2;
  }
  if (o.ayuda) {
    console.log(USO);
    return 0;
  }

  silenciarAvisoDeListeners();

  try {
    const { initializeApp, applicationDefault } = require('firebase-admin/app');
    const { getFirestore } = require('firebase-admin/firestore');
    const { getStorage } = require('firebase-admin/storage');
    const cred = applicationDefault();
    const appCaja = initializeApp({ credential: cred, projectId: o.cajaProyecto }, 'caja');
    const appTienda = initializeApp({ credential: cred, projectId: o.tiendaProyecto }, 'tienda');
    const bucketCaja = getStorage(appCaja).bucket(o.cajaBucket);
    const bucketTienda = getStorage(appTienda).bucket(o.tiendaBucket);

    const emulador = process.env.FIREBASE_STORAGE_EMULATOR_HOST || process.env.STORAGE_EMULATOR_HOST;
    console.log(`Caja:   ${o.cajaProyecto} / ${o.cajaBucket} / negocio ${o.negocio}`);
    console.log(`Tienda: ${o.tiendaProyecto} / ${o.tiendaBucket}`);
    if (emulador) console.log(`Usando EMULADORES (Storage en ${emulador}); no es producción.`);
    console.log(o.ejecutar ? 'Modo: EJECUTAR (se suben las imágenes recuperadas)\n' : 'Modo: simulacro (solo lectura)\n');

    const [articulos, productos, existentes] = await Promise.all([
      leerColeccion(
        getFirestore(appCaja),
        `negocios_web_new_version/${o.negocio}/articulos_n_web_new_version`,
        ['nombre', 'imagenUrl', 'subvariaciones'],
      ),
      leerColeccion(getFirestore(appTienda), 'products', ['sourceArticuloId', 'primaryImageUrl', 'variants']),
      listarNombres(bucketCaja, PREFIJO),
    ]);

    const plan = planear({ articulos, productos, existentes, cajaBucket: o.cajaBucket, tiendaBucket: o.tiendaBucket });
    console.log(
      `Artículos: ${articulos.length} | imágenes: ${plan.total} | existen: ${plan.existen} | ` +
        `faltan: ${plan.conCopia.length + plan.sinCopia.length} ` +
        `(con copia en la tienda: ${plan.conCopia.length}, sin copia: ${plan.sinCopia.length})`,
    );
    if (o.limit && plan.conCopia.length > o.limit) {
      console.log(`--limit ${o.limit}: se procesan ${o.limit} de ${plan.conCopia.length}.`);
    }
    console.log('');

    const r = await recuperar(plan, {
      bucketCaja,
      bucketTienda,
      ejecutar: o.ejecutar,
      limit: o.limit,
      muestras: o.muestras,
    });

    console.log('\nResumen');
    if (o.ejecutar) console.log(`  Recuperadas: ${r.recuperadas.length}`);
    else console.log(`  Listas para recuperar: ${r.listas.length} (simulacro: no se subió nada)`);
    if (r.yaExistian.length) console.log(`  Ya existían (no se tocaron): ${r.yaExistian.length}`);
    if (r.fallidas.length) {
      console.log(`  Con error: ${r.fallidas.length}`);
      for (const f of r.fallidas) console.log(`    - ${f.path}: ${f.error}`);
    }
    if (plan.sinCopia.length) {
      console.log(`  Sin copia en la tienda (resubir a mano): ${plan.sinCopia.length}`);
      for (const s of plan.sinCopia) {
        const que = s.cual === 'principal' ? 'imagen principal' : `variación ${s.codigo} "${s.variacion}"`;
        console.log(`    - ${s.articuloId} "${s.articulo}": ${que}`);
      }
    }
    if (o.reporte) {
      await guardarReporte(o.reporte, {
        fecha: new Date().toISOString(),
        modo: o.ejecutar ? 'ejecutar' : 'simulacro',
        opciones: o,
        totales: { imagenes: plan.total, existen: plan.existen, conCopia: plan.conCopia.length, sinCopia: plan.sinCopia.length },
        ...r,
        sinCopia: plan.sinCopia,
      });
      console.log(`\nReporte: ${o.reporte}`);
    }
    return r.fallidas.length > 0 ? 1 : 0;
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
  parsearUrlStorage,
  recolectarImagenes,
  buscarCopiaEnTienda,
  planear,
  prepararImagen,
  recuperar,
  explicarError,
  PREFIJO,
  POR_DEFECTO,
};
