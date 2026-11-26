"use strict";
const {test} = require("node:test");
const assert = require("node:assert/strict");
const et = require("../lib/existenciasTienda");

const OTRA = {sucursalId: "S2", esDefault: false};
const DEFAULT = {sucursalId: "S1", esDefault: true};

const simple = (over = {}) => ({
  nombre: "Metálico 1",
  cantidad: "9",
  cantidadPorSucursal: {S2: "4", S3: "1"},
  cantidadBodegaSucursal: {S2: "10", S3: "7"},
  ...over,
});

const conVariaciones = (over = {}) => ({
  nombre: "Goku",
  cantidad: "5",
  subvariaciones: [
    {codigo: "v-10-aaa", nombre: "m1", codigoBarras: "12300011", imagenUrl: "x",
      cantidad: "5", cantidadPorSucursal: {S2: "2"}, cantidadBodegaSucursal: {S2: "6", S1: "3"}},
    {codigo: "v-10-bbb", nombre: "m2", codigoBarras: "12300012"},
  ],
  ...over,
});

const pedir = (renglones, direccion = "bodega_a_tienda") =>
  et.normalizarPeticion({movimientoId: "mov_12345678", direccion, renglones});

test("normalizar: suma renglones repetidos del mismo artículo final", () => {
  const p = pedir([
    {articuloId: "12300010", piezas: 2},
    {articuloId: "12300010", piezas: 3},
    {articuloId: "12300020", subvariacionCodigo: "v-20-aaa", piezas: 1},
    {articuloId: "12300020", subvariacionCodigo: "v-20-bbb", piezas: 1},
  ]);
  assert.deepEqual(p.renglones, [
    {articuloId: "12300010", subvariacionCodigo: null, piezas: 5},
    {articuloId: "12300020", subvariacionCodigo: "v-20-aaa", piezas: 1},
    {articuloId: "12300020", subvariacionCodigo: "v-20-bbb", piezas: 1},
  ]);
});

test("normalizar: rechaza peticiones mal formadas", () => {
  const base = {movimientoId: "mov_12345678", direccion: "bodega_a_tienda",
    renglones: [{articuloId: "12300010", piezas: 1}]};
  assert.throws(() => et.normalizarPeticion(null), /identificador/);
  // «Aclarar un envío»: basta su id (y tiene que ser válido).
  assert.deepEqual(
      et.normalizarPeticion({movimientoId: "mov_12345678", anular: true}),
      {movimientoId: "mov_12345678", anular: true});
  assert.deepEqual(
      et.normalizarPeticion({...base, anular: true}),
      {movimientoId: base.movimientoId, anular: true});
  assert.throws(() => et.normalizarPeticion({movimientoId: "a b", anular: true}), /identificador/);
  // Solo `true` anula: cualquier otra cosa es un movimiento normal.
  assert.throws(() => et.normalizarPeticion({movimientoId: "mov_12345678", anular: "true"}), /de dónde a dónde/);
  assert.throws(() => et.normalizarPeticion({...base, movimientoId: "a b"}), /identificador/);
  assert.throws(() => et.normalizarPeticion({...base, direccion: "sumar"}), /de dónde a dónde/);
  assert.throws(() => et.normalizarPeticion({...base, renglones: []}), /nada que mover/);
  for (const piezas of [0, -1, 1.5, "2", 100001, NaN]) {
    assert.throws(
        () => et.normalizarPeticion({...base, renglones: [{articuloId: "12300010", piezas}]}),
        /entero mayor que 0/);
  }
  assert.throws(
      () => et.normalizarPeticion({...base, renglones: [{articuloId: "a/b", piezas: 1}]}),
      /sin código/);
  assert.throws(
      () => et.normalizarPeticion({...base, renglones: [{articuloId: "1", subvariacionCodigo: 5, piezas: 1}]}),
      /variación mal indicada/);
  const muchos = Array.from({length: 101}, (_, i) => ({articuloId: `a${i}`, piezas: 1}));
  assert.throws(() => et.normalizarPeticion({...base, renglones: muchos}), /Máximo 100/);
});

test("bodega → tienda sin variaciones: lo que sale de un lado entra al otro", () => {
  const arts = new Map([["12300010", simple()]]);
  const {renglones} = pedir([{articuloId: "12300010", piezas: 3}]);
  const plan = et.planearMovimiento(arts, renglones, "bodega_a_tienda", OTRA);
  assert.deepEqual(plan.faltantes, []);
  assert.deepEqual(plan.patches.get("12300010"), {
    cantidadBodegaSucursal: {S2: "7", S3: "7"},
    cantidadPorSucursal: {S2: "7", S3: "1"},
  });
  assert.deepEqual(plan.renglones, [{
    articuloId: "12300010", codigo: "12300010", nombre: "Metálico 1", piezas: 3,
    bodegaAntes: 10, bodegaDespues: 7, tiendaAntes: 4, tiendaDespues: 7,
  }]);
});

test("tienda → bodega regresa las piezas", () => {
  const arts = new Map([["12300010", simple()]]);
  const {renglones} = pedir([{articuloId: "12300010", piezas: 4}], "tienda_a_bodega");
  const plan = et.planearMovimiento(arts, renglones, "tienda_a_bodega", OTRA);
  assert.deepEqual(plan.patches.get("12300010"), {
    cantidadBodegaSucursal: {S2: "14", S3: "7"},
    cantidadPorSucursal: {S2: "0", S3: "1"},
  });
});

test("nunca cambia el total: bodega + tienda es igual antes y después", () => {
  for (const direccion of et.DIRECCIONES) {
    const arts = new Map([["a", simple()], ["b", conVariaciones()]]);
    const {renglones} = pedir([
      {articuloId: "a", piezas: 2},
      {articuloId: "b", subvariacionCodigo: "v-10-aaa", piezas: 1},
    ], direccion);
    const plan = et.planearMovimiento(arts, renglones, direccion, OTRA);
    assert.equal(plan.faltantes.length, 0);
    for (const r of plan.renglones) {
      assert.equal(r.bodegaAntes + r.tiendaAntes, r.bodegaDespues + r.tiendaDespues);
    }
  }
});

test("no se puede mover más de lo que hay en el origen, y no se escribe nada", () => {
  const arts = new Map([["a", simple()], ["b", simple({nombre: "Otro"})]]);
  const {renglones} = pedir([
    {articuloId: "a", piezas: 11},
    {articuloId: "b", piezas: 1},
  ]);
  const plan = et.planearMovimiento(arts, renglones, "bodega_a_tienda", OTRA);
  assert.equal(plan.patches.size, 0);
  assert.deepEqual(plan.renglones, []);
  assert.equal(plan.faltantes.length, 1);
  assert.equal(plan.faltantes[0].motivo, "sin-piezas");
  assert.equal(plan.faltantes[0].hay, 10);
  assert.match(et.mensajeFaltantes(plan.faltantes, "bodega_a_tienda"),
      /No se movió nada\. Metálico 1: en la bodega hay 10 y quieres mover 11\./);
});

test("sin dato de bodega es cero: no se puede sacar de ahí", () => {
  const arts = new Map([["a", {nombre: "Nuevo", cantidadPorSucursal: {S2: "3"}}]]);
  const {renglones} = pedir([{articuloId: "a", piezas: 1}]);
  const plan = et.planearMovimiento(arts, renglones, "bodega_a_tienda", OTRA);
  assert.equal(plan.faltantes[0].hay, 0);
});

test("variación: mueve la variación y conserva sus demás campos y las otras", () => {
  const arts = new Map([["b", conVariaciones()]]);
  const {renglones} = pedir([{articuloId: "b", subvariacionCodigo: "v-10-aaa", piezas: 4}]);
  const plan = et.planearMovimiento(arts, renglones, "bodega_a_tienda", OTRA);
  const patch = plan.patches.get("b");
  assert.deepEqual(Object.keys(patch), ["subvariaciones"]);
  assert.deepEqual(patch.subvariaciones[0], {
    codigo: "v-10-aaa", nombre: "m1", codigoBarras: "12300011", imagenUrl: "x",
    cantidad: "5", cantidadPorSucursal: {S2: "6"}, cantidadBodegaSucursal: {S2: "2", S1: "3"},
  });
  assert.deepEqual(patch.subvariaciones[1],
      {codigo: "v-10-bbb", nombre: "m2", codigoBarras: "12300012"});
  assert.equal(plan.renglones[0].codigo, "12300011");
  assert.equal(plan.renglones[0].nombre, "Goku — m1");
  assert.equal(plan.renglones[0].subvariacionCodigo, "v-10-aaa");
});

test("sucursal default: la tienda es `cantidad` y el padre guarda la suma", () => {
  const arts = new Map([["a", simple({cantidadBodegaSucursal: {S1: "5"}})], ["b", conVariaciones()]]);
  const {renglones} = pedir([
    {articuloId: "a", piezas: 2},
    {articuloId: "b", subvariacionCodigo: "v-10-aaa", piezas: 3},
  ]);
  const plan = et.planearMovimiento(arts, renglones, "bodega_a_tienda", DEFAULT);
  assert.deepEqual(plan.patches.get("a"),
      {cantidadBodegaSucursal: {S1: "3"}, cantidad: "11"});
  const b = plan.patches.get("b");
  assert.equal(b.subvariaciones[0].cantidad, "8");
  assert.deepEqual(b.subvariaciones[0].cantidadBodegaSucursal, {S2: "6", S1: "0"});
  assert.equal(b.cantidad, "8");
});

test("artículo con variaciones sin decir cuál, variación o artículo que ya no existe", () => {
  const arts = new Map([["b", conVariaciones()], ["x", null]]);
  const {renglones} = pedir([
    {articuloId: "b", piezas: 1},
    {articuloId: "b", subvariacionCodigo: "v-10-zzz", piezas: 1},
    {articuloId: "x", piezas: 1},
  ]);
  const plan = et.planearMovimiento(arts, renglones, "bodega_a_tienda", OTRA);
  assert.deepEqual(plan.faltantes.map((f) => f.motivo),
      ["elige-variacion", "variacion-inexistente", "articulo-inexistente"]);
  assert.equal(plan.patches.size, 0);
  const msg = et.mensajeFaltantes(plan.faltantes, "bodega_a_tienda");
  assert.match(msg, /tiene variaciones, escanea la que mueves/);
  assert.match(msg, /ya no existe/);
});

test("el mensaje resume cuando faltan muchos", () => {
  const faltantes = Array.from({length: 8}, (_, i) =>
    ({motivo: "sin-piezas", nombre: `A${i}`, hay: 0, piezas: 1}));
  assert.match(et.mensajeFaltantes(faltantes, "tienda_a_bodega"), /en la tienda hay 0.*\(y 3 más\)\.$/);
});
