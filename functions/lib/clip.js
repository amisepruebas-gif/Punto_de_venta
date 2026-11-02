"use strict";
// ============================================================
// Clip — cobro con tarjeta en la terminal (API de PinPad)
// ============================================================
// Funciones puras (sin red ni Firestore) para que la caja cobre en una
// terminal Clip a través del servidor. Documentación: developer.clip.mx →
// API de PinPad. Lo que importa aquí:
// - Solo existe producción: no hay ambiente de pruebas.
// - El monto va como texto con dos decimales ("199.50").
// - La referencia admite hasta 100 caracteres: letras, números y guiones
//   medios (lo confirmó soporte de Clip, nov-2026).
// - El aviso (webhook) trae solo {id, origin, event_type}, sin firma, y se
//   manda una sola vez: solo dispara una consulta; la consulta es la que manda.
// - ERR10_04: terminal apagada, app PinPad cerrada u otro cobro en curso.
//   Es también el último candado contra un cobro doble en la misma terminal.

const {HttpsError} = require("firebase-functions/v2/https");

/** Estados del cobro guardado en `pagos_clip_web_new_version`. "manual": el
 *  cajero confirmó en la terminal un intento incierto (no se pudo verificar). */
const ESTADOS_FINALES = ["aprobado", "fallido", "cancelado", "revisar", "manual"];

// Estados de la intención en Clip. La documentación trae de ejemplo
// COMPLETED, PENDING y FAILED; soporte de Clip (nov-2026) dio APPROVED,
// REJECTED, CANCELED y TIMEOUT_CANCELED. Se aceptan los dos juegos. Cualquier
// otro (PENDING, IN_PROCESS o uno nuevo) se toma como "aún no".
const CLIP_PAGADO = ["COMPLETED", "APPROVED"];
const CLIP_SIN_PAGO = ["FAILED", "CANCELED", "CANCELLED", "TIMEOUT_CANCELED",
  "TIMEOUT_CANCELLED", "EXPIRED", "REJECTED", "DECLINED", "ERROR"];

// Un candado de terminal ajeno se ignora pasado este tiempo: Clip mismo
// rechaza (ERR10_04) un segundo cobro si la terminal sigue ocupada.
const CANDADO_VENCE_MS = 10 * 60_000;
// Un envío que no terminó en este tiempo (la function murió a media llamada)
// se trata como incierto: no se sabe si llegó a la terminal.
const ENVIANDO_VENCE_MS = 60_000;

// Cambios de estado permitidos. Los finales no se mueven, salvo un aprobado
// que se vuelve a confirmar. "incierto" → "pendiente" es cuando el aviso de
// Clip revela el id de un envío cuya respuesta se perdió. El dinero que llega
// tarde a un intento cerrado no pasa por aquí: ver decidirPagoTardio.
const TRANSICIONES = {
  enviando: ["enviando", "pendiente", "incierto", "fallido", "cancelado", "manual"],
  pendiente: ["pendiente", "aprobado", "fallido", "cancelado", "revisar"],
  incierto: ["incierto", "pendiente", "cancelado", "manual"],
  aprobado: ["aprobado"],
  fallido: [],
  cancelado: [],
  revisar: [],
  manual: [],
};

/** ¿Puede el cobro pasar de `de` a `a`? */
function transicionValida(de, a) {
  return (TRANSICIONES[de] || []).includes(a);
}

/** 199.5 | "199.5" → "199.50". Lanza invalid-argument si no es un monto válido. */
function montoClip(monto) {
  const n = Number(monto);
  if (!Number.isFinite(n) || n <= 0 || n > 1000000) {
    throw new HttpsError("invalid-argument", "Monto inválido");
  }
  const c = Math.round(n * 100);
  if (Math.abs(n * 100 - c) > 1e-6) {
    throw new HttpsError("invalid-argument", "El monto tiene más de dos decimales");
  }
  return (c / 100).toFixed(2);
}

/** "199.50" | 199.5 → 19950. Lo que no es número cuenta como 0. */
function centavos(x) {
  const n = Number(x);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** Encabezado Authorization: Basic base64(API_KEY:SECRET). */
function basicAuth(key, secret) {
  return "Basic " + Buffer.from(`${key}:${secret}`).toString("base64");
}

/** Referencia para Clip: liga cada intento con su venta (cobroId = ventaId).
 *  Con un cobroId válido queda muy por debajo de los 100 caracteres de Clip. */
function referencia(cobroId, intento) {
  return `${cobroId}-${intento}`;
}

/** "abc123-2" → {cobroId: "abc123", intento: 2}; null si no es nuestra. */
function leerReferencia(ref) {
  const m = /^([A-Za-z0-9-]{6,64})-(\d{1,3})$/.exec(String(ref || ""));
  return m ? {cobroId: m[1], intento: Number(m[2])} : null;
}

/** El cobroId es el idempotencyKey de la venta. Sin guion bajo ni otros
 *  signos: Clip solo admite letras, números y guiones en la referencia. */
function cobroIdValido(id) {
  return typeof id === "string" && /^[A-Za-z0-9-]{6,64}$/.test(id);
}

/** Número de serie de la terminal, como lo guarda admin. */
function serieValida(s) {
  return typeof s === "string" && /^[A-Za-z0-9_-]{4,40}$/.test(s);
}

/**
 * Claims de quien cobra: solo la sesión de una caja (rol nodo con negocio,
 * sucursal y nodo). Vendedor y admin no traen nodo: no pueden cobrar aquí.
 */
function claimsCaja(auth) {
  if (!auth || !auth.token) {
    throw new HttpsError("unauthenticated", "Se requiere la sesión de la caja");
  }
  const {role, negocioId, sucursalId, nodoId} = auth.token;
  if (role !== "nodo" || !negocioId || !sucursalId || !nodoId) {
    throw new HttpsError("permission-denied",
        "Solo una caja registrada puede cobrar con la terminal");
  }
  return {negocioId, sucursalId, nodoId};
}

/**
 * Cuerpo del POST /payment. Decisiones del negocio: sin propina, sin meses,
 * sin dividir el pago ni convertir moneda; el cliente sí puede reintentar
 * con otra tarjeta, y la terminal imprime su comprobante.
 */
function cuerpoCobro({monto, referencia: ref, serial, webhookUrl}) {
  return {
    amount: montoClip(monto),
    reference: ref,
    serial_number_pos: serial,
    webhook_url: webhookUrl,
    preferences: {
      is_auto_return_enabled: true,
      is_tip_enabled: false,
      is_msi_enabled: false,
      is_mci_enabled: false,
      is_dcc_enabled: false,
      is_retry_enabled: true,
      is_share_enabled: false,
      is_auto_print_receipt_enabled: true,
      is_split_payment_enabled: false,
    },
  };
}

const texto = (v) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v));

/** Datos de la tarjeta de un resultado aprobado (solo lo que no es sensible). */
function tarjetaDe(r) {
  const pm = (r && r.payment_method) || {};
  const card = pm.card || {};
  const t = {
    marca: texto(pm.id),
    tipo: texto(pm.type),
    ultimos4: texto(card.last_digits).slice(-4),
    banco: texto(card.issuer),
    transaccionId: texto(r && r.transaction_id),
    aprobadoEn: texto(r && r.approved_at),
  };
  for (const k of Object.keys(t)) if (!t[k]) delete t[k];
  return t;
}

/**
 * Lee la respuesta de GET /payment (con detalle) y dice en qué quedó.
 * - aprobado: COMPLETED o APPROVED, y lo pagado ≥ lo esperado. Si pagaron de
 *   más o hubo dos aprobaciones, se marca una alerta para revisarlo a mano.
 * - revisar: hubo dinero pero no cuadra (pagaron de menos, o una intención
 *   cerrada trae un pago). No se crea la venta sola.
 * - fallido / cancelado: cerrada sin pago. TIMEOUT_CANCELED (la terminal lo
 *   canceló por tiempo) cuenta como cancelado.
 * - pendiente: aún no (PENDING, IN_PROCESS o un estado que no conocemos).
 */
function evaluarIntentoClip(resp, esperadoCentavos) {
  const status = texto(resp && resp.status).toUpperCase();
  const results = resp && resp.detail && Array.isArray(resp.detail.results) ?
    resp.detail.results : [];
  const aprobados = results.filter((r) => texto(r && r.status).toLowerCase() === "approved");
  const pagadoEnResultados = aprobados
      .reduce((s, r) => s + centavos(r.paid_amount != null ? r.paid_amount : r.amount), 0);
  const pagado = resp && resp.amount_paid != null ?
    Math.max(centavos(resp.amount_paid), pagadoEnResultados) : pagadoEnResultados;
  const ultimo = aprobados[aprobados.length - 1];
  const tarjeta = ultimo ? tarjetaDe(ultimo) : null;

  if (CLIP_PAGADO.includes(status)) {
    if (pagado <= 0) {
      return {estado: "revisar", pagadoCentavos: 0, alerta: "completado-sin-pago", tarjeta};
    }
    if (pagado < esperadoCentavos) {
      return {estado: "revisar", pagadoCentavos: pagado, alerta: "pago-de-menos", tarjeta};
    }
    const alerta = pagado > esperadoCentavos ? "pago-de-mas" :
      aprobados.length > 1 ? "varias-aprobaciones" : null;
    return {estado: "aprobado", pagadoCentavos: pagado, alerta, tarjeta};
  }
  if (CLIP_SIN_PAGO.includes(status)) {
    if (pagado > 0 || aprobados.length > 0) {
      return {estado: "revisar", pagadoCentavos: pagado, alerta: "pago-en-intento-cerrado", tarjeta};
    }
    return {
      estado: status.includes("CANCEL") ? "cancelado" : "fallido",
      pagadoCentavos: 0, alerta: null, tarjeta: null,
    };
  }
  return {estado: "pendiente", pagadoCentavos: pagado, alerta: null, tarjeta: null};
}

/**
 * Qué hacer cuando la caja pide cobrar (dentro de la transacción).
 * - "ya-aprobado" / "revisar": nunca se vuelve a cobrar.
 * - "devolver": ya hay un intento abierto con el mismo monto (dos toques o
 *   reintento mientras espera): se regresa el mismo, sin otro cobro.
 * - "nuevo": no hay cobro, o el último terminó sin pago.
 * - "limpiar-y-nuevo": el último quedó incierto y el cajero ya revisó la
 *   terminal: se cancela lo que haya en ella antes del intento nuevo.
 * - "error": otro monto con un intento abierto, o la terminal tiene el
 *   cobro vigente de otra venta.
 */
function decidirCobro({cobro, candado, cobroDelCandado, cobroPath, montoCentavos, ahora,
  reintentarIncierto}) {
  const conCandado = (d) => {
    const ajeno = candado && candado.cobroPath && candado.cobroPath !== cobroPath;
    if (!ajeno) return d;
    const libre = !cobroDelCandado || ESTADOS_FINALES.includes(cobroDelCandado.estado) ||
      ahora - (Number(candado.desde) || 0) > CANDADO_VENCE_MS;
    if (libre) return d;
    return {accion: "error", code: "failed-precondition",
      mensaje: "La terminal tiene otro cobro en curso. Termínalo o cancélalo primero."};
  };

  if (!cobro) return conCandado({accion: "nuevo", intento: 1});
  const e = cobro.estado;
  if (e === "aprobado") return {accion: "ya-aprobado"};
  if (e === "revisar") return {accion: "revisar"};
  const enviandoVivo = e === "enviando" &&
    ahora - (Number(cobro.actualizadoEn) || 0) < ENVIANDO_VENCE_MS;
  if (e === "pendiente" || enviandoVivo) {
    if (cobro.montoCentavos !== montoCentavos) {
      return {accion: "error", code: "failed-precondition",
        mensaje: "Hay un cobro en curso por otro monto: cancélalo primero."};
    }
    return {accion: "devolver"};
  }
  const siguiente = (Number(cobro.intento) || 0) + 1;
  if (e === "incierto" || e === "enviando") {
    if (!reintentarIncierto) return {accion: "devolver"};
    return conCandado({accion: "limpiar-y-nuevo", intento: siguiente});
  }
  // fallido o cancelado: el cobro anterior terminó sin pago.
  return conCandado({accion: "nuevo", intento: siguiente});
}

/**
 * Error de Clip para la caja. `details.retriable` y `clipStatus` le dicen al
 * servidor si el envío quedó incierto (red o 5xx: Clip pudo haberlo creado).
 */
function errorClip(status, data) {
  const code = data && data.code ? String(data.code) : "";
  const detalle = {clipStatus: status, clipCode: code, retriable: status === 0 || status >= 500};
  if (status === 0) return new HttpsError("unavailable", "No se pudo contactar a Clip", detalle);
  if (status >= 500) return new HttpsError("unavailable", `Clip respondió ${status}`, detalle);
  if (code === "ERR10_04") {
    return new HttpsError("failed-precondition",
        "La terminal está apagada, la app PinPad está cerrada o ya tiene un cobro en curso",
        detalle);
  }
  if (status === 401 || status === 403) {
    return new HttpsError("failed-precondition", "Clip rechazó las credenciales del negocio",
        detalle);
  }
  if (status === 404) return new HttpsError("not-found", "Clip no encontró el cobro", detalle);
  const msg = data && data.message ? `Clip: ${data.message}` : `Clip respondió ${status}`;
  return new HttpsError("failed-precondition", msg, detalle);
}

/** Envío cuyo resultado no se sabe: red caída, tiempo agotado o 5xx. */
function envioIncierto(err) {
  const d = (err && err.details) || {};
  return d.clipStatus === 0 || Number(d.clipStatus) >= 500;
}

/**
 * Qué significa lo que respondió Clip al cancelar por número de serie (null =
 * respondió 200): "libre" si canceló o no había nada que cancelar, "ocupada"
 * si la terminal ya está cobrando, "error" si no se sabe (401, 429, red…).
 * Solo "libre" deja mandar otro intento o dar el cobro por cancelado.
 */
function resultadoLimpieza(err) {
  if (!err) return "libre";
  const d = (err && err.details) || {};
  if (d.clipCode === "PAYMENT_PENDING") return "ocupada";
  if (d.clipStatus === 404 ||
      (d.clipStatus === 400 && d.clipCode === "PAYMENT_REQUEST_ISSUE")) {
    return "libre";
  }
  return "error";
}

/**
 * Dinero en un intento que ya no es el abierto (el aviso llegó tarde, o se
 * reintentó un incierto que sí se cobró). Nunca se tira:
 * - "aprobar": el cobro aún no estaba aprobado → queda aprobado con ese pago
 *   (aunque se hubiera dado por cancelado o confirmado a mano).
 * - "extra": ya estaba aprobado con otro pago → cobro doble, a devolver a mano.
 * - "ignorar": ese pago ya está contado.
 */
function decidirPagoTardio(cobro, id) {
  if (!cobro) return "ignorar";
  if (cobro.estado !== "aprobado") return "aprobar";
  if (cobro.pinpadRequestId === id) return "ignorar";
  if ((cobro.aprobacionesExtra || []).some((x) => x && x.id === id)) return "ignorar";
  return "extra";
}

/** Lo que la caja necesita del cobro (sin serie ni historial). */
function cobroPublico(c) {
  if (!c) return null;
  return {
    cobroId: c.cobroId,
    estado: c.estado,
    intento: c.intento,
    monto: c.monto,
    montoCentavos: c.montoCentavos,
    pinpadRequestId: c.pinpadRequestId || null,
    tarjeta: c.tarjeta || null,
    pagadoCentavos: c.pagadoCentavos || 0,
    alerta: c.alerta || null,
    error: c.error || null,
    actualizadoEn: c.actualizadoEn || null,
  };
}

module.exports = {
  ESTADOS_FINALES,
  CANDADO_VENCE_MS,
  ENVIANDO_VENCE_MS,
  transicionValida,
  montoClip,
  centavos,
  basicAuth,
  referencia,
  leerReferencia,
  cobroIdValido,
  serieValida,
  claimsCaja,
  cuerpoCobro,
  tarjetaDe,
  evaluarIntentoClip,
  decidirCobro,
  errorClip,
  envioIncierto,
  resultadoLimpieza,
  decidirPagoTardio,
  cobroPublico,
};
