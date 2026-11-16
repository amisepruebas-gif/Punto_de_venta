"use strict";
// ============================================================
// Enlaces de lote: un teléfono sin cuenta entra por una URL
// ============================================================
// `armar`  : lo crea admin. Sin vencimiento: se corta con su apagador.
// `recibir`: lo crea la caja para subir fotos de UN lote. Hay 5 minutos
//            para entrar y la sesión dura 30.
// El enlace es una llave al portador, así que:
//   - del secreto solo se guarda su sha256 (lo compara `llaveCoincide`);
//   - cada enlace admite pocas entradas (armar: 1 teléfono; fotos: 3);
//   - el vencimiento va en el token con la hora del SERVIDOR (`vence`), y
//     las reglas además leen en vivo `activo` y `gen` del doc del enlace:
//     apagarlo o renovarlo corta la sesión aunque el token siga vivo.
//
// Las constantes son espejo de shared/src/enlaceLote.ts (functions es
// CommonJS y no importa `shared`).

const MAX_CANJES = {armar: 1, recibir: 3};
const RECIBIR_VENTANA_MS = 5 * 60 * 1000;
const RECIBIR_DURACION_MS = 30 * 60 * 1000;
/** 2100-01-01: los enlaces de armar no vencen; los corta el apagador. */
const SIN_VENCIMIENTO_MS = 4102444800000;

const RE_SECRETO = /^[A-Za-z0-9_-]{43}$/;
const RE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const RE_LETRA = /^[A-Z]{1,2}$/;

/** Formato de lo que manda el teléfono, antes de leer nada. */
function entradaValida(data) {
  const {negocioId, enlaceId, secreto} = data || {};
  return typeof negocioId === "string" && RE_ID.test(negocioId) &&
    typeof enlaceId === "string" && RE_ID.test(enlaceId) &&
    typeof secreto === "string" && RE_SECRETO.test(secreto);
}

/**
 * ¿Puede entrar otro teléfono con este enlace? Se llama DESPUÉS de
 * comprobar el secreto. `enlace` es el doc más `creadoEnMs`.
 * Devuelve {ok: true, venceMs} o {ok: false, motivo}.
 */
function decidirCanje(enlace, ahoraMs) {
  if (!enlace) return {ok: false, motivo: "no_sirve"};
  if (enlace.tipo !== "armar" && enlace.tipo !== "recibir") {
    return {ok: false, motivo: "no_sirve"};
  }
  if (enlace.activo !== true) return {ok: false, motivo: "apagado"};
  const canjes = Number(enlace.canjes) || 0;
  if (canjes >= MAX_CANJES[enlace.tipo]) return {ok: false, motivo: "agotado"};
  if (enlace.tipo === "armar") {
    if (typeof enlace.letra !== "string" || !RE_LETRA.test(enlace.letra)) {
      return {ok: false, motivo: "no_sirve"};
    }
    return {ok: true, venceMs: SIN_VENCIMIENTO_MS};
  }
  if (typeof enlace.resurtidoId !== "string" || !enlace.resurtidoId ||
      typeof enlace.sucursalId !== "string" || !enlace.sucursalId) {
    return {ok: false, motivo: "no_sirve"};
  }
  const creadoEnMs = Number(enlace.creadoEnMs) || 0;
  // Sin hora de creación (o del futuro) no hay forma de medir los 5 minutos.
  if (!creadoEnMs || creadoEnMs > ahoraMs + 60 * 1000) {
    return {ok: false, motivo: "no_sirve"};
  }
  if (ahoraMs - creadoEnMs > RECIBIR_VENTANA_MS) return {ok: false, motivo: "tarde"};
  return {ok: true, venceMs: ahoraMs + RECIBIR_DURACION_MS};
}

/** Claims de la sesión. Solo lo que las reglas necesitan. */
function claimsDeEnlace(negocioId, enlaceId, enlace, venceMs) {
  const base = {
    role: "enlace",
    negocioId,
    enlaceId,
    tipo: enlace.tipo,
    gen: Number(enlace.gen) || 0,
    vence: venceMs,
  };
  return enlace.tipo === "armar" ?
    {...base, letra: enlace.letra} :
    {...base, resurtidoId: enlace.resurtidoId, sucursalId: enlace.sucursalId};
}

const MENSAJES = {
  // Con el secreto mal (o sin enlace) no se dice nada más.
  no_sirve: "Este enlace no sirve. Pide uno nuevo.",
  apagado: "Este acceso está apagado. Pide al administrador que lo prenda.",
  agotado: "Este enlace ya se usó en otro teléfono. Pide uno nuevo.",
  tarde: "Este código ya venció. Pide otro en la caja.",
  sin_lote: "Ese lote ya no existe.",
};

function mensajeDeMotivo(motivo) {
  return MENSAJES[motivo] || MENSAJES.no_sirve;
}

module.exports = {
  MAX_CANJES,
  RECIBIR_VENTANA_MS,
  RECIBIR_DURACION_MS,
  SIN_VENCIMIENTO_MS,
  entradaValida,
  decidirCanje,
  claimsDeEnlace,
  mensajeDeMotivo,
};
