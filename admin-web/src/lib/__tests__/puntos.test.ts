import { describe, expect, it } from "vitest";
import {
  clasificarErrorPuntos,
  descartarTrasFallo,
  esValorPuntos,
  esperaRegistroPuntos,
  esperaReintentoMs,
  necesitaAtencionPuntos,
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
