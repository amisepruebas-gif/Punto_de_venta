import { describe, expect, it } from "vitest";
import type { Articulo } from "@shared";
import { construirDocEtiquetas } from "../etiquetasPdf";

const ART: Articulo = {
  id: "12300500",
  nombre: "Llavero Goku M1",
  sigla: "",
  referencia: "",
  codigo: "12300500",
  cantidad: "0",
  preciCompra: "0",
  precioVenta: "35",
  utilidad: "35",
  utilidadTotal: "0",
  fecha: "2026-10-24 10:00:00",
  escalonesMayoreo: [{ minPz: 10, precio: 30 }],
};
const PNG = "data:image/png;base64,AAAA";

type Tabla = { table: { body: unknown[][]; widths: number[] } };

describe("construirDocEtiquetas", () => {
  it("carta 3×10: 31 etiquetas → 11 filas de 5 columnas (3 etiquetas + 2 separaciones)", () => {
    const doc = construirDocEtiquetas(ART, 31, "carta-3x10", PNG);
    const tabla = (doc.content as Tabla[])[0].table;
    expect(tabla.body).toHaveLength(11);
    expect(tabla.body.every((fila) => fila.length === 5)).toBe(true);
    // Ancho total = 3 × 189 + 2 × 9 (con 6 pt de relleno por lado en las etiquetas).
    const anchoContenido = tabla.widths.reduce((a, w) => a + w, 0);
    expect(anchoContenido + 3 * 12).toBe(585);
    // Última fila: 1 etiqueta y celdas vacías.
    const ultima = tabla.body[10];
    expect(ultima[0]).toHaveProperty("stack");
    expect(ultima[2]).toEqual({ text: "" });
  });

  it("rollo 50×25: una etiqueta por página, salto entre ellas", () => {
    const doc = construirDocEtiquetas(ART, 3, "rollo-50x25", PNG);
    const content = doc.content as Array<{ pageBreak?: string }>;
    expect(content).toHaveLength(3);
    expect(content.map((c) => c.pageBreak)).toEqual(["after", "after", undefined]);
  });

  it("la etiqueta lleva nombre, precio, mayoreo y el código del artículo", () => {
    const doc = construirDocEtiquetas(ART, 1, "rollo-50x25", PNG);
    const texto = JSON.stringify(doc.content);
    expect(texto).toContain("Llavero Goku M1");
    expect(texto).toContain("$35");
    expect(texto).toContain("Mayoreo 10+ pz: $30 c/u");
    expect(texto).toContain("12300500");
    expect(texto).toContain(PNG);
  });
});
