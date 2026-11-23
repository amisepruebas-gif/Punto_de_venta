"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../lib/cashbackMayoreo");

const MX = (iso) => Date.parse(iso + "-06:00"); // "2026-03-15T12:00:00" en México
const ISO = (ms) => new Date(ms).toISOString();

test("vencimiento: vigencia en días, meses y años (calendario de México)", () => {
  assert.equal(ISO(L.calcularVence(MX("2026-03-15T12:00:00"), { cantidad: 10, unidad: "dias" })),
    ISO(MX("2026-03-25T12:00:00")));
  assert.equal(ISO(L.calcularVence(MX("2026-03-15T12:00:00"), { cantidad: 1, unidad: "meses" })),
    ISO(MX("2026-04-15T12:00:00")));
  // 31 de enero + 1 mes → 28 de febrero, no 3 de marzo.
  assert.equal(ISO(L.calcularVence(MX("2026-01-31T10:00:00"), { cantidad: 1, unidad: "meses" })),
    ISO(MX("2026-02-28T10:00:00")));
});

test("vencimiento: nunca pasa del 1 de enero siguiente (00:00 México)", () => {
  const enero = ISO(MX("2027-01-01T00:00:00"));
  assert.equal(enero, "2027-01-01T06:00:00.000Z");
  assert.equal(ISO(L.calcularVence(MX("2026-12-20T12:00:00"), { cantidad: 1, unidad: "meses" })), enero);
  assert.equal(ISO(L.calcularVence(MX("2026-02-10T12:00:00"), { cantidad: 1, unidad: "anios" })), enero);
  // 31-dic 23:30 en México es 1-ene en UTC, pero cuenta como compra de 2026.
  assert.equal(ISO(L.calcularVence(MX("2026-12-31T23:30:00"), { cantidad: 10, unidad: "dias" })), enero);
  // 1-ene 00:30 en México ya es 2027: vence a más tardar el 1-ene-2028.
  assert.equal(ISO(L.calcularVence(MX("2027-01-01T00:30:00"), { cantidad: 2, unidad: "anios" })),
    ISO(MX("2028-01-01T00:00:00")));
});

test("saldo vigente: 0 después de vencer", () => {
  const c = { saldoCentavos: 5000, venceISO: ISO(MX("2026-04-15T12:00:00")) };
  assert.equal(L.saldoVigente(c, MX("2026-04-15T11:59:59")), 5000);
  assert.equal(L.saldoVigente(c, MX("2026-04-15T12:00:00")), 0);
  assert.equal(L.vencioConSaldo(c, MX("2026-04-16T00:00:00")), true);
  assert.equal(L.vencioConSaldo({ ...c, saldoCentavos: 0 }, MX("2026-04-16T00:00:00")), false);
  assert.equal(L.saldoVigente({ saldoCentavos: 300 }, Date.now()), 300);
  assert.equal(L.saldoVigente(null, Date.now()), 0);
});

test("ganancia en centavos, hacia abajo", () => {
  assert.equal(L.ganadoCentavos(1000, 3), 3000);
  assert.equal(L.ganadoCentavos(123.45, 3), 370);
  assert.equal(L.ganadoCentavos(99.99, 2.5), 249);
  assert.equal(L.ganadoCentavos(0, 3), 0);
  assert.equal(L.ganadoCentavos(100, 0), 0);
  assert.equal(L.ganadoCentavos(-5, 3), 0);
});

test("PIN trivial y PIN generado", () => {
  for (const p of ["0000", "1111", "1234", "6789", "9876", "3210", "1990", "2026", "12a4", "123"]) {
    assert.equal(L.pinTrivial(p), true, p);
  }
  assert.equal(L.pinTrivial("5678"), true);
  assert.equal(L.pinTrivial("4071"), false);
  assert.equal(L.pinTrivial("4071", "5512344071"), true, "los últimos 4 del teléfono");
  assert.equal(L.pinTrivial("1357"), false);
  const seq = [1234, 4071];
  assert.equal(L.generarPin("5512345678", () => seq.shift()), "4071");
  for (let i = 0; i < 200; i++) {
    const p = L.generarPin("5512345678");
    assert.match(p, /^\d{4}$/);
    assert.equal(L.pinTrivial(p, "5512345678"), false);
  }
});

test("hash del PIN con pepper y sal, comparación en tiempo constante", () => {
  const sal = L.generarSal();
  const h = L.hashPin("pepper-1", sal, "4071");
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.equal(L.pinCoincide("pepper-1", sal, "4071", h), true);
  assert.equal(L.pinCoincide("pepper-1", sal, "4072", h), false);
  assert.equal(L.pinCoincide("pepper-2", sal, "4071", h), false, "otro pepper");
  assert.equal(L.pinCoincide("pepper-1", L.generarSal(), "4071", h), false, "otra sal");
  assert.equal(L.pinCoincide("pepper-1", sal, "407", h), false);
  assert.equal(L.pinCoincide("pepper-1", sal, "4071", ""), false);
});

test("token del QR: CBM + 22 caracteres sin ambiguos; se lee aunque venga en minúsculas", () => {
  const t = L.generarTokenQr();
  assert.match(t, /^CBM[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{22}$/);
  assert.equal(L.leerQr(` ${t.toLowerCase()} `), t);
  assert.equal(L.leerQr(t.slice(0, -1)), null);
  assert.equal(L.leerQr("CBM" + "0".repeat(22)), null, "sin 0");
  assert.notEqual(L.generarTokenQr(), t);
  const s = L.generarSesion();
  assert.equal(L.hashSesion(s).length, 64);
});

test("bloqueos por teléfono: 5 fallos → 15 min, 10 → 1 h, 15 → 24 h", () => {
  const t0 = 1_000_000;
  let d = null;
  for (let i = 1; i <= 4; i++) d = L.trasFallo(d, t0);
  assert.equal(L.bloqueado(d, t0), false);
  d = L.trasFallo(d, t0);
  assert.equal(d.bloqueadoHastaMs, t0 + 15 * 60000);
  assert.equal(L.bloqueado(d, t0 + 14 * 60000), true);
  assert.equal(L.bloqueado(d, t0 + 15 * 60000), false);
  for (let i = 6; i <= 10; i++) d = L.trasFallo(d, t0);
  assert.equal(d.bloqueadoHastaMs, t0 + 60 * 60000);
  for (let i = 11; i <= 15; i++) d = L.trasFallo(d, t0);
  assert.equal(d.bloqueadoHastaMs, t0 + 24 * 3600000);
  for (let i = 16; i <= 20; i++) d = L.trasFallo(d, t0);
  assert.equal(d.bloqueadoHastaMs, t0 + 24 * 3600000, "se queda en 24 h");
});

test("límite por IP: 30 fallos por hora", () => {
  const t0 = 5_000_000;
  let d = null;
  for (let i = 0; i < 29; i++) d = L.ipTrasFallo(d, t0 + i);
  assert.equal(L.ipBloqueada(d, t0 + 100), false);
  d = L.ipTrasFallo(d, t0 + 200);
  assert.equal(L.ipBloqueada(d, t0 + 300), true);
  assert.equal(L.ipBloqueada(d, t0 + 3600000), false, "pasó la hora");
  assert.deepEqual(L.ipTrasFallo(d, t0 + 3600000), { ventanaMs: t0 + 3600000, fallos: 1 });
});

test("config válida", () => {
  assert.equal(L.validarConfig({ pct: 3, vigencia: { cantidad: 1, unidad: "meses" } }), null);
  assert.ok(L.validarConfig({ pct: 0, vigencia: { cantidad: 1, unidad: "meses" } }));
  assert.ok(L.validarConfig({ pct: 3, vigencia: { cantidad: 0, unidad: "meses" } }));
  assert.ok(L.validarConfig({ pct: 3, vigencia: { cantidad: 1, unidad: "semanas" } }));
  assert.equal(L.normalizarTelefono("+52 (55) 1234-5678"), "5512345678");
  assert.equal(L.normalizarTelefono("12345"), null);
});
