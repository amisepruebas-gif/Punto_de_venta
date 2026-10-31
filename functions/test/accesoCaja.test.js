"use strict";
// node --test test/  (Node 22, sin dependencias)
const test = require("node:test");
const assert = require("node:assert/strict");
const acceso = require("../lib/accesoCaja");

test("generarCodigo: 8 caracteres del alfabeto sin ambiguos", () => {
  for (let i = 0; i < 200; i++) {
    const c = acceso.generarCodigo();
    assert.equal(c.length, acceso.LARGO_CODIGO);
    for (const ch of c) assert.ok(acceso.ALFABETO_CODIGO.includes(ch), ch);
    assert.ok(!/[01OIL]/.test(c), c);
  }
});

test("generarCodigo: descarta los bytes que darían sesgo", () => {
  // 31 símbolos → límite 248: 248..255 se descartan; 0 → "2", 30 → "Z".
  const bytes = [255, 0, 248, 30, 31, 62, 249, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const c = acceso.generarCodigo(() => Buffer.from(bytes));
  assert.equal(c, "2Z22" + "3456");
});

test("normalizarCodigo acepta minúsculas, guion y espacios", () => {
  assert.equal(acceso.normalizarCodigo("abcd-2345"), "ABCD2345");
  assert.equal(acceso.normalizarCodigo(" ABCD 2345 "), "ABCD2345");
  assert.equal(acceso.formatearCodigo("ABCD2345"), "ABCD-2345");
});

test("normalizarCodigo rechaza lo que no puede ser un código", () => {
  for (const malo of [undefined, null, 12345678, "", "ABC-234",
    "ABCD23456", "ABCD234O", "ABCD2340", "ABCD234I", "ABCD234!"]) {
    assert.equal(acceso.normalizarCodigo(malo), null, String(malo));
  }
});

test("hashSecreto es sha256 en hex", () => {
  assert.equal(acceso.hashSecreto("abc"),
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("llaveCoincide solo con la llave correcta", () => {
  const llave = acceso.generarLlave();
  assert.ok(llave.length >= 43);
  const hash = acceso.hashSecreto(llave);
  assert.equal(acceso.llaveCoincide(llave, hash), true);
  assert.equal(acceso.llaveCoincide(acceso.generarLlave(), hash), false);
  assert.equal(acceso.llaveCoincide(llave, undefined), false);
  assert.equal(acceso.llaveCoincide(llave, "zz"), false);
  assert.equal(acceso.llaveCoincide("", hash), false);
  assert.equal(acceso.llaveCoincide(undefined, hash), false);
});

test("estadoCodigo: inexistente, usado, vencido y válido", () => {
  const ahora = 1_000_000;
  assert.equal(acceso.estadoCodigo(null, ahora), "inexistente");
  assert.equal(
      acceso.estadoCodigo({usado: true, expiraEnMs: ahora + 1}, ahora), "usado");
  assert.equal(
      acceso.estadoCodigo({usado: false, expiraEnMs: ahora}, ahora), "vencido");
  assert.equal(acceso.estadoCodigo({usado: false}, ahora), "vencido");
  assert.equal(
      acceso.estadoCodigo({usado: false, expiraEnMs: ahora + 1}, ahora),
      "valido");
});
