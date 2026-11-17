import { describe, expect, it } from "vitest";
import type { Articulo, LoteSesion, Resurtido } from "@shared";
import { calcularExistencias } from "../existenciasFabricado";

const ART: Articulo = {
  id: "12300500",
  nombre: "Llavero Goku M1",
  sigla: "",
  referencia: "",
  codigo: "12300500",
  cantidad: "3",
  cantidadBodega: "20",
  cantidadPorSucursal: { MAY: "7" },
  preciCompra: "0",
  precioVenta: "35",
  utilidad: "35",
  utilidadTotal: "0",
  fecha: "2026-10-24 10:00:00",
  fabricado: true,
};

const SUCURSALES = [
  { sucursalId: "CEN", nombre: "Centro" },
  { sucursalId: "MAY", nombre: "Mayoreo" },
];

function embarque(estado: Resurtido["estado"], cantidad: number, articuloId = ART.id) {
  return {
    estado,
    lineas: [{ articuloId, nombreSnapshot: "x", cantidadEnviada: cantidad }],
  };
}

describe("calcularExistencias", () => {
  it("taller, sucursales (default en cantidad) y total", () => {
    const e = calcularExistencias(ART, SUCURSALES, "CEN", []);
    expect(e.taller).toBe(20);
    expect(e.enTransito).toBe(0);
    expect(e.sucursales).toEqual([
      { sucursalId: "CEN", nombre: "Centro", cantidad: 3 },
      { sucursalId: "MAY", nombre: "Mayoreo", cantidad: 7 },
    ]);
    expect(e.total).toBe(30);
  });

  it("en tránsito: solo embarques en tránsito o recibidos de este artículo", () => {
    const e = calcularExistencias(ART, SUCURSALES, "CEN", [
      embarque("en_transito", 5),
      embarque("recibido", 2),
      embarque("creando", 9),
      embarque("cerrado", 9),
      embarque("en_transito", 4, "12300999"),
    ]);
    expect(e.enTransito).toBe(7);
    expect(e.total).toBe(37);
  });

  // Lote: 2 paquetes de 6 de este artículo + 3 sueltas, y 4 de otro artículo.
  function lote(
    estado: Resurtido["estado"],
    sesiones: Record<string, LoteSesion> = {},
  ): Pick<Resurtido, "estado" | "lineas" | "cajas" | "paquetes" | "sueltas" | "recepcion"> {
    return {
      estado,
      lineas: [
        { articuloId: ART.id, nombreSnapshot: "x", cantidadEnviada: 15 },
        { articuloId: "12300999", nombreSnapshot: "y", cantidadEnviada: 4 },
      ],
      cajas: { c880000000001: { codigo: "880000000001", orden: 1 } },
      paquetes: {
        p880000000002: {
          codigo: "880000000002",
          caja: "c880000000001",
          contenido: [{ articuloId: ART.id, piezas: 6 }],
          orden: 1,
        },
        p880000000003: {
          codigo: "880000000003",
          caja: "c880000000001",
          contenido: [{ articuloId: ART.id, piezas: 6 }],
          orden: 2,
        },
      },
      sueltas: {
        s1: { articuloId: ART.id, piezas: 3, caja: "c880000000001", orden: 1 },
        s2: { articuloId: "12300999", piezas: 4, caja: "c880000000001", orden: 2 },
      },
      recepcion: { sesiones },
    };
  }

  it("lote: en tránsito es solo lo pendiente; lo recibido ya está en la sucursal", () => {
    const recibido: LoteSesion = {
      tipo: "recepcion",
      fecha: "2026-11-17 10:00:00",
      quien: "Ana",
      paquetes: ["p880000000002"],
      piezas: { [ART.id]: 1 },
      entro: { [ART.id]: 7 },
    };
    // Enviado sin recibir nada: van las 15 piezas.
    expect(calcularExistencias(ART, SUCURSALES, "CEN", [lote("enviado")]).enTransito).toBe(15);
    // Recibido en parte: llegó un paquete (6) y 1 suelta → faltan 8.
    const parcial = calcularExistencias(ART, SUCURSALES, "CEN", [lote("parcial", { s1: recibido })]);
    expect(parcial.enTransito).toBe(8);
    expect(parcial.total).toBe(38);
    // Armándose o cerrado: nada en camino.
    expect(calcularExistencias(ART, SUCURSALES, "CEN", [lote("creando")]).enTransito).toBe(0);
    expect(
      calcularExistencias(ART, SUCURSALES, "CEN", [lote("cerrado", { s1: recibido })]).enTransito,
    ).toBe(0);
  });
});
