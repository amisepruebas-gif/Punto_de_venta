import { describe, expect, it } from "vitest";
import type { Resurtido } from "@shared";
import { avanceLote, estadoLotePalabras, etapaLote } from "../loteVista";

const BASE: Pick<Resurtido, "estado" | "listo" | "cajas" | "paquetes" | "sueltas" | "recepcion"> = {
  estado: "creando",
  cajas: {
    c880000000001: { codigo: "880000000001", orden: 1 },
    c880000000002: { codigo: "880000000002", orden: 2 },
  },
  paquetes: {
    p880000000003: {
      codigo: "880000000003",
      caja: "c880000000001",
      contenido: [{ articuloId: "A", piezas: 10 }],
      orden: 1,
    },
    p880000000004: {
      codigo: "880000000004",
      caja: "c880000000002",
      contenido: [{ articuloId: "B", piezas: 5 }],
      orden: 2,
    },
  },
  sueltas: { s1: { articuloId: "A", piezas: 1, caja: "c880000000002", orden: 1 } },
};

describe("estado y avance de un lote", () => {
  it("creando se parte en armándose y listo", () => {
    expect(estadoLotePalabras({ estado: "creando" })).toBe("Se está armando");
    expect(estadoLotePalabras({ estado: "creando", listo: true })).toBe("Listo para enviar");
    expect(estadoLotePalabras({ estado: "parcial" })).toBe("Recibido en parte");
    expect(etapaLote({ estado: "cerrado" })).toBe("cerrado");
  });

  it("armándose: cajas y piezas (sin lineas)", () => {
    expect(avanceLote(BASE)).toBe("2 cajas · 16 piezas");
  });

  it("enviado y recibido en parte: paquetes recibidos y piezas pendientes", () => {
    expect(avanceLote({ ...BASE, estado: "enviado" })).toBe(
      "0 de 2 paquetes · faltan 16 piezas",
    );
    const parcial = {
      ...BASE,
      estado: "parcial" as const,
      recepcion: {
        sesiones: {
          s1: {
            tipo: "recepcion" as const,
            fecha: "2026-11-17 10:00:00",
            quien: "Ana",
            paquetes: ["p880000000003"],
          },
        },
      },
    };
    expect(avanceLote(parcial)).toBe("1 de 2 paquetes · faltan 6 piezas");
  });

  it("cerrado: completo o cuántas no llegaron", () => {
    const cerrado = {
      ...BASE,
      estado: "cerrado" as const,
      recepcion: {
        sesiones: {
          s1: {
            tipo: "no_llego" as const,
            fecha: "2026-11-20 10:00:00",
            quien: "admin",
            noLlego: { A: 11, B: 5 },
          },
        },
      },
    };
    expect(avanceLote(cerrado)).toBe("16 piezas · 16 no llegaron");
  });
});
