import { describe, expect, it } from "vitest";
import {
  folioFabricacion,
  planearMovimientoStock,
  validarAjuste,
  type Articulo,
  type UbicacionResuelta,
} from "@shared";

/**
 * Tests de `planearMovimientoStock` (`shared/src/inventario.ts`): el único
 * planificador de stock para lotes de producción, reducciones con motivo e
 * ingreso. Debe escribir el campo correcto en cada ubicación y nunca dejar
 * stock negativo.
 */
function art(over: Partial<Articulo> = {}): Articulo {
  return {
    id: "12300001",
    nombre: "Llavero Goku M1",
    sigla: "LGM1",
    referencia: "",
    codigo: "12300001",
    cantidad: "4",
    preciCompra: "10",
    precioVenta: "35",
    utilidad: "25",
    utilidadTotal: "100",
    fecha: "2026-10-24 10:00:00",
    ...over,
  };
}

const TALLER: UbicacionResuelta = { tipo: "bodega" };
const DEFAULT: UbicacionResuelta = { tipo: "sucursal", sucursalId: "S1", esDefault: true };
const OTRA: UbicacionResuelta = { tipo: "sucursal", sucursalId: "S2", esDefault: false };

describe("planearMovimientoStock — sin variaciones", () => {
  it("taller: suma a cantidadBodega", () => {
    const plan = planearMovimientoStock(art({ cantidadBodega: "5" }), TALLER, 30);
    expect(plan).toEqual({
      patch: { cantidadBodega: "35" },
      cantidadAnterior: 5,
      cantidadNueva: 35,
    });
  });

  it("sucursal default: escribe cantidad", () => {
    const plan = planearMovimientoStock(art(), DEFAULT, -1);
    expect(plan.patch).toEqual({ cantidad: "3" });
  });

  it("otra sucursal: escribe su llave y conserva las demás", () => {
    const plan = planearMovimientoStock(
      art({ cantidadPorSucursal: { S2: "8", S3: "1" } }),
      OTRA,
      -2,
    );
    expect(plan.patch).toEqual({ cantidadPorSucursal: { S2: "6", S3: "1" } });
    expect(plan.cantidadNueva).toBe(6);
  });

  it("otra sucursal sin stock previo arranca en 0", () => {
    expect(planearMovimientoStock(art(), OTRA, 12).patch).toEqual({
      cantidadPorSucursal: { S2: "12" },
    });
  });

  it("no deja stock negativo", () => {
    expect(() => planearMovimientoStock(art(), DEFAULT, -5)).toThrow(
      /Stock insuficiente.*hay 4, se piden 5/,
    );
  });

  it("rechaza cantidades 0 o con decimales", () => {
    expect(() => planearMovimientoStock(art(), DEFAULT, 0)).toThrow(/entero/);
    expect(() => planearMovimientoStock(art(), DEFAULT, 1.5)).toThrow(/entero/);
  });
});

describe("planearMovimientoStock — con variaciones", () => {
  const conSubs = art({
    cantidad: "5",
    cantidadBodega: "3",
    subvariaciones: [
      { codigo: "v-1-AAA", nombre: "Rojo", cantidad: "2", cantidadBodega: "1", cantidadPorSucursal: { S2: "7" } },
      { codigo: "v-1-BBB", nombre: "Azul", cantidad: "3", cantidadBodega: "2" },
    ],
  });

  it("exige indicar la variación", () => {
    expect(() => planearMovimientoStock(conSubs, DEFAULT, 1)).toThrow(/variaciones/);
  });

  it("rechaza una variación inexistente", () => {
    expect(() =>
      planearMovimientoStock(conSubs, DEFAULT, 1, { subvariacionCodigo: "v-1-ZZZ" }),
    ).toThrow(/no existe/);
  });

  it("default: mueve la variación y recalcula la suma del padre", () => {
    const plan = planearMovimientoStock(conSubs, DEFAULT, 4, { subvariacionCodigo: "v-1-AAA" });
    expect(plan.patch.cantidad).toBe("9");
    expect(plan.patch.subvariaciones?.[0].cantidad).toBe("6");
    expect(plan.patch.subvariaciones?.[1]).toBe(conSubs.subvariaciones![1]);
  });

  it("taller: recalcula la suma de bodega del padre", () => {
    const plan = planearMovimientoStock(conSubs, TALLER, 10, { subvariacionCodigo: "v-1-BBB" });
    expect(plan.patch.cantidadBodega).toBe("13");
    expect(plan.patch.cantidad).toBeUndefined();
  });

  it("otra sucursal: solo cambia la variación, no el padre", () => {
    const plan = planearMovimientoStock(conSubs, OTRA, -3, { subvariacionCodigo: "v-1-AAA" });
    expect(plan.patch).toEqual({
      subvariaciones: [
        { ...conSubs.subvariaciones![0], cantidadPorSucursal: { S2: "4" } },
        conSubs.subvariaciones![1],
      ],
    });
  });
});

describe("validarAjuste", () => {
  it("acepta una reducción con motivo", () => {
    expect(validarAjuste({ piezas: 2, motivo: "danado" })).toBeNull();
    expect(validarAjuste({ piezas: 1, motivo: "sin_motivo" })).toBeNull();
    expect(validarAjuste({ piezas: 1, motivo: "otro", motivoDetalle: "muestra" })).toBeNull();
  });

  it("rechaza piezas inválidas y 'otro' sin especificar", () => {
    expect(validarAjuste({ piezas: 0, motivo: "danado" })).toMatch(/piezas/);
    expect(validarAjuste({ piezas: 1.5, motivo: "danado" })).toMatch(/piezas/);
    expect(validarAjuste({ piezas: 1, motivo: "otro", motivoDetalle: "  " })).toMatch(/Especifica/);
  });
});

describe("folioFabricacion", () => {
  it("rellena a 6 dígitos", () => {
    expect(folioFabricacion(1)).toBe("FAB-000001");
    expect(folioFabricacion(123456)).toBe("FAB-123456");
    expect(folioFabricacion(1234567)).toBe("FAB-1234567");
  });
});
