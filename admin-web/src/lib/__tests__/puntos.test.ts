import { describe, expect, it } from "vitest";
import {
  clasificarErrorPuntos,
  correoValido,
  desgloseVenta,
  ean13Ok,
  enmascararCorreo,
  descartarTrasFallo,
  esValorPuntos,
  esperaRegistroPuntos,
  esperaReintentoMs,
  necesitaAtencionPuntos,
  pendienteVigente,
  recortarColaPuntos,
  telefonosIguales,
  MAX_INTENTOS_CANDADO,
} from "@shared";

/**
 * Tests de la cola de lealtad de la caja (`shared/src/puntos.ts`): lo que vale
 * dinero nunca se descarta solo, y una red caída (que del lado del navegador
 * llega como `internal` sin detalle) se reintenta.
 */
const err = (code: string, details?: unknown) => ({ code: `functions/${code}`, details });

describe("clasificarErrorPuntos", () => {
  it("red caída (internal sin detalle) se reintenta", () => {
    expect(clasificarErrorPuntos("gift", err("internal"))).toBe("reintentar");
    expect(clasificarErrorPuntos("earn", err("unavailable"))).toBe("reintentar");
    expect(clasificarErrorPuntos("card", err("deadline-exceeded"))).toBe("reintentar");
    expect(clasificarErrorPuntos("earn", err("unauthenticated"))).toBe("reintentar");
    expect(clasificarErrorPuntos("earn", new Error("x"))).toBe("reintentar");
  });

  it("amise con retriable true se reintenta; con false es definitivo", () => {
    expect(clasificarErrorPuntos("earn", err("unavailable", { retriable: true }))).toBe(
      "reintentar",
    );
    expect(
      clasificarErrorPuntos("gift", err("internal", { amiseStatus: 400, retriable: false })),
    ).toBe("definitivo");
  });

  it("rechazos del servidor son definitivos", () => {
    for (const code of ["invalid-argument", "failed-precondition", "permission-denied",
      "not-found"]) {
      expect(clasificarErrorPuntos("earn", err(code))).toBe("definitivo");
    }
  });

  it("ya existe: hecho en el registro, definitivo en lo demás (tarjeta en uso)", () => {
    expect(clasificarErrorPuntos("register", err("already-exists"))).toBe("hecho");
    expect(clasificarErrorPuntos("card", err("already-exists"))).toBe("definitivo");
    expect(clasificarErrorPuntos("gift", err("already-exists"))).toBe("definitivo");
  });
});

describe("política de la cola", () => {
  it("lo que vale dinero nunca se descarta; los candados sí, tras 60 intentos", () => {
    for (const tipo of ["register", "earn", "card", "gift", "giftRecarga"]) {
      expect(esValorPuntos(tipo)).toBe(true);
      expect(descartarTrasFallo(tipo, 10_000)).toBe(false);
    }
    for (const tipo of ["cerrar", "cerrarRegalo", "canje"]) {
      expect(esValorPuntos(tipo)).toBe(false);
      expect(descartarTrasFallo(tipo, MAX_INTENTOS_CANDADO - 1)).toBe(false);
      expect(descartarTrasFallo(tipo, MAX_INTENTOS_CANDADO)).toBe(true);
    }
  });

  it("espera creciente: 1, 5 y 30 minutos", () => {
    expect(esperaReintentoMs(1)).toBe(60_000);
    expect(esperaReintentoMs(3)).toBe(60_000);
    expect(esperaReintentoMs(4)).toBe(300_000);
    expect(esperaReintentoMs(6)).toBe(300_000);
    expect(esperaReintentoMs(7)).toBe(1_800_000);
    expect(esperaReintentoMs(500)).toBe(1_800_000);
  });

  it("el tope recorta solo candados viejos, nunca valor", () => {
    const valor = Array.from({ length: 101 }, (_, i) => ({ id: `e${i}`, tipo: "earn" }));
    expect(recortarColaPuntos(valor)).toHaveLength(101);
    // 101 ítems: sobra 1 → se va el candado más viejo; el valor se queda.
    const mezcla = [
      { id: "c1", tipo: "cerrar" },
      ...valor.slice(0, 98),
      { id: "c2", tipo: "cerrarRegalo" },
      { id: "e-nuevo", tipo: "earn" },
    ];
    const r = recortarColaPuntos(mezcla);
    expect(r).toHaveLength(100);
    expect(r.some((x) => x.id === "c1")).toBe(false);
    expect(r.some((x) => x.id === "c2")).toBe(true);
    expect(r.filter((x) => x.tipo === "earn")).toHaveLength(99);
  });

  it("necesitaAtencion: valor con 5 intentos o más de 15 min", () => {
    const ahora = 1_000_000_000;
    const base = { id: "a", tipo: "earn", payload: {}, intentos: 0, creadoEn: ahora };
    expect(necesitaAtencionPuntos(base, ahora)).toBe(false);
    expect(necesitaAtencionPuntos({ ...base, intentos: 5 }, ahora)).toBe(true);
    expect(necesitaAtencionPuntos({ ...base, creadoEn: ahora - 16 * 60_000 }, ahora)).toBe(true);
    expect(necesitaAtencionPuntos({ ...base, tipo: "cerrar", intentos: 50 }, ahora)).toBe(false);
    // ítem de la versión anterior (sin creadoEn): solo por intentos
    expect(necesitaAtencionPuntos({ ...base, creadoEn: undefined }, ahora)).toBe(false);
  });

  it("acumular y tarjeta esperan al registro del mismo teléfono", () => {
    const reg = { id: "r", tipo: "register", payload: { phone: "55 1111 1111" }, intentos: 0 };
    const earn = { id: "e", tipo: "earn", payload: { phone: "+525511111111" }, intentos: 0 };
    const card = { id: "c", tipo: "card", payload: { phone: "5511111111" }, intentos: 0 };
    const otro = { id: "o", tipo: "earn", payload: { phone: "5522222222" }, intentos: 0 };
    const gift = { id: "g", tipo: "gift", payload: { phone: "5511111111" }, intentos: 0 };
    const cola = [reg, earn, card, otro, gift];
    expect(esperaRegistroPuntos(earn, cola)).toBe(true);
    expect(esperaRegistroPuntos(card, cola)).toBe(true);
    expect(esperaRegistroPuntos(otro, cola)).toBe(false);
    expect(esperaRegistroPuntos(gift, cola)).toBe(false);
    expect(esperaRegistroPuntos(earn, [earn, card])).toBe(false);
  });

  it("telefonosIguales compara los últimos 10 dígitos", () => {
    expect(telefonosIguales("+52 55 1111 1111", "5511111111")).toBe(true);
    expect(telefonosIguales("5511111111", "5511111112")).toBe(false);
    expect(telefonosIguales("123", "123")).toBe(false);
    expect(telefonosIguales(undefined, null)).toBe(false);
  });
});

describe("desgloseVenta", () => {
  const cuadra = (d: { articulos: number; cashback: number; regalo: number; total: number }) =>
    Math.abs(d.articulos - d.cashback - d.regalo - d.total) < 0.005;

  it("venta sin descuentos ni comisión", () => {
    const d = desgloseVenta({ articulos: [{ cantidad: "2", precio: "100" }], montoCobro: "200" });
    expect(d).toEqual({ articulos: 200, cashback: 0, regalo: 0, total: 200, comision: 0,
      totalConComision: 200 });
  });

  it("con cashback, con regalo y con ambos: artículos − descuentos = total", () => {
    const arts = [{ cantidad: "2", precio: "100" }];
    const c = desgloseVenta({ articulos: arts, montoCobro: "170", descuentoPuntos: "30" });
    expect(c.cashback).toBe(30);
    expect(cuadra(c)).toBe(true);
    const r = desgloseVenta({ articulos: arts, montoCobro: "150", descuentoRegalo: "50" });
    expect(r.regalo).toBe(50);
    expect(cuadra(r)).toBe(true);
    const ambos = desgloseVenta({ articulos: arts, montoCobro: "120", descuentoPuntos: "30",
      descuentoRegalo: "50" });
    expect(cuadra(ambos)).toBe(true);
  });

  it("comisión solo con tarjeta y 'con comision'", () => {
    const base = { articulos: [{ cantidad: "1", precio: "100" }], montoCobro: "100",
      comicion: "7" };
    const t = desgloseVenta({ ...base, movimiento: "pagoTarjeta", statusComision: "con comision" });
    expect(t.comision).toBe(7);
    expect(t.totalConComision).toBe(107);
    expect(desgloseVenta({ ...base, movimiento: "pagoTarjeta",
      statusComision: "sin comision" }).comision).toBe(0);
    expect(desgloseVenta({ ...base, movimiento: "pagoEfectivo",
      statusComision: "con comision" }).comision).toBe(0);
  });

  it("3x2, mayoreo, línea de tarjeta y de regalo cuentan como artículos", () => {
    const d = desgloseVenta({
      articulos: [
        { cantidad: "3", precio: "100", aply_3x2: "1" }, // 200
        { cantidad: "10", precio: "35", descuento: "30" }, // 300
        { cantidad: "1", precio: "30" }, // tarjeta de cashback
        { cantidad: "1", precio: "300" }, // tarjeta de regalo
      ],
      montoCobro: "810",
      descuentoPuntos: "20",
    });
    expect(d.articulos).toBe(830);
    expect(cuadra(d)).toBe(true);
  });

  it("ventas viejas sin campos o con datos raros no truenan", () => {
    expect(desgloseVenta({})).toEqual({ articulos: 0, cashback: 0, regalo: 0, total: 0,
      comision: 0, totalConComision: 0 });
    const raro = desgloseVenta({ montoCobro: "abc", descuentoPuntos: "-5", comicion: "x",
      movimiento: "pagoTarjeta", statusComision: "con comision" });
    expect(raro.total).toBe(0);
    expect(raro.cashback).toBe(0);
    expect(raro.comision).toBe(0);
  });

  it("admin puede pasar su propia suma de artículos (ventas legacy)", () => {
    const d = desgloseVenta({ articulos: [{ cantidad: "1" }], montoCobro: "90",
      descuentoPuntos: "10" }, 100);
    expect(d.articulos).toBe(100);
    expect(cuadra(d)).toBe(true);
  });
});

describe("tarjeta y correo", () => {
  it("ean13Ok valida el dígito verificador", () => {
    for (const ok of ["4006381333931", "9780306406157", "7501000000012", "7502000000019"]) {
      expect(ean13Ok(ok)).toBe(true);
    }
    for (const mal of ["4006381333932", "750100000001", "75010000000120", "750100000001a", ""]) {
      expect(ean13Ok(mal)).toBe(false);
    }
  });

  it("correoValido", () => {
    expect(correoValido("ana@demo.test")).toBe(true);
    expect(correoValido("  ana@demo.test ")).toBe(true);
    expect(correoValido("ana@demo")).toBe(false);
    expect(correoValido("ana demo@x.mx")).toBe(false);
  });

  it("enmascararCorreo oculta y es idempotente (igual que el servidor)", () => {
    expect(enmascararCorreo("juan@gmail.com")).toBe("ju•••@gmail.com");
    expect(enmascararCorreo("a@x.com")).toBe("a•••@x.com");
    expect(enmascararCorreo("ju•••@gmail.com")).toBe("ju•••@gmail.com");
    expect(enmascararCorreo("sin-arroba")).toBe("•••");
    expect(enmascararCorreo(undefined)).toBe("");
  });
});

describe("pendienteVigente", () => {
  const ahora = 1_800_000_000_000;
  it("vigente menos de una hora", () => {
    expect(pendienteVigente({ creadoEn: ahora }, ahora)).toBe(true);
    expect(pendienteVigente({ creadoEn: ahora - 59 * 60_000 }, ahora)).toBe(true);
  });
  it("vencido a la hora, sin fecha o con fecha futura (reloj movido)", () => {
    expect(pendienteVigente({ creadoEn: ahora - 60 * 60_000 }, ahora)).toBe(false);
    expect(pendienteVigente({ creadoEn: ahora - 2 * 3600_000 }, ahora)).toBe(false);
    expect(pendienteVigente({}, ahora)).toBe(false);
    expect(pendienteVigente(null, ahora)).toBe(false);
    expect(pendienteVigente({ creadoEn: ahora + 60_000 }, ahora)).toBe(false);
  });
});
