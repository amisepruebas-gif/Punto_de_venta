"use strict";
// node --test test/  (Node 22, sin dependencias)
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  resolverUbicacionStock,
  agruparLineas,
  planearDescuento,
  aplicarStockVentaEnTx,
} = require("../lib/stockVentaOffline");

const DEFAULT = {sucursalId: "centro", esDefault: true};
const OTRA = {sucursalId: "norte", esDefault: false};

const ART = "negocios_web_new_version/n1/articulos_n_web_new_version";
const VENTA = "negocios_web_new_version/n1/sucursales_data_web_new_version/" +
  "centro/ventas_n_web_new_version/2026/10/24/items/v1";
const OFFLINE = "OFFLINE-nodo01-1761300000000";

// Firestore mínimo en memoria. La tx imita al Admin SDK: todas las lecturas
// antes que las escrituras, que se aplican juntas al final; `update` exige
// que el doc exista.
function crearDb(docs) {
  const store = new Map(
      Object.entries(docs).map(([path, d]) => [path, structuredClone(d)]));
  const ref = (path) => ({path, id: path.split("/").pop()});
  async function correrTx(fn) {
    const escrituras = [];
    const leer = (r) => {
      assert.equal(escrituras.length, 0, "lectura después de una escritura");
      const d = store.get(r.path);
      return {id: r.id, exists: d !== undefined, data: () => structuredClone(d)};
    };
    const tx = {
      get: async (r) => leer(r),
      getAll: async (...rs) => rs.map(leer),
      update: (r, patch) => escrituras.push([r.path, structuredClone(patch)]),
    };
    const res = await fn(tx);
    for (const [path, patch] of escrituras) {
      assert.ok(store.has(path), `update sobre un doc inexistente: ${path}`);
      store.set(path, {...store.get(path), ...patch});
    }
    return res;
  }
  return {ref, correrTx, doc: (path) => store.get(path)};
}

function aplicar(db, ubicacion = DEFAULT) {
  return db.correrTx((tx) => aplicarStockVentaEnTx(tx, {
    ventaRef: db.ref(VENTA),
    articuloRef: (id) => db.ref(`${ART}/${id}`),
    ubicacion,
  }));
}

const linea = (id, cantidad, extra = {}) =>
  ({id, cantidad: String(cantidad), precio: "10", nombrePublico: id, ...extra});
const ventaOffline = (articulos, extra = {}) =>
  ({numeroDeVenta: OFFLINE, apartado: "0", articulos, ...extra});

test("resolverUbicacionStock: sucursalDefaultId o el primer id alfabético", () => {
  assert.deepEqual(resolverUbicacionStock("norte", "centro", ["centro", "norte"]),
      {sucursalId: "norte", esDefault: false});
  assert.equal(resolverUbicacionStock("centro", "centro", []).esDefault, true);
  // Sin default fijada cuenta la propia sucursal, aunque no venga en la lista.
  assert.equal(resolverUbicacionStock("b", undefined, ["c", "d"]).esDefault, true);
  assert.equal(resolverUbicacionStock("d", undefined, ["b", "c"]).esDefault, false);
  assert.equal(resolverUbicacionStock("unica", undefined, []).esDefault, true);
});

test("default: descuenta `cantidad` del padre y no toca el mapa", async () => {
  const db = crearDb({
    [`${ART}/12300001`]: {cantidad: "10", cantidadPorSucursal: {norte: "4"}},
    [VENTA]: ventaOffline([linea("12300001", 3)]),
  });
  const r = await aplicar(db);
  assert.equal(db.doc(`${ART}/12300001`).cantidad, "7");
  assert.deepEqual(db.doc(`${ART}/12300001`).cantidadPorSucursal, {norte: "4"});
  assert.equal(r.sobreventa, false);
  assert.equal(db.doc(VENTA).stockAplicado, true);
  assert.equal(db.doc(VENTA).sobreventa, undefined);
});

test("otra sucursal: descuenta `cantidadPorSucursal[sid]` y conserva el resto",
    async () => {
      const db = crearDb({
        [`${ART}/12300001`]: {cantidad: "10", cantidadPorSucursal: {norte: "4", sur: "6"}},
        [VENTA]: ventaOffline([linea("12300001", 3)]),
      });
      await aplicar(db, OTRA);
      assert.equal(db.doc(`${ART}/12300001`).cantidad, "10");
      assert.deepEqual(db.doc(`${ART}/12300001`).cantidadPorSucursal,
          {norte: "1", sur: "6"});
    });

test("subvariación en la default: baja la sub y también el padre", async () => {
  const db = crearDb({
    [`${ART}/12300002`]: {
      cantidad: "8",
      subvariaciones: [
        {codigo: "v-02-AAA", nombre: "Rojo", cantidad: "5"},
        {codigo: "v-02-BBB", nombre: "Azul", cantidad: "3"},
      ],
    },
    [VENTA]: ventaOffline([linea("12300002", 2, {subvariacionCodigo: "v-02-AAA"})]),
  });
  await aplicar(db);
  const art = db.doc(`${ART}/12300002`);
  assert.equal(art.cantidad, "6");
  assert.deepEqual(art.subvariaciones, [
    {codigo: "v-02-AAA", nombre: "Rojo", cantidad: "3"},
    {codigo: "v-02-BBB", nombre: "Azul", cantidad: "3"},
  ]);
});

test("subvariación en otra sucursal: solo cambia el mapa de la sub", () => {
  const data = {
    cantidad: "8",
    cantidadPorSucursal: {norte: "9"},
    subvariaciones: [{
      codigo: "v-02-AAA", nombre: "Rojo", cantidad: "5",
      cantidadPorSucursal: {norte: "4", sur: "1"},
    }],
  };
  const {patches} = planearDescuento(new Map([["12300002", data]]),
      agruparLineas([linea("12300002", 1, {subvariacionCodigo: "v-02-AAA"})]), OTRA);
  // El padre no se escribe: fuera de la default no es la suma de sus subs.
  assert.deepEqual(patches.get("12300002"), {
    subvariaciones: [{
      codigo: "v-02-AAA", nombre: "Rojo", cantidad: "5",
      cantidadPorSucursal: {norte: "3", sur: "1"},
    }],
  });
});

test("sobreventa: recorta a 0 y marca la venta", async () => {
  const db = crearDb({
    [`${ART}/12300001`]: {cantidad: "2"},
    [`${ART}/12300002`]: {
      cantidad: "4",
      subvariaciones: [{codigo: "v-02-AAA", nombre: "Rojo", cantidad: "1"}],
    },
    [VENTA]: ventaOffline([
      linea("12300001", 5),
      linea("12300002", 3, {subvariacionCodigo: "v-02-AAA"}),
    ]),
  });
  const r = await aplicar(db);
  assert.equal(r.sobreventa, true);
  assert.equal(db.doc(VENTA).sobreventa, true);
  assert.equal(db.doc(`${ART}/12300001`).cantidad, "0");
  assert.equal(db.doc(`${ART}/12300002`).subvariaciones[0].cantidad, "0");
  // Igual que el POS: el padre baja lo vendido (recortado a 0), no lo que
  // tenía la sub.
  assert.equal(db.doc(`${ART}/12300002`).cantidad, "1");
});

test("agruparLineas suma filas repetidas y salta lo que no mueve stock", () => {
  assert.deepEqual(agruparLineas([
    linea("12300001", 1),
    linea("12300001", 2),
    linea("12300001", 1, {subvariacionCodigo: "v-01-AAA"}),
    linea("12300001", 1, {subvariacionCodigo: ""}),
    linea("12300003", "x"),
    linea("00000000", 1),
    linea("00000000", 1, {giftCard: true}),
    linea("12300004", 1, {giftCard: true}),
    linea("123/0005", 1),
    linea("", 1),
  ]), [
    {articuloId: "12300001", subvariacionCodigo: null, cantidad: 4},
    {articuloId: "12300001", subvariacionCodigo: "v-01-AAA", cantidad: 1},
    // Cantidad no numérica = 0, como en el POS.
    {articuloId: "12300003", subvariacionCodigo: null, cantidad: 0},
  ]);
  assert.deepEqual(agruparLineas(undefined), []);
});

test("regalo y no registrados: no tocan artículos pero marcan la venta",
    async () => {
      const db = crearDb({
        [`${ART}/12300004`]: {cantidad: "3"},
        [VENTA]: ventaOffline([
          linea("00000000", 1),
          linea("00000000", 1, {giftCard: true}),
          linea("12300004", 1, {giftCard: true}),
        ]),
      });
      const r = await aplicar(db);
      assert.equal(r.patches.size, 0);
      assert.equal(db.doc(`${ART}/12300004`).cantidad, "3");
      assert.equal(db.doc(VENTA).stockAplicado, true);
    });

test("una venta que cierra un apartado no descuenta", async () => {
  const db = crearDb({
    [`${ART}/12300001`]: {cantidad: "5"},
    [VENTA]: ventaOffline([linea("12300001", 2)], {apartado: "1", idApartado: "ap1"}),
  });
  const r = await aplicar(db);
  assert.equal(r.patches.size, 0);
  assert.equal(db.doc(`${ART}/12300001`).cantidad, "5");
  assert.equal(db.doc(VENTA).stockAplicado, true);

  // Sin idApartado no cierra nada: descuenta, como el POS.
  const db2 = crearDb({
    [`${ART}/12300001`]: {cantidad: "5"},
    [VENTA]: ventaOffline([linea("12300001", 2)], {apartado: "1"}),
  });
  await aplicar(db2);
  assert.equal(db2.doc(`${ART}/12300001`).cantidad, "3");
});

test("idempotente: un segundo disparo no vuelve a descontar", async () => {
  const db = crearDb({
    [`${ART}/12300001`]: {cantidad: "10"},
    [VENTA]: ventaOffline([linea("12300001", 3)]),
  });
  assert.ok(await aplicar(db));
  assert.equal(await aplicar(db), null);
  assert.equal(db.doc(`${ART}/12300001`).cantidad, "7");
});

test("ya renumerada (número OFFLINE en numeroDeVentaOffline): descuenta una vez",
    async () => {
      const db = crearDb({
        [`${ART}/12300001`]: {cantidad: "10"},
        [VENTA]: ventaOffline([linea("12300001", 3)],
            {numeroDeVenta: "15", numeroDeVentaOffline: OFFLINE}),
      });
      assert.ok(await aplicar(db));
      assert.equal(await aplicar(db), null);
      assert.equal(db.doc(`${ART}/12300001`).cantidad, "7");
    });

test("una venta online nunca descuenta (ya lo hizo el POS)", async () => {
  const db = crearDb({
    [`${ART}/12300001`]: {cantidad: "10"},
    [VENTA]: {numeroDeVenta: "15", apartado: "0", articulos: [linea("12300001", 3)]},
  });
  assert.equal(await aplicar(db), null);
  assert.equal(db.doc(`${ART}/12300001`).cantidad, "10");
  assert.equal(db.doc(VENTA).stockAplicado, undefined);
});

test("artículo o variación que ya no existe: se omite y el resto descuenta",
    async () => {
      const db = crearDb({
        [`${ART}/12300001`]: {cantidad: "10"},
        [`${ART}/12300002`]: {
          cantidad: "4",
          subvariaciones: [{codigo: "v-02-AAA", nombre: "Rojo", cantidad: "4"}],
        },
        [VENTA]: ventaOffline([
          linea("12399999", 1),
          linea("12300002", 1, {subvariacionCodigo: "v-02-ZZZ"}),
          linea("12300001", 2),
        ]),
      });
      const r = await aplicar(db);
      assert.equal(db.doc(`${ART}/12300001`).cantidad, "8");
      assert.equal(db.doc(`${ART}/12300002`).cantidad, "4");
      assert.deepEqual(r.omitidas.map((o) => [o.articuloId, o.motivo]), [
        ["12399999", "articulo-inexistente"],
        ["12300002", "variacion-inexistente"],
      ]);
      assert.equal(db.doc(VENTA).stockAplicado, true);
    });

test("venta borrada antes del trigger: no hace nada", async () => {
  const db = crearDb({[`${ART}/12300001`]: {cantidad: "10"}});
  assert.equal(await aplicar(db), null);
  assert.equal(db.doc(`${ART}/12300001`).cantidad, "10");
});
