import { describe, expect, it } from "vitest";
import {
  LoteConProblemas,
  aplicarEscaneoLote,
  claveArticulo,
  codigoEtiquetaLote,
  conteoLoteVacio,
  esCodigoEtiquetaLote,
  esLote,
  esSecretoEnlace,
  etiquetaLoteLegible,
  fijarPiezasConteo,
  folioLote,
  generarSecretoEnlace,
  hashSecretoEnlace,
  idFotoLote,
  letraEnlace,
  lineasDeLote,
  llaveCajaLote,
  llavePaqueteLote,
  partirClaveArticulo,
  pendientePorArticuloId,
  planearEnvioLote,
  planearNoLlegoLote,
  planearRecepcionLote,
  quitarPaqueteConteo,
  resumenLote,
  resumenLoteConConteo,
  secretoDeFragmento,
  siguienteLetraEnlace,
  textoAvisoRecepcion,
  totalesLote,
  urlEnlaceLote,
  validarLote,
  RE_FOLIO_LOTE,
  type Articulo,
  type ArticuloEscaneado,
  type ConteoLote,
  type Resurtido,
  type UbicacionResuelta,
} from "@shared";

/**
 * Tests de `shared/src/lotes.ts` y `enlaceLote.ts`: el lote de envío
 * (cajas → paquetes / sueltas). Lo que mueve inventario —confirmar el envío
 * y guardar una recepción— no debe sumar dos veces ni dejar entrar más de lo
 * declarado, aunque el lote venga mal armado desde un enlace.
 */
function art(over: Partial<Articulo> = {}): Articulo {
  return {
    id: "12300001",
    nombre: "Llavero Goku",
    sigla: "LG",
    referencia: "",
    codigo: "12300001",
    cantidad: "0",
    preciCompra: "10",
    precioVenta: "35",
    utilidad: "25",
    utilidadTotal: "0",
    fecha: "2026-11-16 10:00:00",
    ...over,
  };
}

const C1 = codigoEtiquetaLote(1);
const C2 = codigoEtiquetaLote(2);
const P1 = codigoEtiquetaLote(11);
const P2 = codigoEtiquetaLote(12);
const P3 = codigoEtiquetaLote(13);
const kC1 = llaveCajaLote(C1);
const kC2 = llaveCajaLote(C2);
const kP1 = llavePaqueteLote(P1);
const kP2 = llavePaqueteLote(P2);
const kP3 = llavePaqueteLote(P3);

const GOKU = "12300001";
const PLAYERA = "12300002";
const VAR_CH = "v-02-AAA";
const VAR_M = "v-02-BBB";

/** Caja 1: P1 y P2 (12 Goku c/u) + 5 Goku sueltos. Caja 2: P3 surtido
 *  (4 playeras CH + 4 M). Total: 29 Goku, 4 CH, 4 M. */
function lote(over: Partial<Resurtido> = {}): Resurtido {
  return {
    id: "L261116-A1",
    folio: "L261116-A1",
    estado: "enviado",
    sucursalDestinoId: "S2",
    sucursalDestinoNombre: "Mayoreo Centro",
    fechaCreacion: "2026-11-16 10:00:00",
    responsableEmpaco: "Juan",
    lineas: [],
    cajas: { [kC1]: { codigo: C1, orden: 1 }, [kC2]: { codigo: C2, orden: 2 } },
    paquetes: {
      [kP1]: { codigo: P1, caja: kC1, orden: 1, contenido: [{ articuloId: GOKU, piezas: 12 }] },
      [kP2]: { codigo: P2, caja: kC1, orden: 2, contenido: [{ articuloId: GOKU, piezas: 12 }] },
      [kP3]: {
        codigo: P3,
        caja: kC2,
        orden: 3,
        contenido: [
          { articuloId: PLAYERA, subvariacionCodigo: VAR_CH, piezas: 4 },
          { articuloId: PLAYERA, subvariacionCodigo: VAR_M, piezas: 4 },
        ],
      },
    },
    sueltas: { s1: { caja: kC1, orden: 1, articuloId: GOKU, piezas: 5 } },
    ...over,
  };
}

function catalogo(): Map<string, Articulo> {
  return new Map([
    [GOKU, art({ cantidadBodega: "40" })],
    [
      PLAYERA,
      art({
        id: PLAYERA,
        nombre: "Playera Luffy",
        sigla: "PL",
        cantidadBodega: "20",
        subvariaciones: [
          { codigo: VAR_CH, nombre: "CH", cantidad: "0", cantidadBodega: "10" },
          { codigo: VAR_M, nombre: "M", cantidad: "0", cantidadBodega: "10" },
        ],
      }),
    ],
  ]);
}

const S2: UbicacionResuelta = { tipo: "sucursal", sucursalId: "S2", esDefault: false };
const S1_DEFAULT: UbicacionResuelta = { tipo: "sucursal", sucursalId: "S1", esDefault: true };
const META = { fecha: "2026-11-18 12:00:00", quien: "Ana", nodoId: "n1" };

function conteo(over: Partial<ConteoLote> = {}): ConteoLote {
  return { ...conteoLoteVacio(), ...over };
}

function resolver(codigo: string): ArticuloEscaneado | null {
  if (codigo === GOKU) return { articuloId: GOKU, nombre: "Llavero Goku" };
  if (codigo === VAR_CH) {
    return { articuloId: PLAYERA, subvariacionCodigo: VAR_CH, nombre: "Playera Luffy — CH" };
  }
  if (codigo === PLAYERA) return { variacionesDe: PLAYERA, nombre: "Playera Luffy" };
  if (codigo === "999") return { articuloId: "999", nombre: "Otro" };
  return null;
}

describe("códigos del lote", () => {
  it("etiquetas: 12 dígitos, únicas y distintas de un id de artículo", () => {
    expect(codigoEtiquetaLote(1)).toBe("880000000001");
    expect(codigoEtiquetaLote(1234567890)).toBe("881234567890");
    expect(esCodigoEtiquetaLote("880000000001")).toBe(true);
    expect(esCodigoEtiquetaLote(" 880000000001 ")).toBe(true);
    expect(esCodigoEtiquetaLote("12300001")).toBe(false);
    expect(esCodigoEtiquetaLote("8800000000012")).toBe(false);
    expect(() => codigoEtiquetaLote(0)).toThrow();
    expect(() => codigoEtiquetaLote(1.5)).toThrow();
    expect(etiquetaLoteLegible("880000000123")).toBe("8800 0000 0123");
  });

  it("folio: sale de la fecha, la letra del acceso y el consecutivo", () => {
    expect(folioLote("2026-11-16", "A", 1)).toBe("L261116-A1");
    expect(folioLote("2026-01-05", "AB", 12)).toBe("L260105-AB12");
    expect(RE_FOLIO_LOTE.test(folioLote("2026-11-16", "A", 1))).toBe(true);
    expect(() => folioLote("16/11/2026", "A", 1)).toThrow();
  });

  it("letras de acceso: A…Z, AA… y la primera libre", () => {
    expect(letraEnlace(0)).toBe("A");
    expect(letraEnlace(25)).toBe("Z");
    expect(letraEnlace(26)).toBe("AA");
    expect(letraEnlace(27)).toBe("AB");
    expect(siguienteLetraEnlace([])).toBe("A");
    expect(siguienteLetraEnlace(["A", "B", "D"])).toBe("C");
  });

  it("clave de artículo: ida y vuelta, con y sin variación", () => {
    expect(claveArticulo(GOKU)).toBe(GOKU);
    expect(partirClaveArticulo(claveArticulo(PLAYERA, VAR_CH))).toEqual({
      articuloId: PLAYERA,
      subvariacionCodigo: VAR_CH,
    });
    expect(partirClaveArticulo(GOKU)).toEqual({ articuloId: GOKU });
  });
});

describe("forma y validación", () => {
  it("un resurtido simple no es lote; uno con cajas vacías sí", () => {
    expect(esLote({ cajas: undefined })).toBe(false);
    expect(esLote(null)).toBe(false);
    expect(esLote({ cajas: {} })).toBe(true);
  });

  it("totales: la suma de paquetes y sueltas es el total del lote", () => {
    expect(totalesLote(lote())).toEqual({ cajas: 2, paquetes: 3, piezas: 37, articulos: 3 });
  });

  it("un lote bien armado no tiene problemas", () => {
    expect(validarLote(lote())).toEqual([]);
  });

  it("detecta caja vacía, paquete sin caja y lote sin cajas", () => {
    const l = lote();
    delete l.paquetes![kP3];
    expect(validarLote(l)).toContain("La caja 2 está vacía");
    expect(validarLote(lote({ cajas: {} }))).toContain("El lote no tiene cajas");
    const huerfano = lote();
    huerfano.paquetes![kP1]!.caja = "c880000000099";
    expect(validarLote(huerfano).join("|")).toMatch(/no está en ninguna caja/);
  });

  it("rechaza cantidades hostiles: negativas, decimales, texto o mal formadas", () => {
    for (const piezas of [-500, 0, 1.5, "12", null, 1e9]) {
      const l = lote();
      l.paquetes![kP1]!.contenido = [{ articuloId: GOKU, piezas: piezas as number }];
      expect(validarLote(l).join("|")).toMatch(/cantidad inválida/);
    }
    const sinArreglo = lote();
    (sinArreglo.paquetes![kP1] as unknown as { contenido: unknown }).contenido = { a: 1 };
    expect(validarLote(sinArreglo).join("|")).toMatch(/está vacío/);
    const suelta = lote();
    suelta.sueltas!.s1!.piezas = -3;
    expect(validarLote(suelta).join("|")).toMatch(/sueltas con una cantidad inválida/);
  });

  it("una cantidad hostil no cuenta en los totales ni truena el resumen", () => {
    const l = lote();
    l.paquetes![kP1]!.contenido = [{ articuloId: GOKU, piezas: -500 }];
    (l.paquetes![kP2] as unknown as { contenido: unknown }).contenido = "x";
    expect(totalesLote(l).piezas).toBe(13); // 5 sueltas + 8 playeras
    expect(resumenLote(l).totales.declarado).toBe(13);
  });

  it("la misma etiqueta no puede ser caja y paquete, y la llave debe ser su código", () => {
    const l = lote();
    l.paquetes![llavePaqueteLote(C1)] = {
      codigo: C1,
      caja: kC1,
      orden: 9,
      contenido: [{ articuloId: GOKU, piezas: 1 }],
    };
    expect(validarLote(l).join("|")).toMatch(/está repetida/);
    const mal = lote();
    mal.paquetes!["pXYZ"] = { codigo: "XYZ", caja: kC1, orden: 9, contenido: [{ articuloId: GOKU, piezas: 1 }] };
    expect(validarLote(mal).join("|")).toMatch(/etiqueta inválida/);
  });
});

describe("confirmar el envío", () => {
  it("baja del taller lo declarado y arma `lineas` con nombres", () => {
    const plan = planearEnvioLote(lote(), catalogo());
    expect(plan.parches.get(GOKU)).toEqual({ cantidadBodega: "11" });
    const playera = plan.parches.get(PLAYERA)!;
    expect(playera.cantidadBodega).toBe("12");
    expect(playera.subvariaciones!.map((s) => s.cantidadBodega)).toEqual(["6", "6"]);
    expect(plan.lineas).toEqual([
      { articuloId: GOKU, nombreSnapshot: "Llavero Goku", siglaSnapshot: "LG", cantidadEnviada: 29 },
      {
        articuloId: PLAYERA,
        subvariacionCodigo: VAR_CH,
        nombreSnapshot: "Playera Luffy — CH",
        siglaSnapshot: "PL",
        cantidadEnviada: 4,
      },
      {
        articuloId: PLAYERA,
        subvariacionCodigo: VAR_M,
        nombreSnapshot: "Playera Luffy — M",
        siglaSnapshot: "PL",
        cantidadEnviada: 4,
      },
    ]);
    expect(plan.lineas.reduce((a, l) => a + l.cantidadEnviada, 0)).toBe(totalesLote(lote()).piezas);
  });

  it("sin piezas en el taller: dice TODO lo que falta y no planea nada", () => {
    const cat = catalogo();
    cat.set(GOKU, art({ cantidadBodega: "10" }));
    cat.delete(PLAYERA);
    try {
      planearEnvioLote(lote(), cat);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(LoteConProblemas);
      const p = (e as LoteConProblemas).problemas;
      expect(p).toHaveLength(3);
      expect(p.join("|")).toMatch(/Stock insuficiente de "Llavero Goku": hay 10, se piden 29/);
      expect(p.join("|")).toMatch(/12300002 ya no existe/);
    }
  });

  it("un lote mal armado no se envía aunque haya piezas", () => {
    const l = lote();
    l.paquetes![kP1]!.contenido = [{ articuloId: GOKU, piezas: -500 }];
    expect(() => planearEnvioLote(l, catalogo())).toThrow(LoteConProblemas);
  });

  it("artículo con variaciones sin elegir cuál: no se envía", () => {
    const l = lote();
    l.sueltas!.s2 = { caja: kC2, orden: 2, articuloId: PLAYERA, piezas: 1 };
    expect(() => planearEnvioLote(l, catalogo())).toThrow(/tiene variaciones/);
  });

  it("lineasDeLote sin catálogo usa el id como nombre", () => {
    expect(lineasDeLote(lote(), () => null)[0]!.nombreSnapshot).toBe(GOKU);
  });
});

describe("escaneo al recibir", () => {
  const base = { lote: lote(), hora: "12:00:01", resolverArticulo: resolver };

  it("etiqueta de caja: anota su llegada; repetida avisa", () => {
    const r = aplicarEscaneoLote({ ...base, conteo: conteo(), codigo: C1 });
    expect(r.tono).toBe("bien");
    expect(r.texto).toBe("Caja 1 de 2");
    expect(r.conteo.cajas).toEqual({ [kC1]: "12:00:01" });
    const otra = aplicarEscaneoLote({ ...base, conteo: r.conteo, codigo: C1 });
    expect(otra.tono).toBe("repetido");
    expect(otra.conteo).toBe(r.conteo);
  });

  it("etiqueta de paquete: cuenta su contenido y anota su caja", () => {
    const r = aplicarEscaneoLote({
      ...base,
      conteo: conteo(),
      codigo: ` ${P1} `,
      nombreArticulo: () => "Llavero Goku",
    });
    expect(r.tono).toBe("bien");
    expect(r.texto).toBe("Paquete: 12 × Llavero Goku");
    expect(r.conteo.paquetes).toEqual({ [kP1]: "12:00:01" });
    expect(r.conteo.cajas).toEqual({ [kC1]: "12:00:01" });
    expect(aplicarEscaneoLote({ ...base, conteo: r.conteo, codigo: P1 }).tono).toBe("repetido");
  });

  it("paquete ya recibido en otra sesión: repetido, no se vuelve a contar", () => {
    const yaRecibido = lote({
      estado: "parcial",
      recepcion: { sesiones: { s1: { tipo: "recepcion", fecha: "2026-11-17 09:00:00", quien: "Ana", paquetes: [kP1] } } },
    });
    const r = aplicarEscaneoLote({ ...base, lote: yaRecibido, conteo: conteo(), codigo: P1 });
    expect(r.tono).toBe("repetido");
    expect(r.conteo.paquetes).toEqual({});
  });

  it("artículo: una pieza, o cantidad + código", () => {
    const uno = aplicarEscaneoLote({ ...base, conteo: conteo(), codigo: GOKU });
    expect(uno.conteo.piezas).toEqual({ [GOKU]: 1 });
    expect(uno.texto).toBe("Llavero Goku: 1 de 29");
    const cinco = aplicarEscaneoLote({ ...base, conteo: uno.conteo, codigo: GOKU, cantidad: 4 });
    expect(cinco.conteo.piezas).toEqual({ [GOKU]: 5 });
    expect(cinco.tono).toBe("bien");
  });

  it("de más o fuera de la lista: se anota como sobrante", () => {
    const deMas = aplicarEscaneoLote({ ...base, conteo: conteo(), codigo: GOKU, cantidad: 31 });
    expect(deMas.tono).toBe("sobrante");
    expect(deMas.texto).toBe("Llavero Goku: 2 de más");
    expect(deMas.conteo.piezas).toEqual({ [GOKU]: 31 });
    const ajeno = aplicarEscaneoLote({ ...base, conteo: conteo(), codigo: "999" });
    expect(ajeno.tono).toBe("sobrante");
    expect(ajeno.texto).toBe("Otro no viene en este lote");
  });

  it("paquete escaneado y además contado pieza por pieza: sobra", () => {
    const conPaquetes = conteo({ paquetes: { [kP1]: "12:00:00", [kP2]: "12:00:00" } });
    const r = aplicarEscaneoLote({ ...base, conteo: conPaquetes, codigo: GOKU, cantidad: 6 });
    expect(r.tono).toBe("sobrante"); // 24 + 6 = 30 de 29
  });

  it("modo dañado: paquete y piezas van a su propia cuenta", () => {
    const p = aplicarEscaneoLote({ ...base, conteo: conteo(), codigo: P3, danado: true });
    expect(p.conteo.paquetesDanados).toEqual({ [kP3]: "12:00:01" });
    expect(p.conteo.paquetes).toEqual({});
    const pz = aplicarEscaneoLote({ ...base, conteo: conteo(), codigo: GOKU, cantidad: 2, danado: true });
    expect(pz.conteo.danadas).toEqual({ [GOKU]: 2 });
    expect(pz.texto).toMatch(/^Dañado · /);
  });

  it("id de un artículo con variaciones: pregunta cuál, sin contar", () => {
    const r = aplicarEscaneoLote({ ...base, conteo: conteo(), codigo: PLAYERA });
    expect(r.tono).toBe("pregunta");
    expect(r.elegirVariacionDe).toBe(PLAYERA);
    expect(r.conteo).toEqual(conteo());
  });

  it("etiqueta de otro lote o código raro: desconocido y queda anotado una vez", () => {
    const otra = codigoEtiquetaLote(777);
    const r = aplicarEscaneoLote({ ...base, conteo: conteo(), codigo: otra });
    expect(r.tono).toBe("desconocido");
    expect(r.texto).toBe("Esa etiqueta no es de este lote");
    const r2 = aplicarEscaneoLote({ ...base, conteo: r.conteo, codigo: otra });
    expect(r2.conteo.desconocidos).toEqual([otra]);
    expect(aplicarEscaneoLote({ ...base, conteo: conteo(), codigo: "zzz" }).texto).toBe('No se reconoce "zzz"');
    expect(aplicarEscaneoLote({ ...base, conteo: conteo(), codigo: "  " }).conteo.desconocidos).toEqual([]);
  });

  it("corregir el conteo: fijar piezas y quitar un paquete", () => {
    const c = conteo({ piezas: { [GOKU]: 5 }, paquetes: { [kP1]: "12:00:00" } });
    expect(fijarPiezasConteo(c, GOKU, 3).piezas).toEqual({ [GOKU]: 3 });
    expect(fijarPiezasConteo(c, GOKU, 0).piezas).toEqual({});
    expect(fijarPiezasConteo(c, GOKU, 2, true).danadas).toEqual({ [GOKU]: 2 });
    expect(quitarPaqueteConteo(c, kP1).paquetes).toEqual({});
  });
});

describe("resumen: declarado contra contado", () => {
  it("lote recién enviado: todo pendiente", () => {
    const r = resumenLote(lote());
    expect(r.totales).toMatchObject({ declarado: 37, pendiente: 37, bien: 0, sobrante: 0 });
    expect(r.paquetesTotal).toBe(3);
    expect(r.cajasTotal).toBe(2);
    expect(r.paquetes.get(kP1)).toEqual({ estado: "pendiente" });
  });

  it("varias sesiones, dañado y no llegó; un paquete cuenta una sola vez", () => {
    const l = lote({
      estado: "parcial",
      recepcion: {
        sesiones: {
          s2: {
            tipo: "recepcion",
            fecha: "2026-11-18 09:00:00",
            quien: "Beto",
            paquetes: [kP1], // repetido: ya venía en s1
            paquetesDanados: [kP3],
            danadas: { [GOKU]: 1 },
          },
          s1: {
            tipo: "recepcion",
            fecha: "2026-11-17 09:00:00",
            quien: "Ana",
            cajas: [kC1],
            paquetes: [kP1],
            piezas: { [GOKU]: 4 },
            entro: { [GOKU]: 16 },
            horas: { [kP1]: "09:00:05", [kC1]: "09:00:01" },
          },
          s3: { tipo: "no_llego", fecha: "2026-11-20 10:00:00", quien: "admin", noLlego: { [GOKU]: 12 } },
        },
      },
    });
    const r = resumenLote(l);
    expect(r.porArticulo.get(GOKU)).toEqual({
      declarado: 29,
      bien: 16,
      danado: 1,
      noLlego: 12,
      pendiente: 0,
      sobrante: 0,
      entro: 16,
    });
    expect(r.porArticulo.get(claveArticulo(PLAYERA, VAR_CH))).toMatchObject({ danado: 4, pendiente: 0 });
    expect(r.paquetes.get(kP1)).toEqual({ estado: "recibido", sesion: "s1", hora: "09:00:05" });
    expect(r.paquetes.get(kP3)!.estado).toBe("danado");
    expect(r.paquetes.get(kP2)!.estado).toBe("pendiente");
    expect(r.cajasLlegadas.get(kC1)).toEqual({ sesion: "s1", hora: "09:00:01" });
    expect(r.paquetesRecibidos).toBe(1);
    expect(r.paquetesDanados).toBe(1);
    expect(r.totales.pendiente).toBe(0);
  });

  it("pendiente por artículo padre (lo que Fabricación llama en tránsito)", () => {
    const m = pendientePorArticuloId(lote());
    expect(m.get(GOKU)).toBe(29);
    expect(m.get(PLAYERA)).toBe(8);
  });

  it("el conteo sin guardar se ve en el avance", () => {
    const r = resumenLoteConConteo(lote(), conteo({ paquetes: { [kP1]: "12:00:00" }, piezas: { [GOKU]: 2 } }));
    expect(r.porArticulo.get(GOKU)).toMatchObject({ bien: 14, pendiente: 15 });
    expect(r.paquetesRecibidos).toBe(1);
  });
});

describe("guardar una recepción", () => {
  it("todo el lote escaneado: entra exacto y se cierra", () => {
    const plan = planearRecepcionLote({
      lote: lote(),
      conteo: conteo({
        cajas: { [kC1]: "12:00:00", [kC2]: "12:01:00" },
        paquetes: { [kP1]: "12:00:05", [kP2]: "12:00:07", [kP3]: "12:01:05" },
        piezas: { [GOKU]: 5 },
      }),
      articulos: catalogo(),
      ubicacion: S2,
      meta: META,
    });
    expect(plan.estado).toBe("cerrado");
    expect(plan.vacia).toBe(false);
    expect(plan.sesion.entro).toEqual({
      [GOKU]: 29,
      [claveArticulo(PLAYERA, VAR_CH)]: 4,
      [claveArticulo(PLAYERA, VAR_M)]: 4,
    });
    expect(plan.sesion.sobrantes).toBeUndefined();
    expect(plan.sesion.horas).toEqual({
      [kC1]: "12:00:00",
      [kC2]: "12:01:00",
      [kP1]: "12:00:05",
      [kP2]: "12:00:07",
      [kP3]: "12:01:05",
    });
    // Sucursal que no es la principal: entra a cantidadPorSucursal.
    expect(plan.parches.get(GOKU)).toEqual({ cantidadPorSucursal: { S2: "29" } });
    const subs = plan.parches.get(PLAYERA)!.subvariaciones!;
    expect(subs.map((s) => s.cantidadPorSucursal)).toEqual([{ S2: "4" }, { S2: "4" }]);
    expect(plan.parches.get(PLAYERA)).not.toHaveProperty("cantidad");
  });

  it("sucursal principal: entra a `cantidad` y el padre guarda la suma", () => {
    const plan = planearRecepcionLote({
      lote: lote({ sucursalDestinoId: "S1" }),
      conteo: conteo({ paquetes: { [kP1]: "12:00:00", [kP3]: "12:00:01" } }),
      articulos: catalogo(),
      ubicacion: S1_DEFAULT,
      meta: META,
    });
    expect(plan.estado).toBe("parcial");
    expect(plan.parches.get(GOKU)).toEqual({ cantidad: "12" });
    expect(plan.parches.get(PLAYERA)!.cantidad).toBe("8");
  });

  it("recepción en dos días: la segunda solo suma lo nuevo", () => {
    const dia1 = planearRecepcionLote({
      lote: lote(),
      conteo: conteo({ paquetes: { [kP1]: "12:00:00" } }),
      articulos: catalogo(),
      ubicacion: S2,
      meta: META,
    });
    expect(dia1.estado).toBe("parcial");
    const cat = catalogo();
    cat.set(GOKU, { ...cat.get(GOKU)!, ...dia1.parches.get(GOKU) });
    const guardado = lote({ estado: "parcial", recepcion: { sesiones: { s1: dia1.sesion } } });
    // La otra tablet todavía trae P1 en su conteo.
    const dia2 = planearRecepcionLote({
      lote: guardado,
      conteo: conteo({ paquetes: { [kP1]: "12:00:00", [kP2]: "09:00:00" } }),
      articulos: cat,
      ubicacion: S2,
      meta: { ...META, fecha: "2026-11-19 09:00:00" },
    });
    expect(dia2.sesion.paquetes).toEqual([kP2]);
    expect(dia2.sesion.entro).toEqual({ [GOKU]: 12 });
    expect(dia2.parches.get(GOKU)).toEqual({ cantidadPorSucursal: { S2: "24" } });
  });

  it("reintento con el mismo conteo ya guardado: no entra nada y sale vacía", () => {
    const c = conteo({ cajas: { [kC1]: "12:00:00" }, paquetes: { [kP1]: "12:00:00" } });
    const primero = planearRecepcionLote({ lote: lote(), conteo: c, articulos: catalogo(), ubicacion: S2, meta: META });
    const guardado = lote({ estado: "parcial", recepcion: { sesiones: { s1: primero.sesion } } });
    const otra = planearRecepcionLote({ lote: guardado, conteo: c, articulos: catalogo(), ubicacion: S2, meta: META });
    expect(otra.vacia).toBe(true);
    expect(otra.parches.size).toBe(0);
    expect(otra.sesion.entro).toBeUndefined();
  });

  it("dos tablets cuentan las mismas piezas sueltas: entra hasta lo pendiente y lo demás sobra", () => {
    const a = planearRecepcionLote({
      lote: lote(),
      conteo: conteo({ piezas: { [GOKU]: 20 } }),
      articulos: catalogo(),
      ubicacion: S2,
      meta: META,
    });
    const guardado = lote({ estado: "parcial", recepcion: { sesiones: { s1: a.sesion } } });
    const b = planearRecepcionLote({
      lote: guardado,
      conteo: conteo({ piezas: { [GOKU]: 20 } }),
      articulos: catalogo(),
      ubicacion: S2,
      meta: META,
    });
    expect(b.sesion.entro).toEqual({ [GOKU]: 9 });
    expect(b.sesion.sobrantes).toEqual({ [GOKU]: 11 });
    expect(b.sesion.piezas).toEqual({ [GOKU]: 20 });
  });

  it("dañado no entra; lo que no venía en la lista sobra y no entra", () => {
    const plan = planearRecepcionLote({
      lote: lote(),
      conteo: conteo({
        paquetesDanados: { [kP3]: "12:00:00" },
        danadas: { [GOKU]: 2 },
        piezas: { [GOKU]: 3, "999": 4 },
      }),
      articulos: catalogo(),
      ubicacion: S2,
      meta: META,
    });
    expect(plan.sesion.entro).toEqual({ [GOKU]: 3 });
    expect(plan.sesion.sobrantes).toEqual({ "999": 4 });
    expect(plan.sesion.paquetesDanados).toEqual([kP3]);
    expect(plan.parches.has(PLAYERA)).toBe(false);
    const despues = resumenLote(lote({ recepcion: { sesiones: { s1: plan.sesion } } }));
    expect(despues.porArticulo.get(GOKU)).toMatchObject({ bien: 3, danado: 2, pendiente: 24 });
    expect(despues.porArticulo.get("999")).toMatchObject({ declarado: 0, sobrante: 4 });
  });

  it("lo bueno entra antes que lo dañado cuando juntos pasan de lo declarado", () => {
    const plan = planearRecepcionLote({
      lote: lote(),
      conteo: conteo({ piezas: { [GOKU]: 29 }, danadas: { [GOKU]: 2 } }),
      articulos: catalogo(),
      ubicacion: S2,
      meta: META,
    });
    expect(plan.sesion.entro).toEqual({ [GOKU]: 29 });
    expect(plan.sesion.sobrantes).toEqual({ [GOKU]: 2 });
  });

  it("artículo o variación borrados: no bloquea, queda sin entrar al inventario", () => {
    const cat = catalogo();
    cat.delete(GOKU);
    cat.set(PLAYERA, { ...cat.get(PLAYERA)!, subvariaciones: [cat.get(PLAYERA)!.subvariaciones![0]!] });
    const plan = planearRecepcionLote({
      lote: lote(),
      conteo: conteo({ paquetes: { [kP1]: "12:00:00", [kP3]: "12:00:01" } }),
      articulos: cat,
      ubicacion: S2,
      meta: META,
    });
    expect(plan.sesion.entro).toEqual({ [claveArticulo(PLAYERA, VAR_CH)]: 4 });
    expect(plan.sesion.sinStock).toEqual([
      { clave: GOKU, piezas: 12, motivo: "El artículo ya no existe" },
      { clave: claveArticulo(PLAYERA, VAR_M), piezas: 4, motivo: expect.stringMatching(/no existe/) },
    ]);
    // Lo contado sí cuenta como recibido: ya no está pendiente.
    const despues = resumenLote(lote({ recepcion: { sesiones: { s1: plan.sesion } } }));
    expect(despues.porArticulo.get(GOKU)!.pendiente).toBe(17);
    expect(despues.sinStock).toHaveLength(2);
  });

  it("no acepta un lote sin enviar, uno cerrado ni un nombre vacío", () => {
    const args = { conteo: conteo(), articulos: catalogo(), ubicacion: S2, meta: META };
    expect(() => planearRecepcionLote({ ...args, lote: lote({ estado: "creando" }) })).toThrow(/no se ha enviado/);
    expect(() => planearRecepcionLote({ ...args, lote: lote({ estado: "cerrado" }) })).toThrow(/ya está cerrado/);
    expect(() =>
      planearRecepcionLote({ ...args, lote: lote(), meta: { ...META, quien: "  " } }),
    ).toThrow(/nombre de quien recibe/);
  });

  it("la sesión no lleva campos vacíos ni undefined (Firestore los rechaza)", () => {
    const plan = planearRecepcionLote({
      lote: lote(),
      conteo: conteo({ cajas: { [kC1]: "12:00:00" } }),
      articulos: catalogo(),
      ubicacion: S2,
      meta: { fecha: META.fecha, quien: " Ana " },
    });
    expect(plan.sesion).toEqual({
      tipo: "recepcion",
      fecha: META.fecha,
      quien: "Ana",
      cajas: [kC1],
      horas: { [kC1]: "12:00:00" },
    });
    expect(plan.vacia).toBe(false);
    expect(plan.estado).toBe("parcial");
  });
});

describe('"no llegó" y aviso', () => {
  it("declara todo lo pendiente y cierra", () => {
    const l = lote({
      estado: "parcial",
      recepcion: { sesiones: { s1: { tipo: "recepcion", fecha: "2026-11-17 09:00:00", quien: "Ana", paquetes: [kP1, kP2, kP3] } } },
    });
    const plan = planearNoLlegoLote(l, { fecha: "2026-11-20 10:00:00", quien: "admin@x.com", nota: " paquetería " });
    expect(plan.estado).toBe("cerrado");
    expect(plan.sesion).toEqual({
      tipo: "no_llego",
      fecha: "2026-11-20 10:00:00",
      quien: "admin@x.com",
      noLlego: { [GOKU]: 5 },
      nota: "paquetería",
    });
    const cerrado = resumenLote({ ...l, recepcion: { sesiones: { ...l.recepcion!.sesiones, s2: plan.sesion } } });
    expect(cerrado.totales.pendiente).toBe(0);
  });

  it("sin pendientes o sin enviar: no se puede", () => {
    expect(() => planearNoLlegoLote(lote({ estado: "creando" }), { fecha: "x", quien: "a" })).toThrow();
    const completo = lote({
      estado: "parcial",
      recepcion: {
        sesiones: {
          s1: { tipo: "recepcion", fecha: "2026-11-17 09:00:00", quien: "Ana", paquetes: [kP1, kP2, kP3], piezas: { [GOKU]: 5 } },
        },
      },
    });
    expect(() => planearNoLlegoLote(completo, { fecha: "x", quien: "a" })).toThrow(/nada pendiente/);
  });

  it("el aviso resume la sesión", () => {
    const l = lote();
    const plan = planearRecepcionLote({
      lote: l,
      conteo: conteo({ paquetes: { [kP1]: "12:00:00" }, paquetesDanados: { [kP3]: "12:00:01" }, piezas: { "999": 2 } }),
      articulos: catalogo(),
      ubicacion: S2,
      meta: META,
    });
    const despues = resumenLote({ ...l, recepcion: { sesiones: { s1: plan.sesion } } });
    expect(textoAvisoRecepcion(l, plan.sesion, despues)).toBe(
      "📦 Lote L261116-A1 en Mayoreo Centro. Recibió: Ana. Paquetes: 2 de 3. Entraron 12 pzas. Dañadas: 8. Sobrantes: 2. Faltan 17 pzas.",
    );
  });
});

describe("enlaces", () => {
  it("el secreto son 43 caracteres de base64url y no se repite", () => {
    const a = generarSecretoEnlace();
    const b = generarSecretoEnlace();
    expect(esSecretoEnlace(a)).toBe(true);
    expect(a).not.toBe(b);
    expect(esSecretoEnlace("corto")).toBe(false);
    expect(esSecretoEnlace(undefined)).toBe(false);
  });

  it("la huella es el sha256 en hex (igual que en functions)", async () => {
    expect(await hashSecretoEnlace("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("la URL lleva el secreto después del # y se puede leer de vuelta", () => {
    const secreto = generarSecretoEnlace();
    const url = urlEnlaceLote("https://amise-mercancia.web.app/", "neg1", "enl1", secreto);
    expect(url).toBe(`https://amise-mercancia.web.app/enlace/neg1/enl1#${secreto}`);
    expect(secretoDeFragmento(new URL(url).hash)).toBe(secreto);
    expect(secretoDeFragmento("#nada")).toBeNull();
    expect(secretoDeFragmento("")).toBeNull();
  });

  it("ids de foto: dos dígitos y tope de 30 por teléfono", () => {
    expect(idFotoLote("enl_x_1", 0)).toBe("enl_x_1_00");
    expect(idFotoLote("enl_x_1", 29)).toBe("enl_x_1_29");
    expect(() => idFotoLote("enl_x_1", 30)).toThrow();
    expect(() => idFotoLote("enl_x_1", -1)).toThrow();
  });
});
