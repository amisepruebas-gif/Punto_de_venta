import { describe, expect, it } from "vitest";
import {
  IMPRESORA_CONECTADA_MS,
  TSPL_ENCABEZADO_29X14,
  asciiTspl,
  codigoEtiquetaLote,
  codigoVinculacionImpresora,
  codigosDeTrabajo,
  estadoImpresoraParaOrden,
  etiquetasDeTrabajo,
  generarSecretoEnlace,
  impresoraConectada,
  leerCodigoVinculacion,
  planearTomaEtiquetasLote,
  rangoLegible,
  textoEstadoTrabajo,
  tsplEtiquetasLote,
  tsplEtiquetasPrecio,
  tsplPrueba,
  validarRenglonesPrecio,
} from "@shared";

/**
 * Tests de `shared/src/tspl.ts` e `impresion.ts`: lo que el programa de
 * Windows le manda a la impresora de etiquetas y la lógica de la cola.
 * Las etiquetas de precio deben salir IDÉNTICAS a las de la app Android
 * "codigos" (MainActivity.buildTsplCommand_*), que ya imprime bien.
 */

/** Lo que manda "codigos" para un artículo registrado (copiado tal cual). */
function codigosRegistrado(price: string, barcode: string, quantity: number): string {
  return (
    "SIZE 29 mm, 14 mm\n" +
    "GAP 3 mm, 0 mm\n" +
    "DENSITY 8\n" +
    "SPEED 4\n" +
    "DIRECTION 0\n" +
    "REFERENCE 0,0\n" +
    "SET TEAR ON\n" +
    "SET TEAR ADJUST 5\n" +
    "CLS\n" +
    `TEXT 85,10,"1",0,2,2,"$${price}"\n` +
    `BARCODE 40,35,"128",30,0,0,2,3,"${barcode}"\n` +
    `TEXT 40,70,"1",0,2,2,"${barcode}"\n` +
    `PRINT ${quantity}\n`
  );
}

function codigosNoRegistrado(price: string, quantity: number): string {
  return (
    "SIZE 29 mm, 14 mm\n" +
    "GAP 3 mm, 0 mm\n" +
    "DENSITY 8\n" +
    "SPEED 4\n" +
    "DIRECTION 0\n" +
    "REFERENCE 0,0\n" +
    "SET TEAR ON\n" +
    "SET TEAR ADJUST 5\n" +
    "CLS\n" +
    `TEXT 21,10,"1",0,2,2,"NO REGISTRADO"\n` +
    `TEXT 40,70,"1",0,2,2,"$${price}"\n` +
    `PRINT ${quantity}\n`
  );
}

describe("TSPL: etiquetas de precio como la app codigos", () => {
  it("artículo registrado: el mismo texto exacto", () => {
    expect(tsplEtiquetasPrecio([{ codigo: "12300001", precio: "35", piezas: 3 }])).toBe(
      codigosRegistrado("35", "12300001", 3),
    );
  });

  it("no registrado: el mismo texto exacto", () => {
    expect(tsplEtiquetasPrecio([{ precio: "120.50", piezas: 2 }])).toBe(codigosNoRegistrado("120.50", 2));
  });

  it("varios renglones: el encabezado una vez y cada etiqueta con sus piezas", () => {
    const t = tsplEtiquetasPrecio([
      { codigo: "12300001", precio: "35", piezas: 3 },
      { precio: "20", piezas: 1 },
    ]);
    expect(t.match(/SIZE 29 mm/g)).toHaveLength(1);
    expect(t.match(/^CLS$/gm)).toHaveLength(2);
    expect(t).toContain("PRINT 3\n");
    expect(t).toContain("PRINT 1\n");
    expect(t.endsWith("\n")).toBe(true);
  });

  it("rechaza lo que rompería el comando o la etiqueta", () => {
    expect(() => tsplEtiquetasPrecio([{ codigo: "1230001", precio: "35", piezas: 1 }])).toThrow(/8 dígitos/);
    expect(() => tsplEtiquetasPrecio([{ codigo: "12300001", precio: '35" CLS', piezas: 1 }])).toThrow(/Precio/);
    expect(() => tsplEtiquetasPrecio([{ precio: "$35", piezas: 1 }])).toThrow(/Precio/);
    expect(() => tsplEtiquetasPrecio([{ precio: "35", piezas: 0 }])).toThrow(/Piezas/);
    expect(() => tsplEtiquetasPrecio([{ precio: "35", piezas: 101 }])).toThrow(/Piezas/);
    expect(() => tsplEtiquetasPrecio([{ precio: "35", piezas: 1.5 }])).toThrow(/Piezas/);
    expect(() => tsplEtiquetasPrecio([])).toThrow();
  });
});

describe("TSPL: etiquetas numeradas de lote", () => {
  it("una por código: barras de 12 dígitos centradas y el número legible", () => {
    const t = tsplEtiquetasLote([codigoEtiquetaLote(301), codigoEtiquetaLote(302)]);
    const lineas = t.trimEnd().split("\n");
    expect(lineas.slice(0, TSPL_ENCABEZADO_29X14.length)).toEqual([...TSPL_ENCABEZADO_29X14]);
    expect(t).toContain('BARCODE 15,8,"128",62,0,0,2,3,"880000000301"\n');
    expect(t).toContain('TEXT 32,76,"2",0,1,1,"8800 0000 0301"\n');
    expect(t).toContain('"880000000302"');
    expect(t.match(/^PRINT 1$/gm)).toHaveLength(2);
  });

  it("no imprime algo que no es etiqueta de lote", () => {
    expect(() => tsplEtiquetasLote(["12300001"])).toThrow(/inválido/);
    expect(() => tsplEtiquetasLote([])).toThrow();
  });

  it("la etiqueta de prueba lleva el nombre sin acentos ni comillas", () => {
    expect(asciiTspl('Taller "Puebla" Ñuñez')).toBe("Taller Puebla Nunez");
    const t = tsplPrueba("Sucursal Centro Histórico grande y larga");
    expect(t).toContain('TEXT 16,30,"1",0,1,1,"Sucursal Centro Histor"');
    expect(t).toContain('"12345678"');
    expect(t.match(/^PRINT 1$/gm)).toHaveLength(1);
  });
});

describe("cola de impresión", () => {
  it("al tomar una orden aparta los números que siguen al contador", () => {
    expect(planearTomaEtiquetasLote({ cantidad: 20 }, 100)).toEqual({ desde: 101, hasta: 120, nuevoUltimo: 120 });
    expect(planearTomaEtiquetasLote({ cantidad: 5 }, undefined)).toEqual({ desde: 1, hasta: 5, nuevoUltimo: 5 });
    expect(planearTomaEtiquetasLote({ cantidad: 5 }, null)).toEqual({ desde: 1, hasta: 5, nuevoUltimo: 5 });
  });

  it("una reimpresión conserva sus números y no toca el contador", () => {
    expect(planearTomaEtiquetasLote({ cantidad: 20, desde: 101, hasta: 120 }, 500)).toEqual({
      desde: 101,
      hasta: 120,
      nuevoUltimo: null,
    });
  });

  it("una cantidad inválida no aparta nada", () => {
    for (const cantidad of [0, -3, 1.5, 301, undefined]) {
      expect(() => planearTomaEtiquetasLote({ cantidad }, 100)).toThrow(/cantidad/);
    }
  });

  it("códigos y rango legible de una orden", () => {
    expect(codigosDeTrabajo({ desde: 9, hasta: 11 })).toEqual(["880000000009", "880000000010", "880000000011"]);
    expect(codigosDeTrabajo({})).toEqual([]);
    expect(rangoLegible({ desde: 301, hasta: 320 })).toBe("8800 0000 0301 a 8800 0000 0320");
    expect(rangoLegible({ desde: 7, hasta: 7 })).toBe("8800 0000 0007");
    expect(rangoLegible({ desde: 5, hasta: 2 })).toBe("");
  });

  it("cuántas etiquetas salen de una orden", () => {
    expect(etiquetasDeTrabajo({ tipo: "etiquetas_lote", cantidad: 20 })).toBe(20);
    expect(etiquetasDeTrabajo({ tipo: "etiquetas_lote", cantidad: 20, desde: 1, hasta: 20 })).toBe(20);
    expect(
      etiquetasDeTrabajo({
        tipo: "etiquetas_precio",
        renglones: [
          { precio: "1", piezas: 3 },
          { precio: "2", piezas: 4 },
        ],
      }),
    ).toBe(7);
  });

  it("la impresora se ve conectada si avisó hace poco", () => {
    const ahora = 1_800_000_000_000;
    const marca = (ms: number) => ({ toMillis: () => ms });
    expect(impresoraConectada({ latidoEn: marca(ahora - 30_000) }, ahora)).toBe(true);
    expect(impresoraConectada({ latidoEn: marca(ahora - IMPRESORA_CONECTADA_MS - 1) }, ahora)).toBe(false);
    expect(impresoraConectada({ latidoEn: { seconds: (ahora - 10_000) / 1000, nanoseconds: 0 } }, ahora)).toBe(true);
    expect(impresoraConectada({}, ahora)).toBe(false);
    expect(impresoraConectada(null, ahora)).toBe(false);
  });

  it("dice al teléfono y a la caja si la impresora está lista para su orden", () => {
    const ahora = 1_800_000_000_000;
    const viva = { latidoEn: { toMillis: () => ahora - 20_000 } };
    expect(estadoImpresoraParaOrden({ ...viva, windows: "Etiquetas AMISE" }, ahora)).toEqual({ texto: "Conectada", lista: true });
    expect(estadoImpresoraParaOrden({ ...viva, windows: "Etiquetas AMISE", pausada: true }, ahora).lista).toBe(false);
    // "" = el programa avisa que no tiene impresora de Windows elegida.
    expect(estadoImpresoraParaOrden({ ...viva, windows: "" }, ahora)).toEqual({
      texto: "Conectada, pero falta elegir la impresora en la PC",
      lista: false,
    });
    expect(estadoImpresoraParaOrden({ windows: "X" }, ahora).texto).toMatch(/Sin conexión/);
    expect(estadoImpresoraParaOrden(null, ahora).lista).toBe(false);
  });

  it("valida los renglones de precio que manda la caja", () => {
    expect(validarRenglonesPrecio([{ codigo: "12300001", precio: "35", piezas: 2 }, { precio: "9.5", piezas: 1 }])).toEqual([]);
    expect(validarRenglonesPrecio([])).toEqual(["No hay etiquetas que imprimir"]);
    const malos = validarRenglonesPrecio([{ codigo: "123", precio: "x", piezas: 0 }, null]).join("|");
    expect(malos).toMatch(/8 dígitos/);
    expect(malos).toMatch(/precio inválido/);
    expect(malos).toMatch(/piezas van de 1 a 100/);
    expect(malos).toMatch(/renglón 2 está vacío/);
    expect(validarRenglonesPrecio(Array.from({ length: 21 }, () => ({ precio: "1", piezas: 1 })))).toEqual([
      "Máximo 20 artículos por orden",
    ]);
  });

  it("dice el estado en español sencillo", () => {
    expect(textoEstadoTrabajo({ estado: "pendiente", tipo: "etiquetas_lote" })).toMatch(/En cola/);
    expect(textoEstadoTrabajo({ estado: "imprimiendo", tipo: "etiquetas_lote" })).toBe("Imprimiendo…");
    expect(textoEstadoTrabajo({ estado: "impreso", tipo: "etiquetas_lote", desde: 1, hasta: 2 })).toBe(
      "Listo: 8800 0000 0001 a 8800 0000 0002",
    );
    expect(textoEstadoTrabajo({ estado: "impreso", tipo: "etiquetas_precio" })).toBe("Listo");
    expect(textoEstadoTrabajo({ estado: "error", tipo: "etiquetas_lote", error: "Sin papel" })).toBe(
      "No se imprimió: Sin papel",
    );
  });
});

describe("código de vinculación de la impresora", () => {
  it("ida y vuelta, aunque se pegue con espacios o saltos de línea", () => {
    const secreto = generarSecretoEnlace();
    const c = codigoVinculacionImpresora("amise", "AbC123xyz", secreto);
    expect(c.startsWith("AMISE1.")).toBe(true);
    expect(c).not.toMatch(/^https?:/);
    expect(leerCodigoVinculacion(c)).toEqual({ negocioId: "amise", enlaceId: "AbC123xyz", secreto });
    expect(leerCodigoVinculacion(`  ${c.slice(0, 20)}\n${c.slice(20)}  `)).toEqual({
      negocioId: "amise",
      enlaceId: "AbC123xyz",
      secreto,
    });
  });

  it("lo que no es un código de vinculación no se lee", () => {
    expect(leerCodigoVinculacion("https://amise-mercancia.web.app/enlace/amise/x#abc")).toBeNull();
    expect(leerCodigoVinculacion("AMISE1.amise.x.corto")).toBeNull();
    expect(leerCodigoVinculacion("")).toBeNull();
    expect(() => codigoVinculacionImpresora("a/b", "x", generarSecretoEnlace())).toThrow();
    expect(() => codigoVinculacionImpresora("amise", "x", "corto")).toThrow();
  });
});
