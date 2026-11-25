import { describe, expect, it } from "vitest";
import type { Articulo } from "@shared";
import { planearExistencias } from "../planearExistencias";

const DEFAULT = { sucursalId: "suc-a", esDefault: true };
const OTRA = { sucursalId: "suc-b", esDefault: false };

function articulo(extra: Partial<Articulo> = {}): Articulo {
  return {
    id: "12300001",
    nombre: "Camisa",
    sigla: "CAM",
    referencia: "",
    codigo: "12300001",
    cantidad: "10",
    preciCompra: "100",
    precioVenta: "150",
    utilidad: "50",
    utilidadTotal: "500",
    fecha: "2026-10-01",
    ...extra,
  } as Articulo;
}

function conSubs(): Articulo {
  return articulo({
    cantidad: "5",
    cantidadPorSucursal: { "suc-b": "7" },
    subvariaciones: [
      { codigo: "v-01-AAA", nombre: "Rojo", cantidad: "2", cantidadPorSucursal: { "suc-b": "1" } },
      { codigo: "v-02-BBB", nombre: "Azul", cantidad: "3" },
    ],
  });
}

describe("planearExistencias", () => {
  it("otra sucursal sin variaciones: escribe solo cantidadPorSucursal[sid]", () => {
    const art = articulo({ cantidadPorSucursal: { "suc-c": "4" } });
    const plan = planearExistencias(
      art,
      [{ articuloId: art.id, base: 0, valor: 8 }],
      OTRA,
    );
    expect(plan.patch).toEqual({
      cantidadPorSucursal: { "suc-c": "4", "suc-b": "8" },
    });
    expect(plan.aplicados).toHaveLength(1);
  });

  it("otra sucursal con variaciones: solo cambia el mapa de cada sub, no el padre", () => {
    const art = conSubs();
    const plan = planearExistencias(
      art,
      [
        { articuloId: art.id, subvariacionCodigo: "v-01-AAA", base: 1, valor: 6 },
        { articuloId: art.id, subvariacionCodigo: "v-02-BBB", base: 0, valor: 9 },
      ],
      OTRA,
    );
    expect(plan.patch).toEqual({
      subvariaciones: [
        { codigo: "v-01-AAA", nombre: "Rojo", cantidad: "2", cantidadPorSucursal: { "suc-b": "6" } },
        { codigo: "v-02-BBB", nombre: "Azul", cantidad: "3", cantidadPorSucursal: { "suc-b": "9" } },
      ],
    });
  });

  it("default con variaciones: escribe cantidad de la sub y el padre queda como la suma", () => {
    const art = conSubs();
    const plan = planearExistencias(
      art,
      [{ articuloId: art.id, subvariacionCodigo: "v-02-BBB", base: 3, valor: 10 }],
      DEFAULT,
    );
    expect(plan.patch?.cantidad).toBe("12");
    expect(plan.patch?.cantidadPorSucursal).toBeUndefined();
    expect(plan.patch?.subvariaciones?.[1]).toEqual({
      codigo: "v-02-BBB",
      nombre: "Azul",
      cantidad: "10",
    });
  });

  it("default sin variaciones: escribe cantidad", () => {
    const art = articulo();
    const plan = planearExistencias(
      art,
      [{ articuloId: art.id, base: 10, valor: 3 }],
      DEFAULT,
    );
    expect(plan.patch).toEqual({ cantidad: "3" });
  });

  it("si el stock ya no es la base, reporta conflicto y no escribe", () => {
    const art = conSubs();
    const plan = planearExistencias(
      art,
      [{ articuloId: art.id, subvariacionCodigo: "v-01-AAA", base: 4, valor: 6 }],
      OTRA,
    );
    expect(plan.patch).toBeNull();
    expect(plan.conflictos).toEqual([
      {
        cambio: { articuloId: art.id, subvariacionCodigo: "v-01-AAA", base: 4, valor: 6 },
        actual: 1,
      },
    ]);
  });

  it("rechaza variaciones inexistentes, padre con variaciones y cantidades inválidas", () => {
    const art = conSubs();
    const plan = planearExistencias(
      art,
      [
        { articuloId: art.id, subvariacionCodigo: "v-09-ZZZ", base: 0, valor: 1 },
        { articuloId: art.id, base: 7, valor: 1 },
        { articuloId: art.id, subvariacionCodigo: "v-02-BBB", base: 0, valor: -1 },
        { articuloId: art.id, subvariacionCodigo: "v-02-BBB", base: 0, valor: 1.5 },
      ],
      OTRA,
    );
    expect(plan.patch).toBeNull();
    expect(plan.errores).toHaveLength(4);
  });

  describe("bodega de la tienda (lugar: bodega)", () => {
    it("sin variaciones: escribe solo cantidadBodegaSucursal[sid]", () => {
      const art = articulo({
        cantidadPorSucursal: { "suc-b": "4" },
        cantidadBodegaSucursal: { "suc-c": "9" },
      });
      const plan = planearExistencias(
        art,
        [{ articuloId: art.id, base: 0, valor: 12 }],
        OTRA,
        "bodega",
      );
      expect(plan.patch).toEqual({
        cantidadBodegaSucursal: { "suc-c": "9", "suc-b": "12" },
      });
      expect(plan.aplicados).toHaveLength(1);
    });

    it("con variaciones: cambia la variación, no la tienda ni las sumas del padre", () => {
      const art = conSubs();
      const plan = planearExistencias(
        art,
        [{ articuloId: art.id, subvariacionCodigo: "v-01-AAA", base: 0, valor: 6 }],
        OTRA,
        "bodega",
      );
      expect(Object.keys(plan.patch!)).toEqual(["subvariaciones"]);
      expect(plan.patch!.subvariaciones![0]).toEqual({
        codigo: "v-01-AAA",
        nombre: "Rojo",
        cantidad: "2",
        cantidadPorSucursal: { "suc-b": "1" },
        cantidadBodegaSucursal: { "suc-b": "6" },
      });
    });

    it("en la sucursal default tampoco toca `cantidad`", () => {
      const art = conSubs();
      const plan = planearExistencias(
        art,
        [{ articuloId: art.id, subvariacionCodigo: "v-02-BBB", base: 0, valor: 4 }],
        DEFAULT,
        "bodega",
      );
      expect(Object.keys(plan.patch!)).toEqual(["subvariaciones"]);
      expect(plan.patch!.subvariaciones![1]).toEqual({
        codigo: "v-02-BBB",
        nombre: "Azul",
        cantidad: "3",
        cantidadBodegaSucursal: { "suc-a": "4" },
      });
    });

    it("la base se compara contra la bodega, no contra la tienda", () => {
      const art = articulo({
        cantidadPorSucursal: { "suc-b": "4" },
        cantidadBodegaSucursal: { "suc-b": "10" },
      });
      const plan = planearExistencias(
        art,
        [{ articuloId: art.id, base: 4, valor: 1 }],
        OTRA,
        "bodega",
      );
      expect(plan.patch).toBeNull();
      expect(plan.conflictos).toEqual([
        { cambio: { articuloId: art.id, base: 4, valor: 1 }, actual: 10 },
      ]);
    });
  });
});
