import {
  arrayUnion,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/firebase/config";
import {
  paths,
  generarID,
  ymdMX,
  fechaISOStrict,
  type ChatMensaje,
  type ChatRemitenteTipo,
} from "@shared";

/** Formato del id de doc de día: "YYYYMMDD" sin guiones. */
export function ymdKeyHoy(): string {
  const { y, m, d } = ymdMX();
  return `${y}${m.padStart(2, "0")}${d.padStart(2, "0")}`;
}

/** "YYYYMMDD" para una fecha arbitraria (zona horaria MX). */
export function ymdKeyDe(date: Date): string {
  const { y, m, d } = ymdMX(date);
  return `${y}${m.padStart(2, "0")}${d.padStart(2, "0")}`;
}

/** "YYYYMMDD" del día anterior a `ymd`. */
export function ymdKeyAnterior(ymd: string): string {
  const y = parseInt(ymd.slice(0, 4), 10);
  const m = parseInt(ymd.slice(4, 6), 10);
  const d = parseInt(ymd.slice(6, 8), 10);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - 1);
  return ymdKeyDe(date);
}

export type EnviarMensajeArgs = {
  negocioId: string;
  nodoId: string;
  remitenteId: string;
  remitenteTipo: ChatRemitenteTipo;
  remitenteNombre: string;
  texto: string;
  reply?: {
    huella: string;
    remitenteNombre: string;
    texto?: string;
    imagenUrl?: string;
  };
};

/**
 * Envía un mensaje de texto al chat grupal del nodo. Usa `arrayUnion` sobre
 * el doc del día (`dias/{ymd}`); si el doc no existe, se crea con merge.
 * Actualiza el meta del chat con el snapshot del último mensaje.
 */
export async function enviarMensajeTexto(
  args: EnviarMensajeArgs,
): Promise<ChatMensaje> {
  const ymd = ymdKeyHoy();
  const mensaje: ChatMensaje = {
    huella: generarID(),
    remitenteId: args.remitenteId,
    remitenteTipo: args.remitenteTipo,
    remitenteNombre: args.remitenteNombre,
    fechaISO: fechaISOStrict(),
    texto: args.texto,
    ...(args.reply
      ? {
          replyHuella: args.reply.huella,
          replyRemitenteNombre: args.reply.remitenteNombre,
          ...(args.reply.texto ? { replyTexto: args.reply.texto } : {}),
          ...(args.reply.imagenUrl
            ? { replyImagenUrl: args.reply.imagenUrl }
            : {}),
        }
      : {}),
  };

  const diaRef = doc(db, paths.chatGrupoDia(args.negocioId, args.nodoId, ymd));
  await setDoc(
    diaRef,
    { ymd, mensajes: arrayUnion(mensaje) },
    { merge: true },
  );

  await actualizarUltimoMensajeMeta(args.negocioId, args.nodoId, mensaje);

  return mensaje;
}

/**
 * Sube una imagen a Firebase Storage y manda el mensaje con `mediaUrl`.
 * El texto puede ir vacío (mensaje sólo-imagen).
 */
export async function enviarMensajeImagen(args: EnviarMensajeArgs & {
  archivo: File;
}): Promise<ChatMensaje> {
  const huella = generarID();
  const ext = inferirExtension(args.archivo.name, args.archivo.type);
  const path = `chat_media_web_new_version/${args.negocioId}/${args.nodoId}/${huella}.${ext}`;
  const r = storageRef(storage, path);
  await uploadBytes(r, args.archivo, { contentType: args.archivo.type });
  const url = await getDownloadURL(r);

  const ymd = ymdKeyHoy();
  const mensaje: ChatMensaje = {
    huella,
    remitenteId: args.remitenteId,
    remitenteTipo: args.remitenteTipo,
    remitenteNombre: args.remitenteNombre,
    fechaISO: fechaISOStrict(),
    texto: args.texto,
    mediaUrl: url,
    mediaFileName: args.archivo.name,
    mediaSize: args.archivo.size,
    ...(args.reply
      ? {
          replyHuella: args.reply.huella,
          replyRemitenteNombre: args.reply.remitenteNombre,
          ...(args.reply.texto ? { replyTexto: args.reply.texto } : {}),
          ...(args.reply.imagenUrl
            ? { replyImagenUrl: args.reply.imagenUrl }
            : {}),
        }
      : {}),
  };
  const diaRef = doc(db, paths.chatGrupoDia(args.negocioId, args.nodoId, ymd));
  await setDoc(
    diaRef,
    { ymd, mensajes: arrayUnion(mensaje) },
    { merge: true },
  );
  await actualizarUltimoMensajeMeta(args.negocioId, args.nodoId, mensaje);
  return mensaje;
}

function inferirExtension(filename: string, mime: string): string {
  const m = filename.match(/\.([a-zA-Z0-9]+)$/);
  if (m) return m[1].toLowerCase();
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "bin";
}

async function actualizarUltimoMensajeMeta(
  negocioId: string,
  nodoId: string,
  mensaje: ChatMensaje,
): Promise<void> {
  const metaRef = doc(db, paths.chatGrupoMeta(negocioId, nodoId));
  const preview = mensaje.texto
    ? mensaje.texto.slice(0, 120)
    : mensaje.mediaUrl
      ? "📷 Imagen"
      : "";
  await updateDoc(metaRef, {
    ultimoMensaje: {
      huella: mensaje.huella,
      textoPreview: preview,
      fechaISO: mensaje.fechaISO,
      remitenteId: mensaje.remitenteId,
      remitenteNombre: mensaje.remitenteNombre,
      ...(mensaje.mediaUrl ? { esMedia: true } : {}),
    },
    fechaActividad: serverTimestamp(),
  });
}

/**
 * Marca `ultimaApertura` del miembro al abrir el chat. También guarda
 * `ultimoMensajeLeido` con la huella del último mensaje visible.
 */
export async function marcarApertura(args: {
  negocioId: string;
  nodoId: string;
  memberId: string;
  huellaUltimoMensaje?: string;
}): Promise<void> {
  const metaRef = doc(db, paths.chatGrupoMeta(args.negocioId, args.nodoId));
  const updates: Record<string, unknown> = {
    [`estadoPorMiembro.${args.memberId}.ultimaApertura`]: fechaISOStrict(),
  };
  if (args.huellaUltimoMensaje) {
    updates[`estadoPorMiembro.${args.memberId}.ultimoMensajeLeido`] =
      args.huellaUltimoMensaje;
  }
  await updateDoc(metaRef, updates);
}

/** Marca `ultimoMensajeEntregado` para el miembro. */
export async function marcarEntregado(args: {
  negocioId: string;
  nodoId: string;
  memberId: string;
  huella: string;
}): Promise<void> {
  const metaRef = doc(db, paths.chatGrupoMeta(args.negocioId, args.nodoId));
  await updateDoc(metaRef, {
    [`estadoPorMiembro.${args.memberId}.ultimoMensajeEntregado`]: args.huella,
  });
}

/**
 * Escribe la marca de "estoy escribiendo" del miembro al doc de typing.
 * Cliente debe llamar como máximo cada 3s; otros lectores ignoran entries
 * con `epochMs` antiguo (>6s). Ver doc.
 */
export async function escribirTyping(args: {
  negocioId: string;
  chatId: string;
  memberId: string;
}): Promise<void> {
  const ref = doc(db, paths.chatTyping(args.negocioId, args.chatId));
  await setDoc(
    ref,
    { [args.memberId]: Date.now() },
    { merge: true },
  );
}

/** Lee un día de mensajes (one-shot). Retorna [] si el doc no existe. */
export async function leerMensajesDia(args: {
  negocioId: string;
  nodoId: string;
  ymd: string;
}): Promise<ChatMensaje[]> {
  const ref = doc(
    db,
    paths.chatGrupoDia(args.negocioId, args.nodoId, args.ymd),
  );
  const snap = await getDoc(ref);
  if (!snap.exists()) return [];
  const data = snap.data() as { mensajes?: ChatMensaje[] };
  return Array.isArray(data.mensajes) ? data.mensajes : [];
}
