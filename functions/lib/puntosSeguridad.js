"use strict";
// ============================================================
// Lealtad: identidad del cliente y datos que salen hacia la caja
// ============================================================
// Reglas del dueño (oct 2026; la tarjeta es OPCIONAL desde el 2026-11-02):
//   - el cashback y el crédito de regalo se usan con la tarjeta, o con
//     teléfono + correo (la tarjeta es decorativa y útil, no obligatoria);
//   - activar, reponer o desbloquear una tarjeta y recuperar la contraseña
//     piden el correo completo del cliente (para recuperar también sirve la
//     tarjeta).
// Todo se comprueba contra amise con /balance: la tarjeta o el correo deben
// resolver al MISMO monedero que el teléfono.
//
// EXIGIR_IDENTIDAD = false es el modo observar: se registra lo que se
// rechazaría y se sigue como antes, para que una caja sin actualizar o un
// detalle de los datos reales de amise no detengan cobros. En true se rechaza
// antes de mover dinero, y la consulta por teléfono deja de entregar el código
// completo de la tarjeta.

const EXIGIR_IDENTIDAD = false;

// Motivos de un dato que FALTA (no contradictorio). Tras cobrar una tarjeta
// estos no bloquean su vínculo: ya se pagó (cajas viejas o ítems en cola).
const FALTANTES = ["sin_dato", "sin_telefono"];

const digitos = (s) => String(s == null ? "" : s).replace(/\D/g, "");

/** Mismo teléfono: compara los últimos 10 dígitos (E.164 o local). */
function telefonosIguales(a, b) {
  const x = digitos(a);
  const y = digitos(b);
  return x.length >= 10 && y.length >= 10 && x.slice(-10) === y.slice(-10);
}

/** EAN-13 de 13 dígitos con dígito verificador correcto. */
function esEan13(codigo) {
  const s = String(codigo == null ? "" : codigo);
  if (!/^\d{13}$/.test(s)) return false;
  const suma = s.slice(0, 12).split("")
      .reduce((a, n, i) => a + Number(n) * (i % 2 ? 3 : 1), 0);
  return (10 - (suma % 10)) % 10 === Number(s[12]);
}

const ultimos4 = (codigo) => digitos(codigo).slice(-4);

/** "juan@gmail.com" → "ju•••@gmail.com". Un correo ya oculto queda igual. */
function enmascararCorreo(correo) {
  const s = String(correo == null ? "" : correo).trim();
  if (!s || s.includes("•••")) return s;
  const at = s.indexOf("@");
  if (at < 1) return "•••";
  return `${s.slice(0, Math.min(2, at))}•••${s.slice(at)}`;
}

/**
 * Respuesta de /balance tal como la recibe la caja: solo los campos que usa
 * (sin correo, nombre ni ids internos). Con `exigir`, una consulta que no fue
 * por la tarjeta recibe solo sus últimos 4 dígitos.
 */
function filtrarSaldo(resp, {porCodigo = false, exigir = EXIGIR_IDENTIDAD} = {}) {
  if (!resp || !resp.exists) return {exists: false};
  const t = resp.tarjeta;
  return {
    exists: true,
    saldoDinero: Number(resp.saldoDinero) || 0,
    saldoUsable: Number(resp.saldoUsable) || 0,
    valorPorPeso: Number(resp.valorPorPeso) || 0,
    telefono: resp.telefono || "",
    tarjeta: t && t.codigo ? {
      codigo: exigir && !porCodigo ? ultimos4(t.codigo) : String(t.codigo),
      estado: t.estado,
    } : null,
  };
}

/**
 * ¿La tarjeta (o, sin tarjeta, el correo) es del monedero de ese teléfono?
 * `consultar(payload)` llama a /balance; solo se llama si hay algo que
 * comprobar. Devuelve {ok, motivo}: ok_tarjeta | ok_correo | sin_telefono |
 * sin_dato | codigo_invalido | tarjeta_no_encontrada | correo_no_encontrado |
 * no_coincide.
 */
async function verificarIdentidad({phone, codigo, email}, consultar) {
  if (digitos(phone).length < 10) return {ok: false, motivo: "sin_telefono"};
  if (codigo) {
    if (!esEan13(codigo)) return {ok: false, motivo: "codigo_invalido"};
    const r = await consultar({codigo: String(codigo)});
    if (!r || !r.exists) return {ok: false, motivo: "tarjeta_no_encontrada"};
    return telefonosIguales(r.telefono, phone) ?
      {ok: true, motivo: "ok_tarjeta"} :
      {ok: false, motivo: "no_coincide"};
  }
  if (email && String(email).trim()) {
    const r = await consultar({email: String(email).trim()});
    if (!r || !r.exists) return {ok: false, motivo: "correo_no_encontrado"};
    return telefonosIguales(r.telefono, phone) ?
      {ok: true, motivo: "ok_correo"} :
      {ok: false, motivo: "no_coincide"};
  }
  return {ok: false, motivo: "sin_dato"};
}

/**
 * ¿Se rechaza la operación? En modo observar nunca. Al exigir, todo lo que no
 * sea ok, salvo un dato faltante cuando `faltanteOk` (vínculo de una tarjeta ya
 * cobrada).
 */
function rechazar(v, {exigir = EXIGIR_IDENTIDAD, faltanteOk = false} = {}) {
  if (v.ok || !exigir) return false;
  return !(faltanteOk && FALTANTES.includes(v.motivo));
}

module.exports = {
  EXIGIR_IDENTIDAD,
  telefonosIguales,
  esEan13,
  ultimos4,
  enmascararCorreo,
  filtrarSaldo,
  verificarIdentidad,
  rechazar,
};
