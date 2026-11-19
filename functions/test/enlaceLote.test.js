"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const enlace = require("../lib/enlaceLote");
const acceso = require("../lib/accesoCaja");

const AHORA = 1_800_000_000_000;
const SECRETO = "A".repeat(43);
const armar = (extra = {}) => ({tipo: "armar", activo: true, gen: 0, letra: "A", ...extra});
const fotos = (extra = {}) => ({
  tipo: "recibir", activo: true, gen: 0, resurtidoId: "L261116-A1", sucursalId: "S1",
  creadoEnMs: AHORA - 60_000, ...extra,
});

test("entradaValida: formato de negocio, enlace y secreto", () => {
  const ok = {negocioId: "amise", enlaceId: "AbC123xyz", secreto: SECRETO};
  assert.equal(enlace.entradaValida(ok), true);
  assert.equal(enlace.entradaValida({...ok, secreto: "corto"}), false);
  assert.equal(enlace.entradaValida({...ok, secreto: SECRETO + "A"}), false);
  assert.equal(enlace.entradaValida({...ok, secreto: 123}), false);
  assert.equal(enlace.entradaValida({...ok, enlaceId: "a/b"}), false);
  assert.equal(enlace.entradaValida({...ok, negocioId: ""}), false);
  assert.equal(enlace.entradaValida({...ok, negocioId: "x".repeat(65)}), false);
  assert.equal(enlace.entradaValida(null), false);
  assert.equal(enlace.entradaValida({}), false);
});

test("armar: entra un teléfono, sin vencimiento", () => {
  assert.deepEqual(enlace.decidirCanje(armar(), AHORA), {ok: true, venceMs: enlace.SIN_VENCIMIENTO_MS});
  assert.ok(enlace.SIN_VENCIMIENTO_MS > AHORA);
});

test("armar: un segundo teléfono ya no entra; renovado (canjes 0) sí", () => {
  assert.deepEqual(enlace.decidirCanje(armar({canjes: 1}), AHORA), {ok: false, motivo: "agotado"});
  assert.equal(enlace.decidirCanje(armar({canjes: 0, gen: 1}), AHORA).ok, true);
});

test("apagado, sin letra o de tipo raro: no entra", () => {
  assert.deepEqual(enlace.decidirCanje(armar({activo: false}), AHORA), {ok: false, motivo: "apagado"});
  assert.deepEqual(enlace.decidirCanje(armar({activo: "true"}), AHORA), {ok: false, motivo: "apagado"});
  assert.deepEqual(enlace.decidirCanje(armar({letra: undefined}), AHORA), {ok: false, motivo: "no_sirve"});
  assert.deepEqual(enlace.decidirCanje(armar({letra: "a1"}), AHORA), {ok: false, motivo: "no_sirve"});
  assert.deepEqual(enlace.decidirCanje({tipo: "admin", activo: true}, AHORA), {ok: false, motivo: "no_sirve"});
  assert.deepEqual(enlace.decidirCanje(null, AHORA), {ok: false, motivo: "no_sirve"});
});

test("fotos: 5 minutos para entrar y 30 de sesión desde que entra", () => {
  assert.deepEqual(enlace.decidirCanje(fotos(), AHORA), {
    ok: true, venceMs: AHORA + 30 * 60_000,
  });
  const justo = fotos({creadoEnMs: AHORA - enlace.RECIBIR_VENTANA_MS});
  assert.equal(enlace.decidirCanje(justo, AHORA).ok, true);
  const tarde = fotos({creadoEnMs: AHORA - enlace.RECIBIR_VENTANA_MS - 1});
  assert.deepEqual(enlace.decidirCanje(tarde, AHORA), {ok: false, motivo: "tarde"});
});

test("fotos: hasta 3 teléfonos por código", () => {
  assert.equal(enlace.decidirCanje(fotos({canjes: 2}), AHORA).ok, true);
  assert.deepEqual(enlace.decidirCanje(fotos({canjes: 3}), AHORA), {ok: false, motivo: "agotado"});
});

test("fotos: sin hora de creación, del futuro, o sin lote: no entra", () => {
  assert.equal(enlace.decidirCanje(fotos({creadoEnMs: 0}), AHORA).motivo, "no_sirve");
  assert.equal(enlace.decidirCanje(fotos({creadoEnMs: undefined}), AHORA).motivo, "no_sirve");
  assert.equal(enlace.decidirCanje(fotos({creadoEnMs: AHORA + 10 * 60_000}), AHORA).motivo, "no_sirve");
  assert.equal(enlace.decidirCanje(fotos({resurtidoId: ""}), AHORA).motivo, "no_sirve");
  assert.equal(enlace.decidirCanje(fotos({sucursalId: undefined}), AHORA).motivo, "no_sirve");
});

test("entradaValida: el número del dispositivo es opcional, pero con formato", () => {
  const ok = {negocioId: "amise", enlaceId: "AbC123xyz", secreto: SECRETO};
  assert.equal(enlace.entradaValida({...ok, dispositivo: "B".repeat(43)}), true);
  assert.equal(enlace.entradaValida({...ok, dispositivo: null}), true);
  assert.equal(enlace.entradaValida({...ok, dispositivo: "corto"}), false);
  assert.equal(enlace.entradaValida({...ok, dispositivo: 5}), false);
});

const DISP = acceso.hashSecreto("D".repeat(43));
const OTRO = acceso.hashSecreto("E".repeat(43));
const conSesion = (base, extra = {}) => ({
  ...base,
  canjes: 1,
  sesiones: {enl_E1_aaaa: {fechaMs: AHORA - 1000, gen: base.gen || 0, dispositivo: DISP, ...extra}},
});

test("armar: el MISMO teléfono vuelve a entrar sin gastar otra entrada", () => {
  // Se perdió la respuesta o falló el inicio de sesión: reintenta.
  assert.deepEqual(enlace.decidirCanje(conSesion(armar()), AHORA, DISP), {
    ok: true, venceMs: enlace.SIN_VENCIMIENTO_MS, uid: "enl_E1_aaaa",
  });
  // Otro teléfono con el mismo enlace sigue sin entrar.
  assert.deepEqual(enlace.decidirCanje(conSesion(armar()), AHORA, OTRO), {ok: false, motivo: "agotado"});
  // Sin número de dispositivo (versión vieja del teléfono): como antes.
  assert.deepEqual(enlace.decidirCanje(conSesion(armar()), AHORA, ""), {ok: false, motivo: "agotado"});
});

test("armar: renovado (gen nueva) el mismo teléfono entra como nuevo; apagado no entra", () => {
  const renovado = {...conSesion(armar()), gen: 1, canjes: 0};
  assert.deepEqual(enlace.decidirCanje(renovado, AHORA, DISP), {ok: true, venceMs: enlace.SIN_VENCIMIENTO_MS});
  assert.deepEqual(enlace.decidirCanje({...conSesion(armar()), activo: false}, AHORA, DISP), {
    ok: false, motivo: "apagado",
  });
});

test("fotos: el mismo teléfono recupera su sesión de 30 minutos, no una nueva", () => {
  const vence = AHORA + 10 * 60_000;
  // Ya pasaron los 5 minutos para entrar, pero este teléfono ya había entrado.
  const viejo = conSesion(fotos({creadoEnMs: AHORA - 20 * 60_000}), {venceMs: vence});
  assert.deepEqual(enlace.decidirCanje(viejo, AHORA, DISP), {ok: true, venceMs: vence, uid: "enl_E1_aaaa"});
  assert.deepEqual(enlace.decidirCanje(viejo, vence, DISP), {ok: false, motivo: "tarde"});
  assert.deepEqual(enlace.decidirCanje(viejo, AHORA, OTRO), {ok: false, motivo: "tarde"});
});

const impresora = (extra = {}) => ({tipo: "imprimir", activo: true, gen: 0, nombre: "Taller", ...extra});

test("imprimir: entra UNA computadora, sin vencimiento; la misma reintenta sin gastar", () => {
  assert.deepEqual(enlace.decidirCanje(impresora(), AHORA, DISP), {
    ok: true, venceMs: enlace.SIN_VENCIMIENTO_MS,
  });
  assert.deepEqual(enlace.decidirCanje(conSesion(impresora()), AHORA, DISP), {
    ok: true, venceMs: enlace.SIN_VENCIMIENTO_MS, uid: "enl_E1_aaaa",
  });
  assert.deepEqual(enlace.decidirCanje(conSesion(impresora()), AHORA, OTRO), {
    ok: false, motivo: "agotado",
  });
  assert.deepEqual(enlace.decidirCanje(impresora({activo: false}), AHORA, DISP), {
    ok: false, motivo: "apagado",
  });
});

test("imprimir: la sucursal es opcional, pero si viene debe ser un id", () => {
  assert.equal(enlace.decidirCanje(impresora({sucursalId: "S2"}), AHORA).ok, true);
  assert.equal(enlace.decidirCanje(impresora({sucursalId: "a/b"}), AHORA).motivo, "no_sirve");
  assert.equal(enlace.decidirCanje(impresora({sucursalId: 5}), AHORA).motivo, "no_sirve");
});

test("imprimir: claims sin letra ni lote; con sucursal si la tiene", () => {
  assert.deepEqual(enlace.claimsDeEnlace("amise", "I1", impresora(), 99), {
    role: "enlace", negocioId: "amise", enlaceId: "I1", tipo: "imprimir", gen: 0, vence: 99,
  });
  assert.deepEqual(enlace.claimsDeEnlace("amise", "I1", impresora({sucursalId: "S2"}), 99), {
    role: "enlace", negocioId: "amise", enlaceId: "I1", tipo: "imprimir", gen: 0, vence: 99,
    sucursalId: "S2",
  });
});

test("imprimir: los mensajes hablan de la computadora y de admin", () => {
  assert.match(enlace.mensajeDeMotivo("agotado", "imprimir"), /otra computadora/);
  assert.match(enlace.mensajeDeMotivo("apagado", "imprimir"), /impresora está apagada/);
  assert.match(enlace.mensajeDeMotivo("agotado", "armar"), /otro teléfono/);
  assert.match(enlace.mensajeDeMotivo("tarde", "imprimir"), /venció/);
});

const precio = (extra = {}) => ({tipo: "precio", activo: true, gen: 0, nombre: "Mostrador", ...extra});

test("precio: entra UN equipo, sin vencimiento; el mismo reintenta sin gastar", () => {
  assert.deepEqual(enlace.decidirCanje(precio(), AHORA, DISP), {
    ok: true, venceMs: enlace.SIN_VENCIMIENTO_MS,
  });
  assert.deepEqual(enlace.decidirCanje(conSesion(precio()), AHORA, DISP), {
    ok: true, venceMs: enlace.SIN_VENCIMIENTO_MS, uid: "enl_E1_aaaa",
  });
  assert.deepEqual(enlace.decidirCanje(conSesion(precio()), AHORA, OTRO), {
    ok: false, motivo: "agotado",
  });
  assert.deepEqual(enlace.decidirCanje(precio({canjes: 1}), AHORA, OTRO), {
    ok: false, motivo: "agotado",
  });
  assert.deepEqual(enlace.decidirCanje(precio({activo: false}), AHORA, DISP), {
    ok: false, motivo: "apagado",
  });
  // Renovado (gen nueva, canjes 0): entra como nuevo.
  assert.deepEqual(enlace.decidirCanje({...conSesion(precio()), gen: 1, canjes: 0}, AHORA, DISP), {
    ok: true, venceMs: enlace.SIN_VENCIMIENTO_MS,
  });
});

test("precio: no necesita letra, lote ni sucursal; sus claims solo dicen el tipo", () => {
  assert.equal(enlace.decidirCanje(precio({creadoEnMs: 0}), AHORA).ok, true);
  assert.deepEqual(enlace.claimsDeEnlace("amise", "P1", precio({letra: "Z", sucursalId: "S1"}), 99), {
    role: "enlace", negocioId: "amise", enlaceId: "P1", tipo: "precio", gen: 0, vence: 99,
  });
});

test("precio: los mensajes hablan de un equipo (teléfono o computadora)", () => {
  assert.match(enlace.mensajeDeMotivo("agotado", "precio"), /otro equipo/);
  assert.match(enlace.mensajeDeMotivo("apagado", "precio"), /apagado/);
  assert.match(enlace.mensajeDeMotivo("no_sirve", "precio"), /no sirve/);
});

test("claims: solo lo que las reglas leen, según el tipo", () => {
  assert.deepEqual(enlace.claimsDeEnlace("amise", "E1", armar({gen: 2}), 99), {
    role: "enlace", negocioId: "amise", enlaceId: "E1", tipo: "armar", gen: 2, vence: 99, letra: "A",
  });
  assert.deepEqual(enlace.claimsDeEnlace("amise", "F1", fotos(), 99), {
    role: "enlace", negocioId: "amise", enlaceId: "F1", tipo: "recibir", gen: 0, vence: 99,
    resurtidoId: "L261116-A1", sucursalId: "S1",
  });
});

test("mensajes: uno por motivo y uno genérico para lo desconocido", () => {
  assert.match(enlace.mensajeDeMotivo("apagado"), /apagado/);
  assert.match(enlace.mensajeDeMotivo("agotado"), /otro teléfono/);
  assert.match(enlace.mensajeDeMotivo("tarde"), /venció/);
  assert.equal(enlace.mensajeDeMotivo("loquesea"), enlace.mensajeDeMotivo("no_sirve"));
});

test("el secreto del cliente se compara como las llaves de las cajas (sha256 hex)", () => {
  const hash = acceso.hashSecreto(SECRETO);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(acceso.llaveCoincide(SECRETO, hash), true);
  assert.equal(acceso.llaveCoincide("B".repeat(43), hash), false);
  // Mismo sha256 que `hashSecretoEnlace` de shared (WebCrypto) para "abc".
  assert.equal(
      acceso.hashSecreto("abc"),
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});
