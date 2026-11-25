"use strict";
const {test} = require("node:test");
const assert = require("node:assert/strict");
const pm = require("../lib/preciosMayoreo");

const PRECIOS = {
  categorias: {llavero: {precio: 22, menudeo: 30}},
  subcategorias: {metalico: {precio: 28, menudeo: 40}},
};

// Un artículo registrado con la escalera: lleva `heredaPrecio`.
const art = (over = {}) => ({
  nombre: "Metálico 1",
  soloMayoreo: true,
  heredaPrecio: true,
  categoriaId: "llavero",
  subcategoriaId: "metalico",
  preciCompra: "8",
  cantidad: "3",
  precioVenta: "22",
  precioMenudeo: "30",
  ...over,
});

// Uno con precio propio, o de antes de la escalera: NO trae la marca.
const propio = (over = {}) => {
  const a = art(over);
  delete a.heredaPrecio;
  return a;
};

test("un nivel sirve solo con precio > 0 y menudeo mayor", () => {
  assert.equal(pm.nivelValido({precio: 22, menudeo: 30}), true);
  assert.equal(pm.nivelValido({precio: 22, menudeo: 22}), false);
  assert.equal(pm.nivelValido({precio: 0, menudeo: 5}), false);
  assert.equal(pm.nivelValido({precio: "22", menudeo: 30}), false);
  assert.equal(pm.nivelValido(null), false);
});

test("la subcategoría gana a la categoría", () => {
  assert.deepEqual(pm.resolverPrecioHeredado(art(), PRECIOS),
      {precio: 28, menudeo: 40, origen: "subcategoria"});
});

test("sin precio de subcategoría usa el de la categoría", () => {
  assert.deepEqual(
      pm.resolverPrecioHeredado(art({subcategoriaId: "acrilico"}), PRECIOS),
      {precio: 22, menudeo: 30, origen: "categoria"});
});

test("un precio de subcategoría inválido no tapa al de la categoría", () => {
  const precios = {...PRECIOS, subcategorias: {metalico: {precio: 28, menudeo: 10}}};
  assert.equal(pm.resolverPrecioHeredado(art(), precios).origen, "categoria");
});

test("sin precios no hay nada que heredar", () => {
  assert.equal(pm.resolverPrecioHeredado(art(), null), null);
  assert.equal(pm.resolverPrecioHeredado(art(), {}), null);
  assert.equal(
      pm.resolverPrecioHeredado(art({categoriaId: "pin", subcategoriaId: "x"}), PRECIOS),
      null);
});

test("solo heredan los de mayoreo marcados con heredaPrecio y sin zona", () => {
  assert.equal(pm.heredaPrecio(art()), true);
  assert.equal(pm.heredaPrecio(art({soloMayoreo: false})), false);
  assert.equal(pm.heredaPrecio(propio()), false);
  assert.equal(pm.heredaPrecio(art({heredaPrecio: false})), false);
  assert.equal(pm.heredaPrecio(art({heredaPrecio: "true"})), false);
  assert.equal(pm.heredaPrecio(art({zonaPrecioId: "llaveros"})), false);
  assert.equal(pm.heredaPrecio(null), false);
});

test("un artículo de antes de la escalera nunca pierde su precio", () => {
  // «Solo mayoreo» con categoría (que ahora tiene precio) pero sin la marca.
  const viejo = propio({precioVenta: "35", precioMenudeo: "45"});
  delete viejo.subcategoriaId;
  assert.equal(pm.calcularPatchPrecio(viejo, PRECIOS), null);
  assert.equal(pm.requiereVerificarPrecio(null, viejo), false);
  assert.equal(pm.requiereVerificarPrecio(viejo, {...viejo, precioVenta: "36"}), false);
  assert.equal(pm.requiereVerificarPrecio(viejo, {...viejo, subcategoriaId: "metalico"}), false);
});

test("el patch copia los dos precios y recalcula la utilidad", () => {
  assert.deepEqual(pm.calcularPatchPrecio(art(), PRECIOS), {
    precioVenta: "28",
    precioMenudeo: "40",
    utilidad: "20",
    utilidadTotal: "60",
  });
});

test("sin cambio no hay patch", () => {
  assert.equal(
      pm.calcularPatchPrecio(art({precioVenta: "28", precioMenudeo: "40"}), PRECIOS),
      null);
});

test("un artículo sin menudeo guardado sí recibe el patch", () => {
  const a = art({precioVenta: "28"});
  delete a.precioMenudeo;
  assert.equal(pm.calcularPatchPrecio(a, PRECIOS).precioMenudeo, "40");
});

test("con precio propio, con zona o sin precio en la escalera no se toca", () => {
  assert.equal(pm.calcularPatchPrecio(propio({precioVenta: "50", precioMenudeo: "65"}), PRECIOS), null);
  assert.equal(pm.calcularPatchPrecio(art({zonaPrecioId: "z"}), PRECIOS), null);
  assert.equal(pm.calcularPatchPrecio(art({soloMayoreo: false}), PRECIOS), null);
  assert.equal(
      pm.calcularPatchPrecio(art({categoriaId: "pin", subcategoriaId: "x"}), PRECIOS),
      null);
});

test("una venta (solo existencias) no pide verificar", () => {
  const antes = art();
  const despues = art({cantidad: "2", cantidadPorSucursal: {S2: "4"}});
  assert.equal(pm.requiereVerificarPrecio(antes, despues), false);
});

test("pide verificar al crear, al cambiar clasificación o precio, y al empezar a heredar", () => {
  assert.equal(pm.requiereVerificarPrecio(null, art()), true);
  assert.equal(pm.requiereVerificarPrecio(art(), art({subcategoriaId: "acrilico"})), true);
  assert.equal(pm.requiereVerificarPrecio(art(), art({categoriaId: "pin"})), true);
  assert.equal(pm.requiereVerificarPrecio(art(), art({precioVenta: "99"})), true);
  assert.equal(pm.requiereVerificarPrecio(art(), art({precioMenudeo: "99"})), true);
  assert.equal(pm.requiereVerificarPrecio(propio(), art()), true);
  assert.equal(pm.requiereVerificarPrecio(art({soloMayoreo: false}), art()), true);
});

test("no pide verificar si no hereda o si se borró", () => {
  assert.equal(pm.requiereVerificarPrecio(art(), propio({precioVenta: "50"})), false);
  assert.equal(pm.requiereVerificarPrecio(art(), null), false);
  assert.equal(pm.requiereVerificarPrecio(null, art({soloMayoreo: false})), false);
});
