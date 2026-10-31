"use strict";
// node --test test/  (Node 22, sin dependencias)
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  EXIGIR_IDENTIDAD,
  telefonosIguales,
  esEan13,
  ultimos4,
  enmascararCorreo,
  filtrarSaldo,
  verificarIdentidad,
  rechazar,
} = require("../lib/puntosSeguridad");

test("el modo por defecto es observar (no rechaza hasta cambiar la constante)", () => {
  assert.equal(EXIGIR_IDENTIDAD, false);
});

test("telefonosIguales: últimos 10 dígitos, con o sin lada ni formato", () => {
  assert.equal(telefonosIguales("+525511111111", "5511111111"), true);
  assert.equal(telefonosIguales("55 1111-1111", "(55) 1111 1111"), true);
  assert.equal(telefonosIguales("+525511111111", "5522222222"), false);
  assert.equal(telefonosIguales("11111111", "11111111"), false); // menos de 10
  assert.equal(telefonosIguales(undefined, "5511111111"), false);
  assert.equal(telefonosIguales(null, null), false);
});

test("esEan13: dígito verificador", () => {
  for (const ok of ["4006381333931", "9780306406157", "7501000000012", "7502000000019"]) {
    assert.equal(esEan13(ok), true, ok);
  }
  for (const mal of ["4006381333932", "978030640615", "97803064061577", "750100000001a",
    "", null, undefined, 7501000000012]) {
    assert.equal(esEan13(mal), mal === 7501000000012, String(mal));
  }
});

test("ultimos4 y enmascararCorreo", () => {
  assert.equal(ultimos4("7501000000012"), "0012");
  assert.equal(ultimos4(undefined), "");
  assert.equal(enmascararCorreo("juan@gmail.com"), "ju•••@gmail.com");
  assert.equal(enmascararCorreo("a@x.com"), "a•••@x.com");
  assert.equal(enmascararCorreo(" ju•••@gmail.com "), "ju•••@gmail.com"); // idempotente
  assert.equal(enmascararCorreo(enmascararCorreo("pepe@x.mx")), "pe•••@x.mx");
  assert.equal(enmascararCorreo("sin-arroba"), "•••");
  assert.equal(enmascararCorreo(""), "");
  assert.equal(enmascararCorreo(undefined), "");
});

const BALANCE = {exists: true, saldoDinero: 37.8, saldoUsable: 37.5, valorPorPeso: 0.05,
  telefono: "+525511111111", tarjeta: {codigo: "7501000000012", estado: "activa"},
  email: "ana@demo.test", nombre: "Ana", walletId: "W1"};

test("filtrarSaldo: solo lo que usa la caja", () => {
  const r = filtrarSaldo(BALANCE);
  assert.deepEqual(r, {exists: true, saldoDinero: 37.8, saldoUsable: 37.5,
    valorPorPeso: 0.05, telefono: "+525511111111",
    tarjeta: {codigo: "7501000000012", estado: "activa"}});
  assert.deepEqual(filtrarSaldo({exists: false, email: "x@y.z"}), {exists: false});
  assert.deepEqual(filtrarSaldo(null), {exists: false});
  assert.equal(filtrarSaldo({...BALANCE, tarjeta: null}).tarjeta, null);
});

test("filtrarSaldo al exigir: tarjeta oculta salvo si se consultó con ella", () => {
  assert.equal(filtrarSaldo(BALANCE, {exigir: true}).tarjeta.codigo, "0012");
  assert.equal(filtrarSaldo(BALANCE, {exigir: true, porCodigo: true}).tarjeta.codigo,
      "7501000000012");
  assert.equal(filtrarSaldo(BALANCE, {exigir: false}).tarjeta.codigo, "7501000000012");
  assert.equal(filtrarSaldo(BALANCE, {exigir: true}).tarjeta.estado, "activa");
});

function consultaFalsa(monederos) {
  const llamadas = [];
  const consultar = async (p) => {
    llamadas.push(p);
    const m = monederos.find((x) => (p.codigo && x.tarjeta === p.codigo) ||
      (p.email && x.email === p.email));
    return m ? {exists: true, telefono: m.telefono} : {exists: false};
  };
  return {consultar, llamadas};
}
const MONEDEROS = [
  {email: "ana@demo.test", telefono: "+525511111111", tarjeta: "7501000000012"},
  {email: "beto@demo.test", telefono: "+525522222222", tarjeta: "7501000000029"},
];

test("verificarIdentidad: tarjeta del mismo monedero", async () => {
  const f = consultaFalsa(MONEDEROS);
  assert.deepEqual(await verificarIdentidad({phone: "5511111111", codigo: "7501000000012"},
      f.consultar), {ok: true, motivo: "ok_tarjeta"});
  assert.deepEqual(await verificarIdentidad({phone: "5511111111", codigo: "7501000000029"},
      f.consultar), {ok: false, motivo: "no_coincide"});
  assert.deepEqual(await verificarIdentidad({phone: "5511111111", codigo: "7501000000036"},
      f.consultar), {ok: false, motivo: "tarjeta_no_encontrada"});
});

test("verificarIdentidad: un código mal escrito no consulta a amise", async () => {
  const f = consultaFalsa(MONEDEROS);
  assert.deepEqual(await verificarIdentidad({phone: "5511111111", codigo: "7501000000013"},
      f.consultar), {ok: false, motivo: "codigo_invalido"});
  assert.equal(f.llamadas.length, 0);
});

test("verificarIdentidad: correo del mismo monedero", async () => {
  const f = consultaFalsa(MONEDEROS);
  assert.deepEqual(await verificarIdentidad({phone: "+52 55 1111 1111",
    email: " ana@demo.test "}, f.consultar), {ok: true, motivo: "ok_correo"});
  assert.deepEqual(await verificarIdentidad({phone: "5511111111", email: "beto@demo.test"},
      f.consultar), {ok: false, motivo: "no_coincide"});
  assert.deepEqual(await verificarIdentidad({phone: "5511111111", email: "nadie@demo.test"},
      f.consultar), {ok: false, motivo: "correo_no_encontrado"});
});

test("verificarIdentidad: la tarjeta manda sobre el correo; sin datos no consulta", async () => {
  const f = consultaFalsa(MONEDEROS);
  assert.equal((await verificarIdentidad({phone: "5511111111", codigo: "7501000000029",
    email: "ana@demo.test"}, f.consultar)).motivo, "no_coincide");
  const g = consultaFalsa(MONEDEROS);
  assert.deepEqual(await verificarIdentidad({phone: "5511111111"}, g.consultar),
      {ok: false, motivo: "sin_dato"});
  assert.deepEqual(await verificarIdentidad({phone: "5511111111", email: "  "}, g.consultar),
      {ok: false, motivo: "sin_dato"});
  assert.deepEqual(await verificarIdentidad({codigo: "7501000000012"}, g.consultar),
      {ok: false, motivo: "sin_telefono"});
  assert.equal(g.llamadas.length, 0);
});

test("rechazar: observar nunca; exigir todo lo que no sea ok", () => {
  const malos = ["sin_dato", "sin_telefono", "codigo_invalido", "tarjeta_no_encontrada",
    "correo_no_encontrado", "no_coincide"];
  for (const motivo of malos) {
    assert.equal(rechazar({ok: false, motivo}, {exigir: false}), false, motivo);
    assert.equal(rechazar({ok: false, motivo}, {exigir: true}), true, motivo);
  }
  assert.equal(rechazar({ok: true, motivo: "ok_tarjeta"}, {exigir: true}), false);
  assert.equal(rechazar({ok: false, motivo: "no_coincide"}), false); // default: observar
});

test("rechazar con faltanteOk: tarjeta ya cobrada solo se frena por datos contradictorios", () => {
  const op = {exigir: true, faltanteOk: true};
  assert.equal(rechazar({ok: false, motivo: "sin_dato"}, op), false);
  assert.equal(rechazar({ok: false, motivo: "sin_telefono"}, op), false);
  assert.equal(rechazar({ok: false, motivo: "no_coincide"}, op), true);
  assert.equal(rechazar({ok: false, motivo: "correo_no_encontrado"}, op), true);
});
