import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import {
  AVISO_CASHBACK,
  calcularVence,
  enmascararTelefono,
  ganadoCentavos,
  inicioAnioSiguienteMX,
  leerQrCashback,
  normalizarTelefono10,
  pesosDeCentavos,
  pinTrivial,
  saldoVigenteCentavos,
  textoAperturaCuenta,
  textoVigencia,
  validarConfigCashback,
  type VigenciaCashback,
} from "@shared";

// La lógica del servidor es una copia a mano de la compartida: aquí se
// compara que las dos den lo mismo.
const servidor = createRequire(import.meta.url)("../../../../functions/lib/cashbackMayoreo.js");

const MX = (iso: string) => Date.parse(`${iso}-06:00`);

describe("cashback de mayoreo — compartido", () => {
  it("vence a más tardar el 1 de enero siguiente (México)", () => {
    const v: VigenciaCashback = { cantidad: 1, unidad: "meses" };
    expect(new Date(calcularVence(MX("2026-03-15T12:00:00"), v)).toISOString()).toBe(
      new Date(MX("2026-04-15T12:00:00")).toISOString(),
    );
    expect(new Date(calcularVence(MX("2026-12-20T12:00:00"), v)).toISOString()).toBe(
      "2027-01-01T06:00:00.000Z",
    );
    expect(new Date(inicioAnioSiguienteMX(MX("2026-12-31T23:59:00"))).toISOString()).toBe(
      "2027-01-01T06:00:00.000Z",
    );
  });

  it("saldo vigente, ganancia y pesos", () => {
    expect(saldoVigenteCentavos({ saldoCentavos: 500, venceISO: "2026-01-01T00:00:00Z" }, Date.parse("2026-02-01"))).toBe(0);
    expect(saldoVigenteCentavos({ saldoCentavos: 500 }, Date.now())).toBe(500);
    expect(ganadoCentavos(123.45, 3)).toBe(370);
    expect(pesosDeCentavos(3700)).toBe("$37");
    expect(pesosDeCentavos(370)).toBe("$3.70");
  });

  it("teléfono, QR y PIN", () => {
    expect(normalizarTelefono10("+52 55 1234 5678")).toBe("5512345678");
    expect(normalizarTelefono10("123")).toBeNull();
    expect(enmascararTelefono("5512345678")).toBe("•••• •• 5678");
    expect(leerQrCashback(" cbm23456789abcdefghjkmnpq ")).toBe("CBM23456789ABCDEFGHJKMNPQ");
    expect(leerQrCashback("12300006")).toBeNull();
    expect(pinTrivial("1234")).toBe(true);
    expect(pinTrivial("4071")).toBe(false);
  });

  it("textos: vigencia, config y lo que se le lee al cliente", () => {
    expect(textoVigencia({ cantidad: 10, unidad: "dias" })).toBe("10 días");
    expect(textoVigencia({ cantidad: 1, unidad: "meses" })).toBe("1 mes");
    expect(textoVigencia({ cantidad: 2, unidad: "anios" })).toBe("2 años");
    expect(validarConfigCashback({ pct: 3, vigencia: { cantidad: 1, unidad: "meses" } })).toBeNull();
    expect(validarConfigCashback({ pct: 0, vigencia: { cantidad: 1, unidad: "meses" } })).toMatch(/porcentaje/);
    expect(validarConfigCashback({ pct: 3, vigencia: { cantidad: 1.5, unidad: "meses" } })).toMatch(/vigencia/);
    const texto = textoAperturaCuenta({ pct: 3, vigencia: { cantidad: 10, unidad: "dias" } }).join(" ");
    expect(texto).toMatch(/3 %/);
    expect(texto).toMatch(/10 días/);
    expect(texto).toMatch(/1 de enero/);
    expect(AVISO_CASHBACK.join(" ")).toMatch(/100 % de ti/);
  });

  it("el servidor calcula igual que lo compartido", () => {
    const vigencias: VigenciaCashback[] = [
      { cantidad: 10, unidad: "dias" },
      { cantidad: 1, unidad: "meses" },
      { cantidad: 3, unidad: "meses" },
      { cantidad: 1, unidad: "anios" },
    ];
    const compras = [
      "2026-01-31T10:00:00", "2026-03-15T12:00:00", "2026-06-30T23:30:00",
      "2026-11-30T08:00:00", "2026-12-31T23:30:00", "2027-01-01T00:30:00",
    ].map(MX);
    for (const v of vigencias) {
      for (const c of compras) expect(servidor.calcularVence(c, v)).toBe(calcularVence(c, v));
    }
    for (const [m, p] of [[1000, 3], [123.45, 3], [99.99, 2.5], [0.33, 7]] as const) {
      expect(servidor.ganadoCentavos(m, p)).toBe(ganadoCentavos(m, p));
    }
    for (let i = 0; i < 10000; i += 7) {
      const pin = String(i).padStart(4, "0");
      expect(servidor.pinTrivial(pin, "5512344071")).toBe(pinTrivial(pin, "5512344071"));
    }
    const qr = servidor.generarTokenQr();
    expect(leerQrCashback(qr)).toBe(qr);
  });
});
