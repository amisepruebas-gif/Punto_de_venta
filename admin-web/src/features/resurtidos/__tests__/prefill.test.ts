import { describe, expect, it } from "vitest";
import { leerPrefillResurtido } from "../prefill";

describe("leerPrefillResurtido", () => {
  const linea = { articuloId: "12300500", nombreSnapshot: "Llavero Goku M1", cantidadEnviada: 30 };

  it("lee destino, líneas y notas", () => {
    expect(
      leerPrefillResurtido({ prefillResurtido: { destinoId: "MAY", lineas: [linea], notas: "Lote FAB-000001" } }),
    ).toEqual({ destinoId: "MAY", lineas: [linea], notas: "Lote FAB-000001" });
  });

  it("descarta líneas inválidas y devuelve null si no queda ninguna", () => {
    expect(
      leerPrefillResurtido({
        prefillResurtido: { lineas: [linea, { articuloId: "x", nombreSnapshot: "y", cantidadEnviada: 0 }] },
      }),
    ).toEqual({ lineas: [linea] });
    expect(leerPrefillResurtido({ prefillResurtido: { lineas: [{ articuloId: 1 }] } })).toBeNull();
  });

  it("sin prefill o con basura → null", () => {
    expect(leerPrefillResurtido(null)).toBeNull();
    expect(leerPrefillResurtido({})).toBeNull();
    expect(leerPrefillResurtido({ prefillResurtido: "x" })).toBeNull();
  });
});
