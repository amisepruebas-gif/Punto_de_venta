"use strict";
// node --test test/  (Node 22, sin dependencias)
const test = require("node:test");
const assert = require("node:assert/strict");
const {correrPasos} = require("../lib/reintento");

const HORA = 60 * 60 * 1000;
const AHORA = Date.parse("2026-10-24T18:00:00.000Z");
const opts = (edadMs) => ({
  eventTime: new Date(AHORA - edadMs).toISOString(),
  maxMs: 12 * HORA,
  ahoraMs: AHORA,
});
const falla = (msg) => async () => {
  throw new Error(msg);
};

test("sin fallas no pide reintento", async () => {
  const hechos = [];
  const r = await correrPasos([
    ["renumerar", async () => hechos.push("renumerar")],
    ["stock", async () => hechos.push("stock")],
  ], opts(0));
  assert.deepEqual(hechos, ["renumerar", "stock"]);
  assert.deepEqual(r.fallas, []);
  assert.equal(r.reintentar, false);
});

test("si un paso falla, los siguientes corren igual y se pide reintento", async () => {
  const hechos = [];
  const r = await correrPasos([
    ["renumerar", falla("ABORTED")],
    ["stock", async () => hechos.push("stock")],
  ], opts(5 * 60 * 1000));
  assert.deepEqual(hechos, ["stock"]);
  assert.deepEqual(r.fallas.map((f) => [f.nombre, f.err.message]), [["renumerar", "ABORTED"]]);
  assert.equal(r.reintentar, true);
});

test("los pasos corren en orden, uno tras otro", async () => {
  const hechos = [];
  const lento = (nombre, ms) => () =>
    new Promise((res) => setTimeout(() => res(hechos.push(nombre)), ms));
  await correrPasos([["a", lento("a", 20)], ["b", lento("b", 0)]], opts(0));
  assert.deepEqual(hechos, ["a", "b"]);
});

test("con el evento viejo deja de pedir reintento", async () => {
  const r = await correrPasos([["stock", falla("DEADLINE")]], opts(12 * HORA));
  assert.equal(r.reintentar, false);
  assert.equal(r.edadMs, 12 * HORA);
  assert.equal(r.fallas.length, 1);
  assert.equal((await correrPasos([["stock", falla("x")]], opts(12 * HORA - 1))).reintentar,
      true);
});

test("un eventTime ilegible cuenta como reciente", async () => {
  const r = await correrPasos([["stock", falla("x")]],
      {eventTime: undefined, maxMs: 12 * HORA, ahoraMs: AHORA});
  assert.equal(r.reintentar, true);
  assert.equal(r.edadMs, 0);
});
