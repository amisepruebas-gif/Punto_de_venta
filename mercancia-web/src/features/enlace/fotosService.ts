// ============================================================
// Fotos de un lote desde el teléfono (enlace de fotos, QR de la caja)
// ============================================================
//
// Reglas (storage.rules `lotes_media_web_new_version` y el bloque de fotos
// en firestore.rules): cada archivo se llama `{uid}_{00..29}.webp|jpg`, no
// se reemplaza, pesa menos de 2 MB y es WebP o JPEG; luego se registra en
// el lote con los campos exactos `ruta, subidoPor, creadoEn, nota?`. El
// teléfono no puede leer ni listar fotos: solo ve las que subió aquí.

import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";
import { ENLACE_FOTOS_MAX, idFotoLote, paths } from "@shared";
import {
  ErrorEnlace,
  MENSAJE_APAGADO,
  esPermisoDenegado,
  exigirInternet,
  tiempoRestanteMs,
  type SesionEnlace,
} from "@/firebase/enlaceApp";

const LADO_MAX = 1600;
const BYTES_MAX = 2 * 1024 * 1024;
export const NOTA_MAX = 300;

export type FotoPreparada = {
  blob: Blob;
  ext: "webp" | "jpg";
  contentType: "image/webp" | "image/jpeg";
};

type Fuente = { ancho: number; alto: number; dibujar: (ctx: CanvasRenderingContext2D, w: number, h: number) => void; cerrar: () => void };

/** Decodifica la foto. `createImageBitmap` respeta la orientación de la
 *  cámara; si el navegador no lo tiene (o falla), se usa un `<img>`. */
async function decodificar(file: Blob): Promise<Fuente> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file);
      return {
        ancho: bmp.width,
        alto: bmp.height,
        dibujar: (ctx, w, h) => ctx.drawImage(bmp, 0, 0, w, h),
        cerrar: () => bmp.close?.(),
      };
    } catch {
      /* se intenta con <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new ErrorEnlace("No se pudo abrir la foto. Toma otra."));
      i.src = url;
    });
    return {
      ancho: img.naturalWidth,
      alto: img.naturalHeight,
      dibujar: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
      cerrar: () => URL.revokeObjectURL(url),
    };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

function aBlob(canvas: HTMLCanvasElement, tipo: string, calidad: number): Promise<Blob | null> {
  return new Promise((res) => canvas.toBlob((b) => res(b), tipo, calidad));
}

/**
 * Reduce la foto a 1600 px por lado como máximo y la guarda en WebP. Si el
 * navegador no sabe hacer WebP (iPhone devuelve PNG en su lugar), usa JPEG.
 * Baja la calidad hasta que pese menos de 2 MB.
 */
export async function prepararFoto(file: Blob): Promise<FotoPreparada> {
  if (file.type && !file.type.startsWith("image/")) {
    throw new ErrorEnlace("Eso no es una foto.");
  }
  const fuente = await decodificar(file);
  // Si el navegador no sabe hacer WebP no se le vuelve a pedir (en iPhone
  // cada intento fallido saca un PNG enorme, que tarda).
  let sinWebp = false;
  try {
    let lado = LADO_MAX;
    for (let intento = 0; intento < 8; intento++) {
      const escala = Math.min(1, lado / Math.max(fuente.ancho, fuente.alto));
      const w = Math.max(1, Math.round(fuente.ancho * escala));
      const h = Math.max(1, Math.round(fuente.alto * escala));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new ErrorEnlace("Este navegador no puede preparar la foto.");
      fuente.dibujar(ctx, w, h);
      for (const calidad of [0.82, 0.7, 0.55]) {
        if (!sinWebp) {
          const webp = await aBlob(canvas, "image/webp", calidad);
          if (webp?.type !== "image/webp") sinWebp = true;
          else if (webp.size < BYTES_MAX) {
            return { blob: webp, ext: "webp", contentType: "image/webp" };
          }
        }
        const jpg = await aBlob(canvas, "image/jpeg", calidad);
        if (jpg && jpg.type === "image/jpeg" && jpg.size < BYTES_MAX) {
          return { blob: jpg, ext: "jpg", contentType: "image/jpeg" };
        }
      }
      lado = Math.round(lado * 0.75);
    }
    throw new ErrorEnlace("La foto pesa demasiado. Toma otra.");
  } finally {
    fuente.cerrar();
  }
}

// ---------- Número de la siguiente foto ----------

const claveContador = (s: SesionEnlace) => `enlace.fotos.siguiente.v1:${s.uid}`;

function leerContador(s: SesionEnlace): number {
  try {
    const n = Number(sessionStorage.getItem(claveContador(s)));
    return Number.isInteger(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

function guardarContador(s: SesionEnlace, n: number) {
  try {
    sessionStorage.setItem(claveContador(s), String(n));
  } catch {
    /* sin almacenamiento: el siguiente intento prueba desde 0 y salta */
  }
}

/** Fotos que todavía se pueden subir en esta sesión. */
export function fotosRestantes(s: SesionEnlace): number {
  return Math.max(0, ENLACE_FOTOS_MAX - leerContador(s));
}

/**
 * Sube la foto y la registra en el lote. El nombre del archivo es el número
 * de foto (`{uid}_07`): si Storage lo rechaza porque ya existe (se subió y
 * se cortó antes de anotarlo), se prueba el siguiente, hasta 30.
 */
export async function subirFotoLote(
  s: SesionEnlace,
  foto: FotoPreparada,
  notaCruda?: string,
): Promise<{ fotoId: string; ruta: string }> {
  const rid = s.resurtidoId;
  if (!rid) throw new ErrorEnlace("Este acceso no es para subir fotos.");
  if (tiempoRestanteMs(s) <= 0) throw new ErrorEnlace("Se acabó el tiempo. Pide otro código en la caja.");
  const nota = notaCruda?.trim() ?? "";
  if (nota.length > NOTA_MAX) throw new ErrorEnlace(`La nota es muy larga (máximo ${NOTA_MAX} letras).`);
  exigirInternet();

  let rechazos = 0;
  for (let n = leerContador(s); n < ENLACE_FOTOS_MAX; n++) {
    const fotoId = idFotoLote(s.uid, n);
    const ruta = paths.storageLoteFoto(s.negocioId, rid, fotoId, foto.ext);
    try {
      await uploadBytes(ref(s.storage, ruta), foto.blob, { contentType: foto.contentType });
    } catch (e) {
      // "Sin permiso" aquí casi siempre es "ese número ya existe" (se subió
      // y se cortó antes de anotarlo): se prueba el que sigue. Pero si se
      // rechazan varios seguidos ya no es eso (sesión vencida…): se para,
      // para no gastar datos subiendo la misma foto 30 veces.
      if (!esPermisoDenegado(e)) throw e;
      if (tiempoRestanteMs(s) <= 0) {
        throw new ErrorEnlace("Se acabó el tiempo. Pide otro código en la caja.");
      }
      if (++rechazos >= 3) {
        throw new ErrorEnlace("No se pudo subir la foto: este código ya no sirve. Pide otro en la caja.");
      }
      continue;
    }
    // El contador solo avanza con una foto subida: un rechazo por otra causa
    // no gasta números.
    guardarContador(s, n + 1);
    try {
      await setDoc(doc(s.db, paths.loteFoto(s.negocioId, rid, fotoId)), {
        ruta,
        subidoPor: s.uid,
        creadoEn: serverTimestamp(),
        ...(nota ? { nota } : {}),
      });
    } catch (e) {
      // Storage no revisa el apagador; Firestore sí: la foto quedó suelta.
      if (esPermisoDenegado(e)) throw new ErrorEnlace(MENSAJE_APAGADO);
      throw e;
    }
    return { fotoId, ruta };
  }
  throw new ErrorEnlace(`Ya subiste ${ENLACE_FOTOS_MAX} fotos: es el máximo por teléfono.`);
}
