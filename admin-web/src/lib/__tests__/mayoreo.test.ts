import { describe, expect, it } from "vitest";
import {
  aplicarEscalones,
  aplicarPreciosCarrito,
  articuloVisibleEnSucursal,
  estadoPrecioMenudeo,
  PIEZAS_MAYOREO,
  piezasDelTicket,
  resolverPrecioMenudeo,
  validarPrecioMenudeo,
  escalonAplicable,
  escalonesDeTexto,
  escalonesEditables,
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

describe("escalonesEditables / escalonesDeTexto", () => {
  it("carga los escalones guardados o el legacy tal cual (aunque sea inválido)", () => {
    expect(escalonesEditables({ escalonesMayoreo: [{ minPz: 10, precio: 30 }] })).toEqual([
      { minPz: "10", precio: "30" },
    ]);
    expect(escalonesEditables({ mayoreo: "40", cantMayoreo: "10" })).toEqual([
      { minPz: "10", precio: "40" },
    ]);
    expect(escalonesEditables({})).toEqual([]);
    expect(escalonesEditables({ escalonesMayoreo: [], mayoreo: "30", cantMayoreo: "10" })).toEqual([]);
  });

  it("convierte filas a escalones ignorando filas vacías", () => {
    expect(
      escalonesDeTexto([
        { minPz: "10", precio: "30" },
        { minPz: " ", precio: "" },
        { minPz: "25", precio: "27.5" },
      ]),
    ).toEqual([
      { minPz: 10, precio: 30 },
      { minPz: 25, precio: 27.5 },
    ]);
  });

  it("una fila a medias se convierte y validarEscalones la rechaza", () => {
    const escalones = escalonesDeTexto([{ minPz: "10", precio: "" }]);
    expect(validarEscalones(escalones, 35)).toMatch(/mayor que 0/);
  });
});

// ---------- Precio menudeo (caja de mayoreo) ----------
// Caso del dueño: llavero «Solo mayoreo» a $35 (mayoreo) y $45 menudeo. Con
// 1 o 2 piezas en el ticket se cobra $45; desde 3 piezas, $35.

describe("validarPrecioMenudeo", () => {
  it("sin «Solo mayoreo» no pide nada", () => {
    expect(validarPrecioMenudeo(false, "", 35)).toBeNull();
    expect(validarPrecioMenudeo(false, "abc", 35)).toBeNull();
  });

  it("con «Solo mayoreo» es obligatorio, mayor que 0 y mayor que el precio de venta", () => {
    expect(PIEZAS_MAYOREO).toBe(3);
    expect(validarPrecioMenudeo(true, "", 35)).toMatch(/Falta el precio menudeo.*menos de 3 piezas/);
    expect(validarPrecioMenudeo(true, "  ", 35)).toMatch(/Falta/);
    expect(validarPrecioMenudeo(true, "0", 35)).toMatch(/mayor que 0/);
    expect(validarPrecioMenudeo(true, "x", 35)).toMatch(/mayor que 0/);
    expect(validarPrecioMenudeo(true, "35", 35)).toBe(
      "El precio menudeo ($35) debe ser mayor que el precio de venta ($35)",
    );
    expect(validarPrecioMenudeo(true, "30", 35)).toMatch(/debe ser mayor que el precio de venta/);
    expect(validarPrecioMenudeo(true, "45", 35)).toBeNull();
    expect(validarPrecioMenudeo(true, "45.5", 35)).toBeNull();
    // Sin precio de venta todavía: solo pide que sea > 0.
    expect(validarPrecioMenudeo(true, "45", 0)).toBeNull();
  });
});

describe("resolverPrecioMenudeo / estadoPrecioMenudeo", () => {
  it("solo los «Solo mayoreo» con menudeo válido", () => {
    expect(resolverPrecioMenudeo({ soloMayoreo: true, precioMenudeo: "45", precioVenta: "35" })).toBe(45);
    expect(resolverPrecioMenudeo({ precioMenudeo: "45", precioVenta: "35" })).toBeNull();
    expect(resolverPrecioMenudeo({ soloMayoreo: true, precioVenta: "35" })).toBeNull();
    // La zona subió el precio a $50: el menudeo de $45 ya no vale.
    expect(resolverPrecioMenudeo({ soloMayoreo: true, precioMenudeo: "45", precioVenta: "50" })).toBeNull();
    expect(resolverPrecioMenudeo({ soloMayoreo: true, precioMenudeo: "45", precioVenta: "45" })).toBeNull();
  });

  it("avisa en admin si falta o no vale", () => {
    expect(estadoPrecioMenudeo({ precioVenta: "35" })).toBeNull();
    expect(estadoPrecioMenudeo({ soloMayoreo: true, precioVenta: "35" })).toBe("falta");
    expect(estadoPrecioMenudeo({ soloMayoreo: true, precioMenudeo: " ", precioVenta: "35" })).toBe("falta");
    expect(estadoPrecioMenudeo({ soloMayoreo: true, precioMenudeo: "30", precioVenta: "35" })).toBe("invalido");
    expect(estadoPrecioMenudeo({ soloMayoreo: true, precioMenudeo: "45", precioVenta: "35" })).toBe("ok");
  });
});

describe("aplicarPreciosCarrito", () => {
  /** Llavero «Solo mayoreo»: $35 mayoreo, $45 menudeo, escalones de zona. */
  function llavero(over: Partial<LineaMayoreo> = {}): LineaMayoreo {
    return linea({ precioMenudeo: 45, ...over });
  }
  const cobrado = (l: LineaMayoreo) => precioCobradoLinea(l);

  it("1 pieza: menudeo; la línea guarda el precio normal para regresarlo", () => {
    const [l] = aplicarPreciosCarrito([llavero()]);
    expect(l).toMatchObject({ precio: "45", menudeoAply: "1", menudeoBase: { precio: "35" } });
    expect("descuento" in l).toBe(false);
    expect(cobrado(l)).toBe(45);
  });

  it("2 piezas de artículos distintos: menudeo en las dos", () => {
    const [a, b] = aplicarPreciosCarrito([
      llavero(),
      llavero({ mayoreoGrupo: "art:12300009", precio: "50", precioMenudeo: 60 }),
    ]);
    expect(cobrado(a)).toBe(45);
    expect(cobrado(b)).toBe(60);
  });

  it("3 piezas sumando artículos distintos: precio normal", () => {
    const items = aplicarPreciosCarrito([
      llavero({ cantidad: "2" }),
      llavero({ mayoreoGrupo: "art:12300009", precio: "50", precioMenudeo: 60 }),
    ]);
    expect(items.map(cobrado)).toEqual([35, 50]);
    expect(items.every((l) => l.menudeoAply === undefined && l.menudeoBase === undefined)).toBe(true);
  });

  it("de 2 a 3 piezas y de regreso: menudeo → normal → menudeo", () => {
    const [en2] = aplicarPreciosCarrito([llavero({ cantidad: "2" })]);
    expect(cobrado(en2)).toBe(45);
    const [en3] = aplicarPreciosCarrito([{ ...en2, cantidad: "3" }]);
    expect(en3).toEqual(llavero({ cantidad: "3" }));
    const [otraVez2] = aplicarPreciosCarrito([{ ...en3, cantidad: "2" }]);
    expect(otraVez2).toEqual(en2);
  });

  it("un escalón de 2 piezas no aplica con menos de 3; desde 3 sí", () => {
    const escalon2 = [{ minPz: 2, precio: 32 }];
    const [en2] = aplicarPreciosCarrito([llavero({ cantidad: "2", mayoreoEscalones: escalon2 })]);
    expect(en2).toMatchObject({ precio: "45", menudeoAply: "1" });
    expect(en2.mayoreoAply).toBeUndefined();
    const [en3] = aplicarPreciosCarrito([{ ...en2, cantidad: "3" }]);
    expect(en3).toMatchObject({ precio: "35", descuento: "32", mayoreoAply: "1" });
    expect(en3.menudeoAply).toBeUndefined();
    // Y de 3 a 2 regresa al menudeo sin dejar el escalón.
    const [de3a2] = aplicarPreciosCarrito([{ ...en3, cantidad: "2" }]);
    expect(de3a2).toEqual(en2);
  });

  it("la promo de catálogo no aplica con menudeo y regresa desde 3 piezas", () => {
    const [en1] = aplicarPreciosCarrito([llavero({ descuento: "33" })]);
    expect(en1).toMatchObject({ precio: "45", menudeoBase: { precio: "35", descuento: "33" } });
    expect("descuento" in en1).toBe(false);
    const [en3] = aplicarPreciosCarrito([{ ...en1, cantidad: "3" }]);
    expect(en3).toEqual(llavero({ cantidad: "3", descuento: "33" }));
    expect(cobrado(en3)).toBe(33);
  });

  it("de un escalón con promo guardada a menudeo y de regreso, sin perder la promo", () => {
    const escalon10 = [{ minPz: 10, precio: 30 }];
    const [en10] = aplicarPreciosCarrito([llavero({ cantidad: "10", descuento: "33", mayoreoEscalones: escalon10 })]);
    expect(en10).toMatchObject({ descuento: "30", descuentoBase: "33", mayoreoAply: "1" });
    const [en1] = aplicarPreciosCarrito([{ ...en10, cantidad: "1" }]);
    expect(en1).toMatchObject({ precio: "45", menudeoAply: "1", menudeoBase: { precio: "35", descuento: "33" } });
    expect(en1.mayoreoAply).toBeUndefined();
    expect(en1.descuentoBase).toBeUndefined();
    const [en5] = aplicarPreciosCarrito([{ ...en1, cantidad: "5" }]);
    expect(en5).toEqual(llavero({ cantidad: "5", descuento: "33", mayoreoEscalones: escalon10 }));
  });

  it("no cuentan las desmarcadas ni las tarjetas de regalo; sí las no registradas", () => {
    const regalo: LineaMayoreo = { cantidad: "1", precio: "200", giftCard: true };
    const desmarcada = llavero({ cantidad: "5", desmarcado: true });
    const noReg: LineaMayoreo = { cantidad: "1", precio: "20", no_registrado: true };
    expect(piezasDelTicket([llavero(), regalo, desmarcada])).toBe(1);
    expect(piezasDelTicket([llavero(), noReg])).toBe(2);

    const [a, , c] = aplicarPreciosCarrito([llavero(), regalo, desmarcada]);
    expect(cobrado(a)).toBe(45);
    // La desmarcada no se cobra y queda sin menudeo.
    expect(c.menudeoAply).toBeUndefined();

    const [x, nr] = aplicarPreciosCarrito([llavero({ cantidad: "2" }), noReg]);
    expect(cobrado(x)).toBe(35);
    expect(nr).toBe(noReg);
  });

  it("líneas sin precio menudeo (artículos normales o viejos) se cobran normal", () => {
    const normal = linea({ cantidad: "1" });
    const [n, ll] = aplicarPreciosCarrito([normal, llavero()]);
    expect(n).toBe(normal);
    expect(cobrado(ll)).toBe(45);
  });

  it("las líneas que no cambian conservan la misma instancia", () => {
    const primera = aplicarPreciosCarrito([llavero(), linea()]);
    const segunda = aplicarPreciosCarrito(primera);
    expect(segunda[0]).toBe(primera[0]);
    expect(segunda[1]).toBe(primera[1]);
  });

  it("carrito vacío y ticket de 3 piezas sin menudeo: sin cambios", () => {
    expect(aplicarPreciosCarrito([])).toEqual([]);
    const tres = [linea({ cantidad: "3" })];
    expect(aplicarPreciosCarrito(tres)[0]).toBe(tres[0]);
  });
});
