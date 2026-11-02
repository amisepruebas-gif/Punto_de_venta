"use strict";
// node --test test/  (Node 22, sin dependencias)
const test = require("node:test");
const assert = require("node:assert/strict");
const {
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
  evaluarIntentoClip,
  decidirCobro,
  errorClip,
  envioIncierto,
  cobroPublico,
  resultadoLimpieza,
  decidirPagoTardio,
  CANDADO_VENCE_MS,
  ENVIANDO_VENCE_MS,
} = require("../lib/clip");

const aprobado = (monto, extra = {}) => ({
  status: "approved",
  paid_amount: monto,
  amount: monto,
  transaction_id: "tx-1",
  approved_at: "2026-11-02T18:00:00Z",
  payment_method: {id: "visa", type: "debit_card",
    card: {last_digits: "4242", issuer: "BBVA", bin: "411111"}},
  ...extra,
});
const rechazado = () => ({status: "declined", paid_amount: 0, amount: 35});
const resp = (status, results, amountPaid) => ({
  status,
  amount: "35.00",
  ...(amountPaid !== undefined ? {amount_paid: amountPaid} : {}),
  detail: {results},
});

test("montoClip: texto con dos decimales, y rechaza montos inválidos", () => {
  assert.equal(montoClip(35), "35.00");
  assert.equal(montoClip("199.5"), "199.50");
  assert.equal(montoClip(0.1 + 0.2), "0.30");
  for (const malo of [0, -1, "abc", NaN, Infinity, 10.005, 2000000]) {
    assert.throws(() => montoClip(malo), {code: "invalid-argument"}, String(malo));
  }
});

test("centavos y basicAuth", () => {
  assert.equal(centavos("199.50"), 19950);
  assert.equal(centavos(0.1 + 0.2), 30);
  assert.equal(centavos("x"), 0);
  assert.equal(basicAuth("k", "s"), "Basic " + Buffer.from("k:s").toString("base64"));
});

test("referencia: liga intento y venta, y se puede leer de vuelta", () => {
  assert.equal(referencia("Vta_123", 2), "Vta_123-2");
  assert.deepEqual(leerReferencia("Vta_123-2"), {cobroId: "Vta_123", intento: 2});
  assert.deepEqual(leerReferencia("ab-cd-ef-1"), {cobroId: "ab-cd-ef", intento: 1});
  assert.equal(leerReferencia("test-demo"), null);
  assert.equal(leerReferencia(""), null);
});

test("cobroIdValido y serieValida", () => {
  assert.equal(cobroIdValido("abcDEF12_-"), true);
  assert.equal(cobroIdValido("a/b"), false);
  assert.equal(cobroIdValido("abc"), false);
  assert.equal(cobroIdValido(123), false);
  assert.equal(serieValida("P8C1231120001152"), true);
  assert.equal(serieValida("TOTAL3-PRUEBA"), true);
  assert.equal(serieValida("ab"), false);
  assert.equal(serieValida("con espacio"), false);
});

test("claimsCaja: solo la sesión de una caja con su nodo", () => {
  const caja = {token: {role: "nodo", negocioId: "n", sucursalId: "s", nodoId: "x"}};
  assert.deepEqual(claimsCaja(caja), {negocioId: "n", sucursalId: "s", nodoId: "x"});
  assert.throws(() => claimsCaja(null), {code: "unauthenticated"});
  for (const t of [
    {role: "admin", negocioId: "n"},
    {role: "vendedor", negocioId: "n", sucursalId: "s"},
    {role: "nodo", negocioId: "n", sucursalId: "s"},
  ]) {
    assert.throws(() => claimsCaja({token: t}), {code: "permission-denied"});
  }
});

test("cuerpoCobro: sin propina, sin meses, sin dividir; reintento e impresión sí", () => {
  const b = cuerpoCobro({monto: 416, referencia: "V1-1", serial: "S1", webhookUrl: "https://x/w"});
  assert.equal(b.amount, "416.00");
  assert.equal(b.reference, "V1-1");
  assert.equal(b.serial_number_pos, "S1");
  assert.equal(b.webhook_url, "https://x/w");
  assert.equal(b.preferences.is_tip_enabled, false);
  assert.equal(b.preferences.is_msi_enabled, false);
  assert.equal(b.preferences.is_mci_enabled, false);
  assert.equal(b.preferences.is_split_payment_enabled, false);
  assert.equal(b.preferences.is_dcc_enabled, false);
  assert.equal(b.preferences.is_retry_enabled, true);
  assert.equal(b.preferences.is_auto_print_receipt_enabled, true);
});

test("evaluar: COMPLETED con lo exacto es aprobado, con los datos de la tarjeta", () => {
  const ev = evaluarIntentoClip(resp("COMPLETED", [aprobado(35)], "35.00"), 3500);
  assert.equal(ev.estado, "aprobado");
  assert.equal(ev.pagadoCentavos, 3500);
  assert.equal(ev.alerta, null);
  assert.deepEqual(ev.tarjeta, {marca: "visa", tipo: "debit_card", ultimos4: "4242", banco: "BBVA",
    transaccionId: "tx-1", aprobadoEn: "2026-11-02T18:00:00Z"});
});

test("evaluar: rechazada y luego aprobada (reintento) es aprobado con la tarjeta buena", () => {
  const ev = evaluarIntentoClip(resp("COMPLETED", [rechazado(), aprobado(35)], "35.00"), 3500);
  assert.equal(ev.estado, "aprobado");
  assert.equal(ev.alerta, null);
  assert.equal(ev.tarjeta.ultimos4, "4242");
});

test("evaluar: pago de más se aprueba con alerta; dos aprobaciones también", () => {
  const deMas = evaluarIntentoClip(resp("COMPLETED", [aprobado(45)], "45.00"), 3500);
  assert.equal(deMas.estado, "aprobado");
  assert.equal(deMas.alerta, "pago-de-mas");
  const dos = evaluarIntentoClip(resp("COMPLETED", [aprobado(20), aprobado(15)], "35.00"), 3500);
  assert.equal(dos.estado, "aprobado");
  assert.equal(dos.alerta, "varias-aprobaciones");
});

test("evaluar: COMPLETED que no cuadra va a revisión, nunca a aprobado", () => {
  assert.equal(evaluarIntentoClip(resp("COMPLETED", [aprobado(20)], "20.00"), 3500).estado, "revisar");
  assert.equal(evaluarIntentoClip(resp("COMPLETED", [aprobado(20)], "20.00"), 3500).alerta, "pago-de-menos");
  assert.equal(evaluarIntentoClip(resp("COMPLETED", [], "0.00"), 3500).estado, "revisar");
  // amount_paid ausente: cuenta lo aprobado en los resultados.
  assert.equal(evaluarIntentoClip(resp("COMPLETED", [aprobado(35)]), 3500).estado, "aprobado");
});

test("evaluar: cerrada sin pago es fallido o cancelado; con pago, revisión", () => {
  assert.equal(evaluarIntentoClip(resp("FAILED", [rechazado()], "0.00"), 3500).estado, "fallido");
  assert.equal(evaluarIntentoClip(resp("CANCELED", [], "0.00"), 3500).estado, "cancelado");
  assert.equal(evaluarIntentoClip(resp("CANCELLED", [], "0.00"), 3500).estado, "cancelado");
  assert.equal(evaluarIntentoClip(resp("EXPIRED", [], "0.00"), 3500).estado, "fallido");
  const raro = evaluarIntentoClip(resp("FAILED", [aprobado(35)], "35.00"), 3500);
  assert.equal(raro.estado, "revisar");
  assert.equal(raro.alerta, "pago-en-intento-cerrado");
});

test("evaluar: PENDING, IN_PROCESS o un estado desconocido siguen esperando", () => {
  for (const s of ["PENDING", "IN_PROCESS", "ALGO_NUEVO", "", undefined]) {
    assert.equal(evaluarIntentoClip({status: s, detail: {results: []}}, 3500).estado, "pendiente", String(s));
  }
  // Una tarjeta rechazada con reintento activo deja la intención PENDING.
  assert.equal(evaluarIntentoClip(resp("PENDING", [rechazado()], "0.00"), 3500).estado, "pendiente");
  assert.equal(evaluarIntentoClip(null, 3500).estado, "pendiente");
});

const P = "negocios/amise/sucursales/S1/pagos/V1";
const base = {cobroPath: P, montoCentavos: 3500, ahora: 1_000_000, reintentarIncierto: false};

test("decidir: sin cobro es el intento 1", () => {
  assert.deepEqual(decidirCobro({...base, cobro: null}), {accion: "nuevo", intento: 1});
});

test("decidir: dos toques o reintento mientras espera devuelven el mismo cobro", () => {
  const pendiente = {estado: "pendiente", montoCentavos: 3500, intento: 1};
  assert.equal(decidirCobro({...base, cobro: pendiente}).accion, "devolver");
  const enviando = {estado: "enviando", montoCentavos: 3500, intento: 1, actualizadoEn: base.ahora - 5000};
  assert.equal(decidirCobro({...base, cobro: enviando}).accion, "devolver");
});

test("decidir: otro monto con un intento abierto es error", () => {
  const pendiente = {estado: "pendiente", montoCentavos: 3000, intento: 1};
  const d = decidirCobro({...base, cobro: pendiente});
  assert.equal(d.accion, "error");
  assert.equal(d.code, "failed-precondition");
});

test("decidir: aprobado o en revisión nunca se vuelve a cobrar", () => {
  assert.equal(decidirCobro({...base, cobro: {estado: "aprobado", montoCentavos: 3500}}).accion, "ya-aprobado");
  assert.equal(decidirCobro({...base, cobro: {estado: "aprobado", montoCentavos: 9}}).accion, "ya-aprobado");
  assert.equal(decidirCobro({...base, cobro: {estado: "revisar", montoCentavos: 3500}}).accion, "revisar");
});

test("decidir: tras fallido o cancelado, un intento nuevo con el número siguiente", () => {
  assert.deepEqual(decidirCobro({...base, cobro: {estado: "fallido", intento: 1, montoCentavos: 3500}}),
      {accion: "nuevo", intento: 2});
  assert.deepEqual(decidirCobro({...base, cobro: {estado: "cancelado", intento: 3, montoCentavos: 3500}}),
      {accion: "nuevo", intento: 4});
});

test("decidir: incierto se devuelve hasta que el cajero revise la terminal", () => {
  const incierto = {estado: "incierto", intento: 1, montoCentavos: 3500};
  assert.equal(decidirCobro({...base, cobro: incierto}).accion, "devolver");
  assert.deepEqual(decidirCobro({...base, cobro: incierto, reintentarIncierto: true}),
      {accion: "limpiar-y-nuevo", intento: 2});
  // Un envío que lleva más de un minuto sin terminar cuenta como incierto.
  const colgado = {estado: "enviando", intento: 1, montoCentavos: 3500,
    actualizadoEn: base.ahora - ENVIANDO_VENCE_MS - 1};
  assert.equal(decidirCobro({...base, cobro: colgado}).accion, "devolver");
  assert.equal(decidirCobro({...base, cobro: colgado, reintentarIncierto: true}).accion, "limpiar-y-nuevo");
});

test("decidir: la terminal con el cobro vigente de otra venta bloquea", () => {
  const candado = {cobroPath: "otro/V2", intento: 1, desde: base.ahora - 1000};
  const otroAbierto = {estado: "pendiente"};
  const d = decidirCobro({...base, cobro: null, candado, cobroDelCandado: otroAbierto});
  assert.equal(d.accion, "error");
  // Libre si el otro ya terminó, si no existe o si el candado venció.
  assert.equal(decidirCobro({...base, cobro: null, candado, cobroDelCandado: {estado: "aprobado"}}).accion, "nuevo");
  assert.equal(decidirCobro({...base, cobro: null, candado, cobroDelCandado: null}).accion, "nuevo");
  const viejo = {...candado, desde: base.ahora - CANDADO_VENCE_MS - 1};
  assert.equal(decidirCobro({...base, cobro: null, candado: viejo, cobroDelCandado: otroAbierto}).accion, "nuevo");
  // El candado propio no estorba.
  assert.equal(decidirCobro({...base, cobro: {estado: "fallido", intento: 1, montoCentavos: 3500},
    candado: {cobroPath: P, intento: 1, desde: base.ahora}, cobroDelCandado: null}).accion, "nuevo");
});

test("transiciones: los finales no se mueven; incierto puede revelar su id", () => {
  assert.equal(transicionValida("enviando", "pendiente"), true);
  assert.equal(transicionValida("pendiente", "aprobado"), true);
  assert.equal(transicionValida("incierto", "pendiente"), true);
  assert.equal(transicionValida("aprobado", "aprobado"), true);
  assert.equal(transicionValida("aprobado", "cancelado"), false);
  assert.equal(transicionValida("aprobado", "fallido"), false);
  assert.equal(transicionValida("cancelado", "aprobado"), false);
  assert.equal(transicionValida("fallido", "pendiente"), false);
  assert.equal(transicionValida("revisar", "aprobado"), false);
  assert.equal(transicionValida("pendiente", "enviando"), false);
});

test("errorClip: incierto con red o 5xx; definitivo con 4xx", () => {
  const red = errorClip(0, null);
  assert.equal(red.code, "unavailable");
  assert.equal(envioIncierto(red), true);
  assert.equal(envioIncierto(errorClip(502, {})), true);
  const ocupada = errorClip(400, {code: "ERR10_04", message: "offline"});
  assert.equal(ocupada.code, "failed-precondition");
  assert.match(ocupada.message, /terminal/);
  assert.equal(envioIncierto(ocupada), false);
  assert.equal(errorClip(401, {}).code, "failed-precondition");
  assert.equal(errorClip(404, {code: "PAYMENT_NOT_FOUND"}).code, "not-found");
  assert.equal(envioIncierto(errorClip(400, {code: "X"})), false);
  assert.equal(envioIncierto(new Error("otro")), false);
});

test("cobroPublico: sin serie ni historial", () => {
  const c = cobroPublico({cobroId: "V1", estado: "pendiente", intento: 1, monto: "35.00",
    montoCentavos: 3500, serial: "S1", intentos: [{n: 1}], pinpadRequestId: "pinpad-1"});
  assert.equal(c.serial, undefined);
  assert.equal(c.intentos, undefined);
  assert.equal(c.pinpadRequestId, "pinpad-1");
  assert.equal(cobroPublico(null), null);
});

test("transiciones: confirmar a mano solo desde un envío incierto", () => {
  assert.equal(transicionValida("incierto", "manual"), true);
  assert.equal(transicionValida("enviando", "manual"), true);
  assert.equal(transicionValida("pendiente", "manual"), false);
  assert.equal(transicionValida("manual", "aprobado"), false);
});

test("limpiar la terminal: solo libre deja seguir", () => {
  assert.equal(resultadoLimpieza(null), "libre");
  assert.equal(resultadoLimpieza(errorClip(400, {code: "PAYMENT_REQUEST_ISSUE"})), "libre");
  assert.equal(resultadoLimpieza(errorClip(404, {})), "libre");
  assert.equal(resultadoLimpieza(errorClip(400, {code: "PAYMENT_PENDING"})), "ocupada");
  // Lo que no se entiende no cuenta como cancelado: 429, 401, otro 400, red.
  for (const e of [errorClip(429, {}), errorClip(401, {}), errorClip(400, {code: "X"}),
    errorClip(0, null), errorClip(503, {})]) {
    assert.equal(resultadoLimpieza(e), "error", e.message);
  }
});

test("pago tardío: nunca se tira; cobro doble se marca", () => {
  for (const estado of ["pendiente", "incierto", "fallido", "cancelado", "manual", "revisar"]) {
    assert.equal(decidirPagoTardio({estado, pinpadRequestId: "pinpad-2"}, "pinpad-1"), "aprobar", estado);
  }
  assert.equal(decidirPagoTardio({estado: "aprobado", pinpadRequestId: "pinpad-1"}, "pinpad-1"), "ignorar");
  assert.equal(decidirPagoTardio({estado: "aprobado", pinpadRequestId: "pinpad-2"}, "pinpad-1"), "extra");
  assert.equal(decidirPagoTardio({estado: "aprobado", pinpadRequestId: "pinpad-2",
    aprobacionesExtra: [{id: "pinpad-1"}]}, "pinpad-1"), "ignorar");
  assert.equal(decidirPagoTardio(null, "pinpad-1"), "ignorar");
});
