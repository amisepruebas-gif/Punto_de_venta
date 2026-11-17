import { describe, expect, it } from "vitest";
import { codigoEtiquetaLote } from "@shared";
import { construirDocEtiquetasNumeradas } from "../etiquetasNumeradasPdf";

const codigos = (n: number, desde = 1) =>
  Array.from({ length: n }, (_, i) => codigoEtiquetaLote(desde + i));
const barrasDe = (cs: string[]) =>
  Object.fromEntries(cs.map((c) => [c, `data:image/png;base64,${c}`]));

type Tabla = { table: { body: unknown[][]; widths: number[] } };

describe("construirDocEtiquetasNumeradas", () => {
  it("carta 3×10: mismas medidas que las de artículo (31 → 11 filas de 5 columnas)", () => {
    const cs = codigos(31);
    const doc = construirDocEtiquetasNumeradas(cs, "carta-3x10", barrasDe(cs));
    expect(doc.pageSize).toBe("LETTER");
    expect(doc.pageMargins).toEqual([13.5, 36, 13.5, 36]);
    const tabla = (doc.content as Tabla[])[0]!.table;
    expect(tabla.body).toHaveLength(11);
    expect(tabla.body.every((fila) => fila.length === 5)).toBe(true);
    expect(tabla.widths.reduce((a, w) => a + w, 0) + 3 * 12).toBe(585);
    expect(tabla.body[10]![2]).toEqual({ text: "" });
  });

  it("rollo 50×25: una etiqueta por página, cada una con SU código", () => {
    const cs = codigos(3, 120);
    const doc = construirDocEtiquetasNumeradas(cs, "rollo-50x25", barrasDe(cs));
    const content = doc.content as Array<{ pageBreak?: string }>;
    expect(content).toHaveLength(3);
    expect(content.map((c) => c.pageBreak)).toEqual(["after", "after", undefined]);
    const segunda = JSON.stringify(content[1]);
    expect(segunda).toContain("8800 0000 0121");
    expect(segunda).toContain("data:image/png;base64,880000000121");
    expect(segunda).not.toContain("880000000120");
  });

  it("la etiqueta lleva el código legible y la leyenda AMISE · LOTE", () => {
    const cs = [codigoEtiquetaLote(7)];
    const texto = JSON.stringify(construirDocEtiquetasNumeradas(cs, "carta-3x10", barrasDe(cs)));
    expect(texto).toContain("8800 0000 0007");
    expect(texto).toContain("AMISE · LOTE");
  });

  it("no arma el PDF si falta el código de barras de alguna etiqueta", () => {
    const cs = codigos(2);
    expect(() =>
      construirDocEtiquetasNumeradas(cs, "rollo-50x25", { [cs[0]!]: "data:x" }),
    ).toThrow(/880000000002/);
  });
});
