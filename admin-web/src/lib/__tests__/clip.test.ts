import { describe, expect, it } from "vitest";
import {
  accionRecuperacionClip,
  centavosClip,
  cobroClipFinal,
  etiquetaTarjetaClip,
  montoCobroClip,
  pagoClipDeCobro,
  pagoClipManual,
  puedeCrearVentaConClip,
  ventaSinDescuentoConEfectivo,
  type CobroClip,
} from "@shared";

/**
 * Tests de las reglas de la caja para cobrar con la terminal Clip
 * (`shared/src/clip.ts`): la venta solo se guarda con un cobro aprobado por
 * el mismo monto, y nunca con un descuento que no se descontó.
 */

const cobro = (extra: Partial<CobroClip> = {}): CobroClip => ({
  cobroId: "V1",
  estado: "aprobado",
  intento: 1,
  monto: "416.00",
  montoCentavos: 41600,
  pinpadRequestId: "pinpad-1",
  tarjeta: { marca: "visa", tipo: "debit_card", ultimos4: "4242", banco: "BBVA", transaccionId: "tx-1" },
  pagadoCentavos: 41600,
  alerta: null,
  error: null,
  actualizadoEn: 1,
  ...extra,
});

describe("monto y cruce con la venta", () => {
  it("cobra lo que paga el cliente con tarjeta (montoPago, con comisión)", () => {
    expect(montoCobroClip({ montoPago: "416" })).toBe(416);
    expect(montoCobroClip({ montoPago: "199.5" })).toBe(199.5);
    expect(centavosClip("0.1")).toBe(10);
    expect(centavosClip("x")).toBe(0);
  });

  it("solo un cobro aprobado por el mismo monto deja guardar la venta", () => {
    expect(puedeCrearVentaConClip(cobro(), { montoPago: "416" })).toBe(true);
    expect(puedeCrearVentaConClip(cobro(), { montoPago: "400" })).toBe(false);
    expect(puedeCrearVentaConClip(cobro({ estado: "pendiente" }), { montoPago: "416" })).toBe(false);
    expect(puedeCrearVentaConClip(cobro({ estado: "revisar" }), { montoPago: "416" })).toBe(false);
    expect(puedeCrearVentaConClip(null, { montoPago: "416" })).toBe(false);
  });

  it("estados finales", () => {
    expect(cobroClipFinal("aprobado")).toBe(true);
    expect(cobroClipFinal("cancelado")).toBe(true);
    expect(cobroClipFinal("manual")).toBe(true);
    expect(cobroClipFinal("pendiente")).toBe(false);
    expect(cobroClipFinal("incierto")).toBe(false);
  });
});

describe("lo que va en la venta y en el ticket", () => {
  it("pagoClipDeCobro guarda la tarjeta sin datos sensibles y marca verificado", () => {
    const p = pagoClipDeCobro(cobro({ alerta: "pago-de-mas" }));
    expect(p).toEqual({
      cobroId: "V1",
      verificado: true,
      pinpadRequestId: "pinpad-1",
      marca: "visa",
      tipo: "debit_card",
      ultimos4: "4242",
      banco: "BBVA",
      transaccionId: "tx-1",
      alerta: "pago-de-mas",
    });
    expect(pagoClipDeCobro(cobro({ tarjeta: null, pinpadRequestId: null }))).toEqual({ cobroId: "V1", verificado: true });
  });

  it("el cobro confirmado a mano queda como no verificado", () => {
    expect(pagoClipManual("V9")).toEqual({ cobroId: "V9", verificado: false });
  });

  it("etiqueta de la tarjeta", () => {
    expect(etiquetaTarjetaClip({ marca: "visa", ultimos4: "4242" })).toBe("Visa ••••4242");
    expect(etiquetaTarjetaClip({ marca: "master", ultimos4: "8356" })).toBe("Mastercard ••••8356");
    expect(etiquetaTarjetaClip({ marca: "banorte" })).toBe("Banorte");
    expect(etiquetaTarjetaClip({ ultimos4: "1111" })).toBe("Tarjeta ••••1111");
    expect(etiquetaTarjetaClip(null)).toBe("");
    expect(etiquetaTarjetaClip({})).toBe("");
  });
});

describe("al abrir la caja con un cobro a medias", () => {
  const venta = { montoPago: "416" };
  it("esperando en la terminal se vuelve a esperar; incierto se revisa", () => {
    expect(accionRecuperacionClip("terminal", cobro({ estado: "pendiente" }), venta)).toBe("esperar");
    expect(accionRecuperacionClip("terminal", cobro({ estado: "enviando" }), venta)).toBe("esperar");
    expect(accionRecuperacionClip("terminal", cobro({ estado: "incierto" }), venta)).toBe("incierto");
  });

  it("aprobado y sin venta se termina; si no cuadra, a revisión", () => {
    expect(accionRecuperacionClip("terminal", cobro(), venta)).toBe("terminar-venta");
    expect(accionRecuperacionClip("terminal", cobro(), { montoPago: "300" })).toBe("revisar");
    expect(accionRecuperacionClip("terminal", cobro({ estado: "revisar" }), venta)).toBe("revisar");
    // Confirmado a mano en la terminal y la app se cerró antes de guardar.
    expect(accionRecuperacionClip("terminal", cobro({ estado: "manual" }), venta)).toBe("terminar-venta");
  });

  it("sin pago o sin llegar al servidor se retoma; pasada la aprobación se termina", () => {
    expect(accionRecuperacionClip("terminal", cobro({ estado: "fallido" }), venta)).toBe("retomar");
    expect(accionRecuperacionClip("terminal", cobro({ estado: "cancelado" }), venta)).toBe("retomar");
    expect(accionRecuperacionClip("terminal", null, venta)).toBe("retomar");
    expect(accionRecuperacionClip("descuentos", null, venta)).toBe("terminar-venta");
    expect(accionRecuperacionClip("guardando", null, venta)).toBe("terminar-venta");
  });
});

describe("descuento que no se pudo aplicar con la tarjeta ya cobrada", () => {
  // Artículos $500, cashback $100, total $400 + comisión 4 % ($16) con tarjeta.
  const base = {
    montoCobro: "400",
    montoPago: "416",
    cambio: "0",
    movimiento: "pagoTarjeta",
    comicion: "16",
    descuentoPuntos: "100",
    puntosCodigo: "7501000000012",
    puntosTelefono: "5511111111",
  };

  it("sin el cashback: la diferencia va en efectivo como pago dividido", () => {
    const r = ventaSinDescuentoConEfectivo(base, "cashback");
    expect(r.montoCobro).toBe("500");
    expect(r.montoPago).toBe("516");
    expect(r.movimiento).toBe("pagoDividido");
    expect(r.datosPagoDividido).toEqual({ tarjeta: "400", efectivo: "100", transferencia: "0" });
    expect(r.descuentoPuntos).toBeUndefined();
    expect(r.puntosCodigo).toBeUndefined();
    // El cliente sigue acumulando cashback por su compra.
    expect(r.puntosTelefono).toBe("5511111111");
    expect(r.comicion).toBe("16");
    // El pago dividido suma lo que registra la venta (así cuadra el corte).
    const dd = r.datosPagoDividido as Record<string, string>;
    expect(Number(dd.tarjeta) + Number(dd.efectivo) + Number(dd.transferencia)).toBe(Number(r.montoCobro));
  });

  it("sin el cashback usado con el correo: también se quita el correo", () => {
    const porCorreo = { ...base, puntosCodigo: undefined, puntosEmail: "cliente@correo.com" };
    const r = ventaSinDescuentoConEfectivo(porCorreo, "cashback");
    expect(r.montoCobro).toBe("500");
    expect(r.descuentoPuntos).toBeUndefined();
    expect(r.puntosEmail).toBeUndefined();
    // Sin el correo ni la tarjeta, el cliente sigue acumulando por su compra.
    expect(r.puntosTelefono).toBe("5511111111");
  });

  it("si después falla también el regalo, se suma al efectivo", () => {
    const conRegalo = { ...base, montoCobro: "350", montoPago: "364", descuentoRegalo: "50", regaloCodigo: "7502000000019" };
    const r1 = ventaSinDescuentoConEfectivo(conRegalo, "cashback");
    const r2 = ventaSinDescuentoConEfectivo(r1, "regalo");
    expect(r2.montoCobro).toBe("500");
    expect(r2.datosPagoDividido).toEqual({ tarjeta: "350", efectivo: "150", transferencia: "0" });
    expect(r2.descuentoRegalo).toBeUndefined();
    expect(r2.regaloCodigo).toBeUndefined();
  });

  it("sin descuento que quitar no cambia nada", () => {
    const sin = { ...base, descuentoPuntos: "0" };
    expect(ventaSinDescuentoConEfectivo(sin, "cashback")).toBe(sin);
  });
});
