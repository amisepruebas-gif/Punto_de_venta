"use strict";
// node --test test/  (Node 22, sin dependencias)
const test = require("node:test");
const assert = require("node:assert/strict");
const {requireRolPuntos} = require("../lib/rolesPuntos");

const conCodigo = (codigo) => (e) => e && e.code === codigo;

test("sin sesión → unauthenticated (antes pasaba)", () => {
  assert.throws(() => requireRolPuntos(undefined), conCodigo("unauthenticated"));
  assert.throws(() => requireRolPuntos(null), conCodigo("unauthenticated"));
  assert.throws(() => requireRolPuntos({}), conCodigo("unauthenticated"));
});

test("sesión sin rol o con rol no permitido → permission-denied", () => {
  assert.throws(() => requireRolPuntos({token: {}}), conCodigo("permission-denied"));
  assert.throws(
      () => requireRolPuntos({token: {role: "mercancia"}}),
      conCodigo("permission-denied"));
  assert.throws(
      () => requireRolPuntos({token: {role: "revocado"}}),
      conCodigo("permission-denied"));
});

test("caja y personal con sesión pasan y devuelven sus claims", () => {
  for (const role of ["nodo", "vendedor", "admin", "superadmin"]) {
    const token = {role, sucursalId: "S1", nodoId: "N1"};
    assert.equal(requireRolPuntos({token}), token);
  }
});
