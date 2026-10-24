"use strict";
// node --test test/  (Node 20, sin dependencias)
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizarEscalones,
  calcularPatchZona,
  zonaCambioPrecios,
  requiereVerificarZona,
} = require("../lib/zonaPrecio");

const ZONA = {
  precioVenta: 35,
  escalones: [{minPz: 25, precio: 27}, {minPz: 10, precio: 30}],
};

test("normalizarEscalones ordena y descarta inválidos", () => {
  assert.deepEqual(
      normalizarEscalones([
        {minPz: 25, precio: 27}, {minPz: 1, precio: 20},
        {minPz: 10, precio: "30"}, {minPz: 40, precio: 40},
      ], 35),
      [{minPz: 10, precio: 30}, {minPz: 25, precio: 27}],
  );
  assert.deepEqual(normalizarEscalones(undefined, 35), []);
});

test("calcularPatchZona copia precio y escalones y recalcula utilidad", () => {
  const patch = calcularPatchZona(
      {precioVenta: "40", preciCompra: "10", cantidad: "3"}, ZONA);
  assert.deepEqual(patch, {
    precioVenta: "35",
    escalonesMayoreo: [{minPz: 10, precio: 30}, {minPz: 25, precio: 27}],
    utilidad: "25",
    utilidadTotal: "75",
  });
});

test("calcularPatchZona devuelve null si el artículo ya coincide", () => {
  assert.equal(calcularPatchZona({
    precioVenta: "35.00",
    escalonesMayoreo: [{minPz: 10, precio: 30}, {minPz: 25, precio: 27}],
  }, ZONA), null);
});

test("calcularPatchZona fija [] aunque la zona no tenga escalones", () => {
  const patch = calcularPatchZona(
      {precioVenta: "35", mayoreo: "30", cantMayoreo: "10"},
      {precioVenta: 35, escalones: []});
  assert.deepEqual(patch.escalonesMayoreo, []);
});

test("calcularPatchZona no toca nada con una zona sin precio válido", () => {
  assert.equal(calcularPatchZona({precioVenta: "35"}, {precioVenta: 0}), null);
});

test("zonaCambioPrecios ignora renombrar o desactivar", () => {
  assert.equal(zonaCambioPrecios(ZONA, {...ZONA, nombre: "Otro", activa: false}), false);
  assert.equal(zonaCambioPrecios(ZONA, {...ZONA, precioVenta: 34}), true);
  assert.equal(zonaCambioPrecios(ZONA, {...ZONA, escalones: [{minPz: 10, precio: 29}]}), true);
  assert.equal(zonaCambioPrecios(null, ZONA), true);
  assert.equal(zonaCambioPrecios(ZONA, null), false);
});

test("requiereVerificarZona sale sin leer en ventas (solo stock)", () => {
  const art = {zonaPrecioId: "llaveros", precioVenta: "35", escalonesMayoreo: [], cantidad: "5"};
  assert.equal(requiereVerificarZona(art, {...art, cantidad: "4"}), false);
  assert.equal(requiereVerificarZona(art, {...art, precioVenta: "40"}), true);
  assert.equal(requiereVerificarZona(art, {...art, zonaPrecioId: "pines"}), true);
  assert.equal(requiereVerificarZona(null, art), true);
  assert.equal(requiereVerificarZona(art, {...art, zonaPrecioId: undefined}), false);
  assert.equal(requiereVerificarZona(art, null), false);
});
