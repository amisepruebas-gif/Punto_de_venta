'use strict';

/**
 * Ayudas de las pruebas: imágenes sintéticas determinísticas y un bucket falso
 * en memoria. El bucket imita lo importante de Cloud Storage: subir a un path
 * existente REEMPLAZA el objeto completo (la metadata que no se reenvía se
 * pierde) y `ifGenerationMatch` falla con 412 si el objeto cambió.
 */

const sharp = require('sharp');

function mulberry32(semilla) {
  let a = semilla;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * "Foto" sintética: manchas suaves de color + ruido fino de amplitud `ruido`
 * (0 = muy comprimible; 60 = muy pesada). Devuelve píxeles RGB crudos.
 */
async function pixelesSinteticos(ancho, alto, ruido, semilla = 1) {
  const rnd = mulberry32(semilla);
  const w0 = Math.max(2, Math.round(ancho / 60));
  const h0 = Math.max(2, Math.round(alto / 60));
  const chica = Buffer.alloc(w0 * h0 * 3);
  for (let i = 0; i < chica.length; i++) chica[i] = (rnd() * 255) | 0;
  const base = await sharp(chica, { raw: { width: w0, height: h0, channels: 3 } })
    .resize(ancho, alto, { kernel: 'cubic', fit: 'fill' })
    .raw()
    .toBuffer();
  if (ruido > 0) {
    for (let i = 0; i < base.length; i++) {
      const v = base[i] + (rnd() - 0.5) * ruido;
      base[i] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
  }
  return base;
}

async function pngSintetico(ancho, alto, ruido, semilla) {
  const px = await pixelesSinteticos(ancho, alto, ruido, semilla);
  return sharp(px, { raw: { width: ancho, height: alto, channels: 3 } })
    .png({ compressionLevel: 1 })
    .toBuffer();
}

async function webpSintetico(ancho, alto, ruido, { calidad = 95, semilla } = {}) {
  const px = await pixelesSinteticos(ancho, alto, ruido, semilla);
  return sharp(px, { raw: { width: ancho, height: alto, channels: 3 } })
    .webp({ quality: calidad })
    .toBuffer();
}

function errorGcs(code, message) {
  return Object.assign(new Error(message), { code });
}

class ArchivoFalso {
  constructor(bucket, name, generation) {
    this.bucket = bucket;
    this.name = name;
    this.generation = generation;
    this.metadata = {};
  }

  async download() {
    const obj = this.bucket.objetos.get(this.name);
    if (!obj) throw errorGcs(404, `No such object: ${this.name}`);
    if (
      this.generation !== undefined &&
      String(obj.metadata.generation) !== String(this.generation)
    ) {
      throw errorGcs(404, `No such object (generation ${this.generation}): ${this.name}`);
    }
    this.bucket.descargas++;
    const datos = Buffer.from(obj.data);
    if (this.bucket.alDescargar) await this.bucket.alDescargar(this.name);
    return [datos];
  }

  async save(datos, opciones = {}) {
    const obj = this.bucket.objetos.get(this.name);
    const esperada = opciones.preconditionOpts && opciones.preconditionOpts.ifGenerationMatch;
    if (
      esperada !== undefined &&
      (!obj || String(obj.metadata.generation) !== String(esperada))
    ) {
      throw errorGcs(412, 'Precondition Failed');
    }
    this.bucket.escrituras.push({ nombre: this.name, opciones });
    // Reemplazo completo: solo sobrevive lo que viene en la subida.
    const meta = { ...(opciones.metadata || {}) };
    if (opciones.contentType) meta.contentType = opciones.contentType;
    if (this.bucket.descartarMetadataPersonalizada) delete meta.metadata;
    this.bucket.poner(this.name, Buffer.from(datos), meta);
  }

  async getMetadata() {
    const obj = this.bucket.objetos.get(this.name);
    if (!obj) throw errorGcs(404, `No such object: ${this.name}`);
    this.metadata = structuredClone(obj.metadata);
    return [this.metadata];
  }

  async setMetadata(meta) {
    const obj = this.bucket.objetos.get(this.name);
    if (!obj) throw errorGcs(404, `No such object: ${this.name}`);
    if (this.bucket.ignorarSetMetadata) return [{}];
    const { metadata: personalizada, ...resto } = meta;
    Object.assign(obj.metadata, resto);
    if (personalizada) obj.metadata.metadata = { ...obj.metadata.metadata, ...personalizada };
    return [{}];
  }
}

class BucketFalso {
  constructor(name = 'bucket-falso') {
    this.name = name;
    this.objetos = new Map();
    this.siguienteGeneracion = 1000;
    this.escrituras = [];
    this.descargas = 0;
    // Ganchos / modos de falla para las pruebas.
    this.alDescargar = null;
    this.descartarMetadataPersonalizada = false;
    this.ignorarSetMetadata = false;
  }

  /** Crea o reemplaza un objeto con exactamente la metadata dada. */
  poner(name, datos, meta = {}) {
    const generation = String(++this.siguienteGeneracion);
    this.objetos.set(name, {
      data: datos,
      metadata: {
        name,
        bucket: this.name,
        size: String(datos.length),
        generation,
        ...structuredClone(meta),
      },
    });
    return generation;
  }

  file(name, opciones = {}) {
    return new ArchivoFalso(this, name, opciones.generation);
  }

  async getFiles({ prefix = '' } = {}) {
    const archivos = [];
    for (const [name, obj] of this.objetos) {
      if (!name.startsWith(prefix)) continue;
      const archivo = new ArchivoFalso(this, name);
      archivo.metadata = structuredClone(obj.metadata);
      archivos.push(archivo);
    }
    return [archivos];
  }
}

module.exports = { pixelesSinteticos, pngSintetico, webpSintetico, BucketFalso };
