"use strict";
// ============================================================
// Acceso de cajas (nodos): código de alta y llave de la tablet
// ============================================================
// Antes registrarNodo / rebindNodo / listarNodos eran públicos: cualquiera
// con la URL del POS podía darse de alta como caja (rol "nodo", que abre
// ventas, stock, clientes y lealtad) o adueñarse de una existente y dejar a
// la tablet real sin sesión. Ahora:
//   - Alta o re-vinculación manual: admin con sesión, o un código de un solo
//     uso y vigencia corta que el admin genera en admin-web (Nodos).
//   - Re-auth automático de la tablet: con la llave que recibió al darse de
//     alta. De códigos y llaves solo se guarda su hash.

const crypto = require("crypto");

// Sin 0/O ni 1/I/L: se puede dictar y teclear sin confusiones.
const ALFABETO_CODIGO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const LARGO_CODIGO = 8;
const VIGENCIA_CODIGO_MS = 30 * 60 * 1000;

/** Código aleatorio, sin sesgo de módulo (descarta bytes sobrantes). */
function generarCodigo(randomBytes = crypto.randomBytes) {
  const n = ALFABETO_CODIGO.length;
  const limite = 256 - (256 % n);
  let codigo = "";
  while (codigo.length < LARGO_CODIGO) {
    for (const b of randomBytes(LARGO_CODIGO * 2)) {
      if (b < limite) codigo += ALFABETO_CODIGO[b % n];
      if (codigo.length === LARGO_CODIGO) break;
    }
  }
  return codigo;
}

/** "ABCD2345" → "ABCD-2345" (para mostrarlo). */
function formatearCodigo(codigo) {
  return `${codigo.slice(0, 4)}-${codigo.slice(4)}`;
}

/** Lo que teclea el usuario → código canónico, o null si no puede serlo. */
function normalizarCodigo(entrada) {
  if (typeof entrada !== "string") return null;
  const codigo = entrada.toUpperCase().replace(/[\s-]/g, "");
  if (codigo.length !== LARGO_CODIGO) return null;
  for (const ch of codigo) {
    if (!ALFABETO_CODIGO.includes(ch)) return null;
  }
  return codigo;
}

/** sha256 en hex: lo único que se guarda de códigos y llaves. */
function hashSecreto(secreto) {
  return crypto.createHash("sha256").update(String(secreto)).digest("hex");
}

/** Llave de re-auth de la tablet: 256 bits aleatorios. */
function generarLlave() {
  return crypto.randomBytes(32).toString("base64url");
}

/** Compara en tiempo constante la llave recibida con el hash guardado. */
function llaveCoincide(llave, hashGuardado) {
  if (typeof llave !== "string" || !llave ||
      typeof hashGuardado !== "string") {
    return false;
  }
  const a = Buffer.from(hashSecreto(llave), "hex");
  const b = Buffer.from(hashGuardado, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Estado de un código guardado ({usado, expiraEnMs} o null):
 * "valido" | "usado" | "vencido" | "inexistente".
 */
function estadoCodigo(doc, ahoraMs) {
  if (!doc) return "inexistente";
  if (doc.usado) return "usado";
  if (!(doc.expiraEnMs > ahoraMs)) return "vencido";
  return "valido";
}

module.exports = {
  ALFABETO_CODIGO,
  LARGO_CODIGO,
  VIGENCIA_CODIGO_MS,
  generarCodigo,
  formatearCodigo,
  normalizarCodigo,
  hashSecreto,
  generarLlave,
  llaveCoincide,
  estadoCodigo,
};
