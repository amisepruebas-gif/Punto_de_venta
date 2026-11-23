"use strict";
// ============================================================
// Cashback de mayoreo — lógica pura del servidor
// ============================================================
// Copia a mano de shared/src/cashbackMayoreo.ts (vencimiento, ganancia, QR,
// PIN trivial): si cambias una, cambia la otra. Aquí además: hash del PIN,
// generación de PIN/QR/sesión y la política de bloqueos por intentos.
// Tests: functions/test/cashbackMayoreo.test.js.

const crypto = require("crypto");

const ALFABETO_QR = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const PREFIJO_QR = "CBM";
const LARGO_QR = 22;
const RE_QR = new RegExp(`^${PREFIJO_QR}[${ALFABETO_QR}]{${LARGO_QR}}$`);
const OFFSET_MX_MS = 6 * 60 * 60 * 1000;
const SESION_MS = 2 * 60 * 60 * 1000;

// ---------- Teléfono ----------

/** Últimos 10 dígitos, o null. */
function normalizarTelefono(s) {
  const d = String(s ?? "").replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : null;
}

// ---------- Dinero y vencimiento ----------

function ganadoCentavos(montoPesos, pct) {
  const centavos = Math.round((Number(montoPesos) || 0) * 100);
  const pctCent = Math.round((Number(pct) || 0) * 100);
  if (centavos <= 0 || pctCent <= 0) return 0;
  return Math.floor((centavos * pctCent) / 10000);
}

function inicioAnioSiguienteMX(ms) {
  const local = new Date(ms - OFFSET_MX_MS);
  return Date.UTC(local.getUTCFullYear() + 1, 0, 1) + OFFSET_MX_MS;
}

function sumarVigencia(ms, v) {
  const n = Math.max(0, Math.floor(Number(v && v.cantidad) || 0));
  if (v && v.unidad === "dias") return ms + n * 86400000;
  const local = new Date(ms - OFFSET_MX_MS);
  const dia = local.getUTCDate();
  const meses = v && v.unidad === "anios" ? n * 12 : n;
  local.setUTCDate(1);
  local.setUTCMonth(local.getUTCMonth() + meses);
  const ultimo = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 0)).getUTCDate();
  local.setUTCDate(Math.min(dia, ultimo));
  return local.getTime() + OFFSET_MX_MS;
}

function calcularVence(compraMs, v) {
  return Math.min(sumarVigencia(compraMs, v), inicioAnioSiguienteMX(compraMs));
}

/** Saldo usable ahora (0 si ya venció). */
function saldoVigente(cuenta, ahoraMs) {
  if (!cuenta) return 0;
  if (cuenta.venceISO && ahoraMs >= Date.parse(cuenta.venceISO)) return 0;
  return Math.max(0, Math.floor(cuenta.saldoCentavos || 0));
}

/** true si la cuenta tiene saldo que ya venció (hay que dejarlo en 0). */
function vencioConSaldo(cuenta, ahoraMs) {
  return !!cuenta && (cuenta.saldoCentavos || 0) > 0 && !!cuenta.venceISO &&
    ahoraMs >= Date.parse(cuenta.venceISO);
}

/** Config válida → null; si no, mensaje. */
function validarConfig(c) {
  const pct = Number(c && c.pct);
  if (!Number.isFinite(pct) || pct <= 0 || pct > 50) return "Porcentaje inválido";
  const n = Number(c.vigencia && c.vigencia.cantidad);
  if (!Number.isInteger(n) || n < 1) return "Vigencia inválida";
  if (!["dias", "meses", "anios"].includes(c.vigencia.unidad)) return "Unidad de vigencia inválida";
  return null;
}

// ---------- PIN ----------

function pinTrivial(pin, telefono) {
  if (!/^\d{4}$/.test(String(pin))) return true;
  const d = String(pin).split("").map(Number);
  if (d.every((x) => x === d[0])) return true;
  const sube = d.every((x, i) => i === 0 || x === d[i - 1] + 1);
  const baja = d.every((x, i) => i === 0 || x === d[i - 1] - 1);
  if (sube || baja) return true;
  if (/^(19|20)\d\d$/.test(String(pin))) return true;
  if (telefono && String(telefono).slice(-4) === String(pin)) return true;
  return false;
}

/** PIN de 4 dígitos al azar que no sea trivial. */
function generarPin(telefono, randomInt = crypto.randomInt) {
  for (;;) {
    const pin = String(randomInt(0, 10000)).padStart(4, "0");
    if (!pinTrivial(pin, telefono)) return pin;
  }
}

function generarSal() {
  return crypto.randomBytes(16).toString("hex");
}

/** HMAC-SHA256(pepper, sal:pin). El pepper es un secreto de las functions:
 *  con 10,000 PINs posibles, sin él un respaldo filtrado se rompe al instante. */
function hashPin(pepper, sal, pin) {
  return crypto.createHmac("sha256", String(pepper)).update(`${sal}:${pin}`).digest("hex");
}

/** Comparación en tiempo constante. */
function pinCoincide(pepper, sal, pin, hashGuardado) {
  if (!sal || !hashGuardado || !/^\d{4}$/.test(String(pin))) return false;
  const a = Buffer.from(hashPin(pepper, sal, pin), "hex");
  const b = Buffer.from(String(hashGuardado), "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---------- QR y sesión ----------

/** "CBM" + 22 caracteres al azar (sin sesgo de módulo). */
function generarTokenQr(randomBytes = crypto.randomBytes) {
  const n = ALFABETO_QR.length;
  const limite = 256 - (256 % n);
  let t = "";
  while (t.length < LARGO_QR) {
    for (const b of randomBytes(LARGO_QR * 2)) {
      if (b < limite) t += ALFABETO_QR[b % n];
      if (t.length === LARGO_QR) break;
    }
  }
  return PREFIJO_QR + t;
}

function leerQr(texto) {
  const t = String(texto ?? "").trim().toUpperCase();
  return RE_QR.test(t) ? t : null;
}

/** Token de sesión de la página (opaco, 256 bits) y su hash para guardarlo. */
function generarSesion() {
  return crypto.randomBytes(32).toString("base64url");
}

function hashSesion(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

// ---------- Bloqueos por intentos ----------
// Por teléfono (exista o no la cuenta): cada 5 fallos seguidos, un bloqueo
// creciente (15 min → 1 h → 24 h). Un acierto lo reinicia.
// Por IP: máximo 30 fallos por hora.

const BLOQUEOS_MS = [15 * 60 * 1000, 60 * 60 * 1000, 24 * 60 * 60 * 1000];
const FALLOS_POR_BLOQUEO = 5;
const FALLOS_IP_HORA = 30;

/** ¿Está bloqueado ahora? `doc` = { fallos, nivel, bloqueadoHastaMs }. */
function bloqueado(doc, ahoraMs) {
  return !!doc && (doc.bloqueadoHastaMs || 0) > ahoraMs;
}

/** Nuevo estado tras un fallo. */
function trasFallo(doc, ahoraMs) {
  const fallos = ((doc && doc.fallos) || 0) + 1;
  let nivel = (doc && doc.nivel) || 0;
  let bloqueadoHastaMs = (doc && doc.bloqueadoHastaMs) || 0;
  if (fallos % FALLOS_POR_BLOQUEO === 0) {
    bloqueadoHastaMs = ahoraMs + BLOQUEOS_MS[Math.min(nivel, BLOQUEOS_MS.length - 1)];
    nivel += 1;
  }
  return { fallos, nivel, bloqueadoHastaMs, ultimoFalloMs: ahoraMs };
}

/** Fallos por IP en una ventana de 1 h: { ventanaMs, fallos }. */
function ipBloqueada(doc, ahoraMs) {
  return !!doc && ahoraMs - (doc.ventanaMs || 0) < 3600000 && (doc.fallos || 0) >= FALLOS_IP_HORA;
}

function ipTrasFallo(doc, ahoraMs) {
  if (!doc || ahoraMs - (doc.ventanaMs || 0) >= 3600000) return { ventanaMs: ahoraMs, fallos: 1 };
  return { ventanaMs: doc.ventanaMs, fallos: (doc.fallos || 0) + 1 };
}

module.exports = {
  ALFABETO_QR,
  PREFIJO_QR,
  LARGO_QR,
  SESION_MS,
  FALLOS_POR_BLOQUEO,
  BLOQUEOS_MS,
  FALLOS_IP_HORA,
  normalizarTelefono,
  ganadoCentavos,
  inicioAnioSiguienteMX,
  sumarVigencia,
  calcularVence,
  saldoVigente,
  vencioConSaldo,
  validarConfig,
  pinTrivial,
  generarPin,
  generarSal,
  hashPin,
  pinCoincide,
  generarTokenQr,
  leerQr,
  generarSesion,
  hashSesion,
  bloqueado,
  trasFallo,
  ipBloqueada,
  ipTrasFallo,
};
