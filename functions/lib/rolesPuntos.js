"use strict";
// ============================================================
// Acceso a las funciones de lealtad (puntos, tarjeta de cliente, tarjeta de
// regalo y candado de canje)
// ============================================================
// Antes el chequeo era "best-effort": sin sesión se dejaba pasar, así que
// cualquiera con la URL de la function podía acreditar puntos o emitir
// crédito de regalo. El secreto LOYALTY_POS_SECRET solo autentica a la
// function ante amise.mx, no a quien la llama. Ahora se exige sesión con un
// rol permitido: el POS (nodo-web) siempre llama con la sesión de su caja
// (rol "nodo", custom token de registrarNodo / rebindNodo).

const {HttpsError} = require("firebase-functions/v2/https");

const ROLES_PUNTOS = ["nodo", "vendedor", "admin", "superadmin"];

/**
 * Claims de quien llama. Lanza `unauthenticated` sin sesión y
 * `permission-denied` si su rol no está en ROLES_PUNTOS.
 */
function requireRolPuntos(auth) {
  if (!auth || !auth.token) {
    throw new HttpsError("unauthenticated", "Se requiere la sesión de la caja");
  }
  if (!ROLES_PUNTOS.includes(auth.token.role)) {
    throw new HttpsError("permission-denied", "Sin permiso");
  }
  return auth.token;
}

module.exports = {ROLES_PUNTOS, requireRolPuntos};
