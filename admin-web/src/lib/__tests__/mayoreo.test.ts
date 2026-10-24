import { describe, expect, it } from "vitest";
import {
  aplicarEscalones,
  articuloVisibleEnSucursal,
  escalonAplicable,
  grupoMayoreo,
  precioCobradoLinea,
  resolverEscalones,
  subtotalLinea,
  validarEscalones,
  type EscalonMayoreo,
  type LineaMayoreo,
} from "@shared";

/**
 * Tests de los helpers de mayoreo por escalones (`shared/src/mayoreo.ts`).
 * Son load-bearing: `aplicarEscalones` decide el precio cobrado en el POS.
 * Caso del dueño: zona "Llaveros" $35 con 10 pz → $30, 25 → $27, 40 → $24.
 */
const LLAVEROS: EscalonMayoreo[] = [
  { minPz: 10, precio: 30 },
  { minPz: 25, precio: 27 },
  { minPz: 40, precio: 24 },
];

function linea(over: Partial<LineaMayoreo> = {}): LineaMayoreo {
  return {
    cantidad: "1",
    precio: "35",
    mayoreoGrupo: "zona:llaveros",
    mayoreoEscalones: LLAVEROS,
    ...over,
  };
}

describe("resolverEscalones", () => {
  it("usa escalonesMayoreo, ordenados por piezas", () => {
    expect(
      resolverEscalones({
        precioVenta: "35",
        escalonesMayoreo: [LLAVEROS[2], LLAVEROS[0], LLAVEROS[1]],
      }),
    ).toEqual(LLAVEROS);
  });

  it("un array vacío manda sobre el legacy", () => {
    expect(
      resolverEscalones({
        precioVenta: "35",
        escalonesMayoreo: [],
        mayoreo: "30",
        cantMayoreo: "10",
      }),
    ).toEqual([]);
  });

  it("sin escalonesMayoreo usa el legacy de un escalón", () => {
    expect(
      resolverEscalones({ precioVenta: "35", mayoreo: "30", cantMayoreo: "10" }),
    ).toEqual([{ minPz: 10, precio: 30 }]);
  });

  it("descarta legacy inválido: más caro que el precio, 1 pieza o vacío", () => {
    expect(
      resolverEscalones({ precioVenta: "35", mayoreo: "40", cantMayoreo: "10" }),
    ).toEqual([]);
    expect(
      resolverEscalones({ precioVenta: "35", mayoreo: "30", cantMayoreo: "1" }),
    ).toEqual([]);
    expect(
      resolverEscalones({ precioVenta: "35", mayoreo: "", cantMayoreo: "" }),
    ).toEqual([]);
    expect(
      resolverEscalones({ precioVenta: "35", mayoreo: "abc", cantMayoreo: "10" }),
    ).toEqual([]);
  });
});

describe("grupoMayoreo", () => {
  it("con zona agrupa por zona; sin zona, por artículo", () => {
    expect(grupoMayoreo({ id: "12300001", zonaPrecioId: "llaveros" })).toBe(
      "zona:llaveros",
    );
    expect(grupoMayoreo({ id: "12300001" })).toBe("art:12300001");
  });
});

describe("escalonAplicable", () => {
  it.each([
    [9, null],
    [10, 30],
    [24, 30],
    [25, 27],
    [39, 27],
    [40, 24],
    [100, 24],
  ])("%i piezas → %s", (piezas, precio) => {
    expect(escalonAplicable(LLAVEROS, piezas)?.precio ?? null).toBe(precio);
  });
});

describe("validarEscalones", () => {
  it("acepta los escalones del dueño y la lista vacía", () => {
    expect(validarEscalones(LLAVEROS, 35)).toBeNull();
    expect(validarEscalones([], 35)).toBeNull();
    expect(validarEscalones([{ minPz: 10, precio: 30 }], 35)).toBeNull();
  });

  it("rechaza más de 3", () => {
    expect(
      validarEscalones([...LLAVEROS, { minPz: 50, precio: 20 }], 35),
    ).toMatch(/Máximo 3/);
  });

  it("rechaza piezas no enteras o menores a 2", () => {
    expect(validarEscalones([{ minPz: 1, precio: 30 }], 35)).toMatch(/2 o más/);
    expect(validarEscalones([{ minPz: 2.5, precio: 30 }], 35)).toMatch(/entero/);
  });

  it("rechaza precio 0, o igual/mayor al precio normal", () => {
    expect(validarEscalones([{ minPz: 10, precio: 0 }], 35)).toMatch(/mayor que 0/);
    expect(validarEscalones([{ minPz: 10, precio: 35 }], 35)).toMatch(/menor que el precio normal/);
  });

  it("exige piezas crecientes y precios decrecientes", () => {
    expect(
      validarEscalones([{ minPz: 10, precio: 30 }, { minPz: 10, precio: 27 }], 35),
    ).toMatch(/más que en el mayoreo 1/);
    expect(
      validarEscalones([{ minPz: 10, precio: 30 }, { minPz: 25, precio: 30 }], 35),
    ).toMatch(/menor que en el mayoreo 1/);
  });
});

describe("articuloVisibleEnSucursal", () => {
  it("la sucursal de mayoreo solo ve 'solo mayoreo'; las demás, el resto", () => {
    expect(articuloVisibleEnSucursal({ soloMayoreo: true }, true)).toBe(true);
    expect(articuloVisibleEnSucursal({}, true)).toBe(false);
    expect(articuloVisibleEnSucursal({ soloMayoreo: true }, false)).toBe(false);
    expect(articuloVisibleEnSucursal({ soloMayoreo: true }, undefined)).toBe(false);
    expect(articuloVisibleEnSucursal({}, undefined)).toBe(true);
    expect(articuloVisibleEnSucursal({ soloMayoreo: false }, false)).toBe(true);
  });
});

describe("aplicarEscalones", () => {
  it("9 piezas: precio normal; 10: escalón de $30", () => {
    expect(aplicarEscalones([linea({ cantidad: "9" })])[0]).toEqual(
      linea({ cantidad: "9" }),
    );
    expect(aplicarEscalones([linea({ cantidad: "10" })])[0]).toMatchObject({
      descuento: "30",
      mayoreoAply: "1",
      escalonMinPz: 10,
    });
  });

  it("modelos distintos de la misma zona suman piezas", () => {
    const [m1, m2] = aplicarEscalones([
      linea({ cantidad: "6" }),
      linea({ cantidad: "4" }),
    ]);
    expect(m1.descuento).toBe("30");
    expect(m2.descuento).toBe("30");
  });

  it("zonas distintas no se mezclan; sin zona cuenta solo", () => {
    const [a, b, c] = aplicarEscalones([
      linea({ cantidad: "6" }),
      linea({ cantidad: "6", mayoreoGrupo: "zona:pines" }),
      linea({ cantidad: "4", mayoreoGrupo: "art:12300009" }),
    ]);
    expect(a.mayoreoAply).toBeUndefined();
    expect(b.mayoreoAply).toBeUndefined();
    expect(c.mayoreoAply).toBeUndefined();
  });

  it("sube de escalón con la cantidad: 25 → $27, 40 → $24", () => {
    expect(aplicarEscalones([linea({ cantidad: "25" })])[0].descuento).toBe("27");
    expect(aplicarEscalones([linea({ cantidad: "40" })])[0].descuento).toBe("24");
  });

  it("al bajar del escalón regresa al precio normal sin descuento", () => {
    const [con] = aplicarEscalones([linea({ cantidad: "10" })]);
    const [sin] = aplicarEscalones([{ ...con, cantidad: "9" }]);
    expect(sin).toEqual(linea({ cantidad: "9" }));
    expect("descuento" in sin).toBe(false);
  });

  it("respeta una promo más barata y la restaura al bajar", () => {
    // Promo de catálogo $28: el escalón de $30 no conviene; el de $27 sí.
    const [en10] = aplicarEscalones([linea({ cantidad: "10", descuento: "28" })]);
    expect(en10.descuento).toBe("28");
    expect(en10.mayoreoAply).toBeUndefined();

    const [en25] = aplicarEscalones([{ ...en10, cantidad: "25" }]);
    expect(en25).toMatchObject({ descuento: "27", mayoreoAply: "1", descuentoBase: "28" });

    const [de25a10] = aplicarEscalones([{ ...en25, cantidad: "10" }]);
    expect(de25a10.descuento).toBe("28");
    expect(de25a10.mayoreoAply).toBeUndefined();
    expect(de25a10.descuentoBase).toBeUndefined();
  });

  it("regalo, no registrado, desmarcadas y 3x2 no suman ni reciben escalón", () => {
    const resultado = aplicarEscalones([
      linea({ cantidad: "5" }),
      linea({ cantidad: "5", giftCard: true }),
      linea({ cantidad: "5", no_registrado: true }),
      linea({ cantidad: "5", desmarcado: true }),
      linea({ cantidad: "6", aply_3x2: "2" }),
    ]);
    for (const l of resultado) expect(l.mayoreoAply).toBeUndefined();
  });

  it("desmarcar una línea con mayoreo le quita el escalón a ella y al grupo", () => {
    const aplicadas = aplicarEscalones([
      linea({ cantidad: "6" }),
      linea({ cantidad: "4" }),
    ]);
    const [a, b] = aplicarEscalones([aplicadas[0], { ...aplicadas[1], desmarcado: true }]);
    expect(a.descuento).toBeUndefined();
    expect(b.descuento).toBeUndefined();
    expect(b.mayoreoAply).toBeUndefined();
  });

  it("devuelve la misma instancia en líneas sin cambios", () => {
    const sinEscalones = { cantidad: "3", precio: "50", descuento: "45" };
    const conMayoreo = aplicarEscalones([linea({ cantidad: "10" })])[0];
    const [x, y] = aplicarEscalones([sinEscalones, conMayoreo]);
    expect(x).toBe(sinEscalones);
    expect(y).toBe(conMayoreo);
  });
});

describe("subtotalLinea", () => {
  it("usa el precio cobrado y descuenta las piezas gratis del 3x2", () => {
    expect(precioCobradoLinea({ precio: "35", descuento: "30" })).toBe(30);
    expect(precioCobradoLinea({ precio: "35" })).toBe(35);
    expect(subtotalLinea({ cantidad: "10", precio: "35", descuento: "30" })).toBe(300);
    expect(subtotalLinea({ cantidad: "6", precio: "35", aply_3x2: "2" })).toBe(140);
  });
});
