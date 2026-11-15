import { describe, expect, it } from "vitest";
import {
  SIN_CAMBIOS_CLASIFICACION,
  calcularCambioClasificacion,
  hayCambiosClasificacion,
  limpiarEtiqueta,
  type CambiosClasificacion,
} from "@shared";

/**
 * Tests de `shared/src/clasificacion.ts`: lo que la asignación en bloque de
 * admin le cambia a cada artículo.
 */

// Catálogo: "metal" y "anime-sub" son de llavero; "grande" es de peluche.
const padres = new Map([
  ["metal", "llavero"],
  ["anime-sub", "llavero"],
  ["grande", "peluche"],
]);

const cambios = (c: Partial<CambiosClasificacion>): CambiosClasificacion => ({
  ...SIN_CAMBIOS_CLASIFICACION,
  ...c,
});

describe("calcularCambioClasificacion", () => {
  it("sin cambios devuelve null", () => {
    expect(
      calcularCambioClasificacion({ categoriaId: "llavero" }, SIN_CAMBIOS_CLASIFICACION, padres),
    ).toBeNull();
    expect(hayCambiosClasificacion(SIN_CAMBIOS_CLASIFICACION)).toBe(false);
  });

  it("pone y quita el género", () => {
    expect(
      calcularCambioClasificacion({}, cambios({ genero: { accion: "poner", id: "anime" } }), padres),
    ).toEqual({ poner: { generoId: "anime" }, borrar: [] });
    expect(
      calcularCambioClasificacion({ generoId: "anime" }, cambios({ genero: { accion: "quitar" } }), padres),
    ).toEqual({ poner: {}, borrar: ["generoId"] });
    // Poner el que ya tiene: nada que hacer.
    expect(
      calcularCambioClasificacion(
        { generoId: "anime" },
        cambios({ genero: { accion: "poner", id: "anime" } }),
        padres,
      ),
    ).toBeNull();
    // Quitar lo que no tiene: nada que hacer.
    expect(calcularCambioClasificacion({}, cambios({ genero: { accion: "quitar" } }), padres)).toBeNull();
  });

  it("al cambiar de categoría quita la subcategoría que no es de ella", () => {
    expect(
      calcularCambioClasificacion(
        { categoriaId: "llavero", subcategoriaId: "metal" },
        cambios({ categoria: { accion: "poner", id: "peluche" } }),
        padres,
      ),
    ).toEqual({ poner: { categoriaId: "peluche" }, borrar: ["subcategoriaId"] });
  });

  it("quitar la categoría también quita la subcategoría", () => {
    expect(
      calcularCambioClasificacion(
        { categoriaId: "llavero", subcategoriaId: "metal" },
        cambios({ categoria: { accion: "quitar" } }),
        padres,
      ),
    ).toEqual({ poner: {}, borrar: ["categoriaId", "subcategoriaId"] });
  });

  it("pone categoría y subcategoría juntas", () => {
    expect(
      calcularCambioClasificacion(
        { categoriaId: "peluche", subcategoriaId: "grande" },
        cambios({
          categoria: { accion: "poner", id: "llavero" },
          subcategoria: { accion: "poner", id: "metal" },
        }),
        padres,
      ),
    ).toEqual({ poner: { categoriaId: "llavero", subcategoriaId: "metal" }, borrar: [] });
  });

  it("una subcategoría de otra categoría no se pone", () => {
    // Categoría "igual" y el artículo es peluche: "metal" (de llavero) no aplica.
    expect(
      calcularCambioClasificacion(
        { categoriaId: "peluche", subcategoriaId: "grande" },
        cambios({ subcategoria: { accion: "poner", id: "metal" } }),
        padres,
      ),
    ).toBeNull();
    // Sin categoría tampoco.
    expect(
      calcularCambioClasificacion({}, cambios({ subcategoria: { accion: "poner", id: "metal" } }), padres),
    ).toBeNull();
  });

  it("'igual' no toca una subcategoría inconsistente", () => {
    expect(
      calcularCambioClasificacion(
        { categoriaId: "peluche", subcategoriaId: "metal" },
        cambios({ genero: { accion: "poner", id: "anime" } }),
        padres,
      ),
    ).toEqual({ poner: { generoId: "anime" }, borrar: [] });
  });

  it("agrega y quita etiquetas sin repetir y sin importar mayúsculas, # ni acentos", () => {
    expect(
      calcularCambioClasificacion(
        { etiquetas: ["twice", "Lovely"] },
        cambios({ agregarEtiquetas: ["#TWICE", " Pokémon "], quitarEtiquetas: ["lovely"] }),
        padres,
      ),
    ).toEqual({ poner: { etiquetas: ["twice", "pokémon"] }, borrar: [] });
  });

  it("si una etiqueta está en agregar y quitar, gana quitar", () => {
    expect(
      calcularCambioClasificacion(
        { etiquetas: ["naruto"] },
        cambios({ agregarEtiquetas: ["anime"], quitarEtiquetas: ["Anime"] }),
        padres,
      ),
    ).toBeNull();
  });

  it("quitar la última etiqueta borra el campo", () => {
    expect(
      calcularCambioClasificacion({ etiquetas: ["naruto"] }, cambios({ quitarEtiquetas: ["NARUTO"] }), padres),
    ).toEqual({ poner: {}, borrar: ["etiquetas"] });
  });

  it("solo reescribe etiquetas si hay algo que agregar o quitar", () => {
    // Duplicadas por mayúsculas: sin cambios de etiquetas se dejan como están.
    expect(
      calcularCambioClasificacion(
        { etiquetas: ["Anime", "anime"] },
        cambios({ genero: { accion: "poner", id: "anime" } }),
        padres,
      ),
    ).toEqual({ poner: { generoId: "anime" }, borrar: [] });
  });

  it("trata '' como vacío", () => {
    expect(
      calcularCambioClasificacion({ categoriaId: "", generoId: "" }, cambios({ genero: { accion: "quitar" } }), padres),
    ).toBeNull();
  });
});

describe("limpiarEtiqueta", () => {
  it("minúsculas, sin # inicial y sin espacios de sobra", () => {
    expect(limpiarEtiqueta("  #Llavero   Peluche ")).toBe("llavero peluche");
  });
});
