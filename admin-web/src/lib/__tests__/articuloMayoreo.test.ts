import { describe, expect, it } from "vitest";
import {
  articulosFinales,
  camposPrecioMayoreo,
  indiceCodigosVariacion,
  leerExistenciasTienda,
  maxCodigoArticulos,
  nivelPrecioValido,
  nombrarVariaciones,
  nombreAutomaticoArticulo,
  planearMovimientoStock,
  repartirCodigosVariacion,
  resolverPrecioHeredado,
  resolverPrecioMayoreo,
  siguientesIdsArticulo,
  tieneExistencias,
  ubicacionPersistible,
  validarArticuloMayoreo,
  validarPrecioNivel,
  variacionesSinCodigo,
  type Articulo,
  type PreciosMayoreo,
  type UbicacionResuelta,
} from "@shared";

/**
 * Tests del registro de mayoreo (`shared/src/articuloMayoreo.ts`), de los
 * códigos de artículo final (`ids.ts`) y de la bodega de tienda
 * (`inventario.ts`, ubicación `bodegaSucursal`).
 */
function art(over: Partial<Articulo> = {}): Articulo {
  return {
    id: "12300010",
    nombre: "Metálico 1",
    sigla: "",
    referencia: "",
    codigo: "12300010",
    cantidad: "0",
    preciCompra: "8",
    precioVenta: "22",
    utilidad: "14",
    utilidadTotal: "0",
    fecha: "2026-11-24 10:00:00",
    soloMayoreo: true,
    categoriaId: "llavero",
    subcategoriaId: "metalico",
    ...over,
  };
}

const PRECIOS: PreciosMayoreo = {
  categorias: { llavero: { precio: 22, menudeo: 30 } },
  subcategorias: { metalico: { precio: 28, menudeo: 40 } },
};

describe("precios en escalera", () => {
  it("un nivel sirve solo con precio > 0 y menudeo mayor", () => {
    expect(nivelPrecioValido({ precio: 22, menudeo: 30 })).toBe(true);
    expect(nivelPrecioValido({ precio: 22, menudeo: 22 })).toBe(false);
    expect(nivelPrecioValido({ precio: 0, menudeo: 30 })).toBe(false);
    expect(nivelPrecioValido({ precio: "22", menudeo: 30 })).toBe(false);
    expect(nivelPrecioValido(undefined)).toBe(false);
  });

  it("la subcategoría gana a la categoría", () => {
    expect(resolverPrecioHeredado(art(), PRECIOS)).toEqual({
      precio: 28,
      menudeo: 40,
      origen: "subcategoria",
    });
  });

  it("sin precio de subcategoría usa el de la categoría", () => {
    expect(resolverPrecioHeredado(art({ subcategoriaId: "acrilico" }), PRECIOS)).toEqual({
      precio: 22,
      menudeo: 30,
      origen: "categoria",
    });
  });

  it("un precio de subcategoría inválido no tapa al de la categoría", () => {
    const precios: PreciosMayoreo = {
      ...PRECIOS,
      subcategorias: { metalico: { precio: 28, menudeo: 20 } },
    };
    expect(resolverPrecioHeredado(art(), precios)?.origen).toBe("categoria");
  });

  it("sin precios en ningún nivel no hay precio", () => {
    expect(resolverPrecioHeredado(art({ categoriaId: "pin", subcategoriaId: "x" }), PRECIOS)).toBeNull();
    expect(resolverPrecioHeredado(art(), null)).toBeNull();
  });

  it("el precio propio del artículo gana a todo", () => {
    expect(
      resolverPrecioMayoreo(
        art({ precioPropio: true, precioVenta: "50", precioMenudeo: "65" }),
        PRECIOS,
      ),
    ).toEqual({ precio: 50, menudeo: 65, origen: "articulo" });
  });

  it("un precio propio mal capturado no vale", () => {
    expect(
      resolverPrecioMayoreo(
        art({ precioPropio: true, precioVenta: "50", precioMenudeo: "50" }),
        PRECIOS,
      ),
    ).toBeNull();
  });

  it("campos que se copian al artículo, con la utilidad", () => {
    expect(
      camposPrecioMayoreo({ precio: 28, menudeo: 40 }, { preciCompra: "8", cantidad: "3" }),
    ).toEqual({
      precioVenta: "28",
      precioMenudeo: "40",
      utilidad: "20",
      utilidadTotal: "60",
    });
  });

  it("valida los dos precios de un nivel", () => {
    expect(validarPrecioNivel("", "30")).toMatch(/Falta el precio de mayoreo/);
    expect(validarPrecioNivel("0", "30")).toMatch(/mayor que 0/);
    expect(validarPrecioNivel("22", "")).toMatch(/Falta el precio menudeo/);
    expect(validarPrecioNivel("22", "22")).toMatch(/debe ser mayor/);
    expect(validarPrecioNivel("22", "30")).toBeNull();
  });
});

describe("nombres automáticos", () => {
  it("las variaciones sin nombre reciben m1, m2…", () => {
    expect(
      nombrarVariaciones([{ nombre: "" }, { nombre: "  " }, { nombre: "" }]).map((s) => s.nombre),
    ).toEqual(["m1", "m2", "m3"]);
  });

  it("no repite los que ya existen y respeta los escritos", () => {
    expect(
      nombrarVariaciones([
        { nombre: "m1" },
        { nombre: " Rojo " },
        { nombre: "M4" },
        { nombre: "" },
        { nombre: "" },
      ]).map((s) => s.nombre),
    ).toEqual(["m1", "Rojo", "M4", "m5", "m6"]);
  });

  it("conserva los demás campos de la variación", () => {
    const [v] = nombrarVariaciones([{ nombre: "", codigo: "v-10-abc" }]);
    expect(v).toEqual({ nombre: "m1", codigo: "v-10-abc" });
  });

  it("artículo sin nombre: subcategoría y siguiente número", () => {
    expect(nombreAutomaticoArticulo("Metálico", [])).toBe("Metálico 1");
    expect(
      nombreAutomaticoArticulo("Metálico", ["metalico 1", "Metálico 7", "Metálico rojo", "Acrílico 9"]),
    ).toBe("Metálico 8");
  });
});

describe("validarArticuloMayoreo", () => {
  const base = {
    categoriaId: "llavero",
    subcategoriaId: "metalico",
    tieneVariaciones: false,
    variaciones: 0,
    precioPropio: false,
    precio: "",
    menudeo: "",
  };

  it("pide categoría y subcategoría", () => {
    expect(validarArticuloMayoreo({ ...base, categoriaId: "" }, PRECIOS)).toMatch(/categoría/);
    expect(validarArticuloMayoreo({ ...base, subcategoriaId: "" }, PRECIOS)).toMatch(/subcategoría/);
  });

  it("con variaciones pide al menos una", () => {
    expect(validarArticuloMayoreo({ ...base, tieneVariaciones: true }, PRECIOS)).toMatch(
      /al menos una variación/,
    );
    expect(
      validarArticuloMayoreo({ ...base, tieneVariaciones: true, variaciones: 2 }, PRECIOS),
    ).toBeNull();
  });

  it("sin precio en la categoría ni propio no deja guardar", () => {
    expect(
      validarArticuloMayoreo({ ...base, categoriaId: "pin", subcategoriaId: "esmalte" }, PRECIOS),
    ).toMatch(/todavía no tiene precio/);
  });

  it("con precio propio valida ese precio", () => {
    expect(
      validarArticuloMayoreo(
        { ...base, categoriaId: "pin", subcategoriaId: "esmalte", precioPropio: true, precio: "15", menudeo: "20" },
        PRECIOS,
      ),
    ).toBeNull();
    expect(
      validarArticuloMayoreo({ ...base, precioPropio: true, precio: "15", menudeo: "10" }, PRECIOS),
    ).toMatch(/debe ser mayor/);
  });
});

describe("artículos finales y códigos", () => {
  const conVariaciones = art({
    nombre: "Goku",
    subvariaciones: [
      { codigo: "v-10-aaa", nombre: "m1", codigoBarras: "12300011" },
      { codigo: "v-10-bbb", nombre: "m2" },
    ],
  });

  it("sin variaciones el artículo final es el propio artículo", () => {
    expect(articulosFinales(art()).map((f) => [f.codigo, f.nombre])).toEqual([
      ["12300010", "Metálico 1"],
    ]);
  });

  it("con variaciones, una por cada una con su código", () => {
    expect(articulosFinales(conVariaciones).map((f) => [f.codigo, f.nombre])).toEqual([
      ["12300011", "Goku — m1"],
      ["", "Goku — m2"],
    ]);
  });

  it("índice de códigos de variación", () => {
    const indice = indiceCodigosVariacion([art(), conVariaciones]);
    expect([...indice.keys()]).toEqual(["12300011"]);
    expect(indice.get("12300011")?.subvariacion.codigo).toBe("v-10-aaa");
  });

  it("reparte códigos solo a las que no tienen", () => {
    expect(variacionesSinCodigo(conVariaciones.subvariaciones!)).toBe(1);
    expect(
      repartirCodigosVariacion(conVariaciones.subvariaciones!, ["12300012"]).map(
        (s) => s.codigoBarras,
      ),
    ).toEqual(["12300011", "12300012"]);
    expect(() => repartirCodigosVariacion(conVariaciones.subvariaciones!, [])).toThrow(/Faltan códigos/);
  });

  it("aparta ids seguidos", () => {
    expect(siguientesIdsArticulo("12300012", 3)).toEqual(["12300013", "12300014", "12300015"]);
    expect(siguientesIdsArticulo(null, 2)).toEqual(["12300001", "12300002"]);
    expect(siguientesIdsArticulo("12300012", 0)).toEqual([]);
  });

  it("el mayor código usado cuenta también los de las variaciones", () => {
    expect(
      maxCodigoArticulos([
        { id: "12300010" },
        { id: "12300002", subvariaciones: [{ codigoBarras: "12300040" }, {}] },
        { id: "legacy-x" },
      ]),
    ).toBe(12300040);
    expect(maxCodigoArticulos([])).toBe(0);
  });
});

describe("bodega de tienda (ubicación bodegaSucursal)", () => {
  const BODEGA_S2: UbicacionResuelta = { tipo: "bodegaSucursal", sucursalId: "S2" };

  it("sin variaciones: escribe solo cantidadBodegaSucursal y conserva otras tiendas", () => {
    const plan = planearMovimientoStock(
      art({ cantidadBodegaSucursal: { S2: "5", S3: "9" }, cantidadPorSucursal: { S2: "4" } }),
      BODEGA_S2,
      3,
    );
    expect(plan).toEqual({
      patch: { cantidadBodegaSucursal: { S2: "8", S3: "9" } },
      cantidadAnterior: 5,
      cantidadNueva: 8,
    });
  });

  it("con variación: cambia la variación y no toca las sumas del padre", () => {
    const a = art({
      cantidad: "0",
      cantidadBodega: "0",
      subvariaciones: [
        { codigo: "v-10-aaa", nombre: "m1", codigoBarras: "12300011", cantidadPorSucursal: { S2: "2" } },
        { codigo: "v-10-bbb", nombre: "m2" },
      ],
    });
    const plan = planearMovimientoStock(a, BODEGA_S2, 6, { subvariacionCodigo: "v-10-aaa" });
    expect(Object.keys(plan.patch)).toEqual(["subvariaciones"]);
    expect(plan.patch.subvariaciones?.[0]).toEqual({
      codigo: "v-10-aaa",
      nombre: "m1",
      codigoBarras: "12300011",
      cantidadPorSucursal: { S2: "2" },
      cantidadBodegaSucursal: { S2: "6" },
    });
    expect(plan.patch.subvariaciones?.[1]).toEqual({ codigo: "v-10-bbb", nombre: "m2" });
  });

  it("no deja la bodega en negativo", () => {
    expect(() =>
      planearMovimientoStock(art({ cantidadBodegaSucursal: { S2: "1" } }), BODEGA_S2, -2),
    ).toThrow(/Stock insuficiente/);
  });

  it("lee bodega y tienda de una sucursal", () => {
    const a = art({
      cantidad: "7",
      cantidadPorSucursal: { S2: "4" },
      cantidadBodegaSucursal: { S2: "5" },
    });
    expect(leerExistenciasTienda(a, "S2", false)).toEqual({ bodega: 5, tienda: 4 });
    expect(leerExistenciasTienda(a, "S1", true)).toEqual({ bodega: 0, tienda: 7 });
  });

  it("tieneExistencias mira todas las ubicaciones", () => {
    expect(tieneExistencias(art())).toBe(false);
    expect(tieneExistencias(art({ cantidad: "1" }))).toBe(true);
    expect(tieneExistencias(art({ cantidadBodega: "2" }))).toBe(true);
    expect(tieneExistencias(art({ cantidadPorSucursal: { S2: "0", S3: "1" } }))).toBe(true);
    expect(tieneExistencias(art({ cantidadBodegaSucursal: { S2: "3" } }))).toBe(true);
    expect(
      tieneExistencias({ cantidad: "0", cantidadPorSucursal: { S2: "0" }, cantidadBodegaSucursal: {} }),
    ).toBe(false);
  });

  it("la ubicación se guarda sin esDefault", () => {
    expect(ubicacionPersistible(BODEGA_S2)).toEqual({ tipo: "bodegaSucursal", sucursalId: "S2" });
    expect(ubicacionPersistible({ tipo: "sucursal", sucursalId: "S1", esDefault: true })).toEqual({
      tipo: "sucursal",
      sucursalId: "S1",
    });
    expect(ubicacionPersistible({ tipo: "bodega" })).toEqual({ tipo: "bodega" });
  });
});
