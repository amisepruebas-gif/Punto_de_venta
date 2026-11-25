import { describe, expect, it } from "vitest";
import { ESPERA_ENVIO_SIN_RASTRO_MS, veredictoEnvioPendiente } from "@shared";

/**
 * Tests de `shared/src/movimientoPendiente.ts`: qué se sabe de un envío de
 * «Mover piezas» que quedó sin respuesta, leyendo su registro. La pantalla
 * solo suelta la lista con "no-aplicado" o "ajeno".
 */

const T0 = 1_700_000_000_000;
const base = { usuarioId: "u1", enviadoMs: T0 };

describe("veredictoEnvioPendiente", () => {
  it("el registro existe a nombre de la persona: se aplicó", () => {
    expect(
      veredictoEnvioPendiente({ ...base, existe: true, usuarioIdRegistro: "u1", ahoraMs: T0 + 1 }),
    ).toBe("aplicado");
  });

  it("se aplicó aunque ya haya pasado mucho tiempo", () => {
    expect(
      veredictoEnvioPendiente({
        ...base,
        existe: true,
        usuarioIdRegistro: "u1",
        ahoraMs: T0 + 10 * ESPERA_ENVIO_SIN_RASTRO_MS,
      }),
    ).toBe("aplicado");
  });

  it("el registro es de otra persona: ese id nunca fue de este envío", () => {
    expect(
      veredictoEnvioPendiente({ ...base, existe: true, usuarioIdRegistro: "u2", ahoraMs: T0 + 1 }),
    ).toBe("ajeno");
    expect(veredictoEnvioPendiente({ ...base, existe: true, ahoraMs: T0 + 1 })).toBe("ajeno");
  });

  it("sin registro y recién enviado: todavía podría aplicarse", () => {
    expect(veredictoEnvioPendiente({ ...base, existe: false, ahoraMs: T0 })).toBe("sin-saber");
    expect(
      veredictoEnvioPendiente({
        ...base,
        existe: false,
        ahoraMs: T0 + ESPERA_ENVIO_SIN_RASTRO_MS - 1,
      }),
    ).toBe("sin-saber");
  });

  it("sin registro y ya pasó el tiempo: no se movió nada", () => {
    expect(
      veredictoEnvioPendiente({ ...base, existe: false, ahoraMs: T0 + ESPERA_ENVIO_SIN_RASTRO_MS }),
    ).toBe("no-aplicado");
    expect(
      veredictoEnvioPendiente({ ...base, existe: false, ahoraMs: T0 + 3_600_000 }),
    ).toBe("no-aplicado");
  });

  it("si el reloj se movió hacia atrás no da por no aplicado antes de tiempo", () => {
    expect(veredictoEnvioPendiente({ ...base, existe: false, ahoraMs: T0 - 3_600_000 })).toBe(
      "sin-saber",
    );
  });

  it("la espera cubre lo que aguanta la app (40 s) más lo que tarda la function (30 s)", () => {
    expect(ESPERA_ENVIO_SIN_RASTRO_MS).toBeGreaterThanOrEqual(70_000);
  });
});
