import { describe, expect, it } from "vitest";
import { resolverPrecioEfectivo } from "@shared";

/**
 * Tests del helper compartido `resolverPrecioEfectivo`. La cadena de
 * resolución es load-bearing: cualquier cambio de semántica acá afecta
 * cobros reales en producción. Cubrimos:
 *   - El fallback al precio base cuando no hay descuento válido.
 *   - Sub gana sobre padre.
 *   - Guards: vacío, "0", negativos, no numéricos, `>= precioVenta`.
 *   - El legacy `descuento` (campo viejo) NO se lee — semántica
 *     histórica ambigua, ver doc en `precio.ts`.
 */
describe("resolverPrecioEfectivo — cadena base", () => {
  it("sin descuento → precio base", () => {
    expect(resolverPrecioEfectivo({ precioVenta: "150" })).toEqual({
      precio: 150,
    });
  });

  it("padre.precioDescuento válido → gana sobre base", () => {
    expect(
      resolverPrecioEfectivo({ precioVenta: "150", precioDescuento: "120" }),
    ).toEqual({ precio: 120, descuento: "120" });
  });

  it("sub.precioDescuento gana sobre padre.precioDescuento", () => {
    expect(
      resolverPrecioEfectivo(
        { precioVenta: "150", precioDescuento: "120" },
        { precioDescuento: "100" },
      ),
    ).toEqual({ precio: 100, descuento: "100" });
  });

  it("sub vacío → cae a padre.precioDescuento", () => {
    expect(
      resolverPrecioEfectivo(
        { precioVenta: "150", precioDescuento: "120" },
        { precioDescuento: "" },
      ),
    ).toEqual({ precio: 120, descuento: "120" });
  });

  it("sub null → consulta sólo el padre", () => {
    expect(
      resolverPrecioEfectivo(
        { precioVenta: "150", precioDescuento: "120" },
        null,
      ),
    ).toEqual({ precio: 120, descuento: "120" });
  });
});

describe("resolverPrecioEfectivo — guards", () => {
  it("precioDescuento === '0' se descarta", () => {
    expect(
      resolverPrecioEfectivo({ precioVenta: "150", precioDescuento: "0" }),
    ).toEqual({ precio: 150 });
  });

  it("precioDescuento negativo se descarta", () => {
    expect(
      resolverPrecioEfectivo({ precioVenta: "150", precioDescuento: "-50" }),
    ).toEqual({ precio: 150 });
  });

  it("precioDescuento no numérico se descarta", () => {
    expect(
      resolverPrecioEfectivo({ precioVenta: "150", precioDescuento: "abc" }),
    ).toEqual({ precio: 150 });
  });

  it("precioDescuento === precioVenta se descarta (no es descuento)", () => {
    expect(
      resolverPrecioEfectivo({ precioVenta: "150", precioDescuento: "150" }),
    ).toEqual({ precio: 150 });
  });

  it("precioDescuento > precioVenta se descarta (typo o mispriced)", () => {
    expect(
      resolverPrecioEfectivo({ precioVenta: "150", precioDescuento: "1500" }),
    ).toEqual({ precio: 150 });
  });

  it("sub inválido → cae a padre válido", () => {
    expect(
      resolverPrecioEfectivo(
        { precioVenta: "150", precioDescuento: "120" },
        { precioDescuento: "200" }, // mayor que base → descartado
      ),
    ).toEqual({ precio: 120, descuento: "120" });
  });
});

describe("resolverPrecioEfectivo — legacy descuento ignorado", () => {
  it("padre.descuento NO se lee (semántica histórica ambigua)", () => {
    // Casteamos para simular un doc Firestore con el campo legacy aún
    // presente. El resolver debe ignorarlo y devolver el precio base.
    const padre = {
      precioVenta: "150",
      descuento: "30",
    } as Parameters<typeof resolverPrecioEfectivo>[0];
    expect(resolverPrecioEfectivo(padre)).toEqual({ precio: 150 });
  });
});

describe("resolverPrecioEfectivo — precioVenta inválido", () => {
  it("precioVenta vacío con descuento válido → cobra el descuento", () => {
    // Edge: si precioVenta no está, baseNum=0 → el guard
    // `n >= precioVenta` no aplica (sólo se aplica con baseNum > 0).
    expect(
      resolverPrecioEfectivo({ precioVenta: "", precioDescuento: "100" }),
    ).toEqual({ precio: 100, descuento: "100" });
  });

  it("precioVenta vacío sin descuento → precio 0", () => {
    expect(resolverPrecioEfectivo({ precioVenta: "" })).toEqual({ precio: 0 });
  });
});
