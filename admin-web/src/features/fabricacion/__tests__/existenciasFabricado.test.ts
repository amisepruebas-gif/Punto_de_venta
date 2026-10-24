import { describe, expect, it } from "vitest";
import type { Articulo, Resurtido } from "@shared";
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
});
