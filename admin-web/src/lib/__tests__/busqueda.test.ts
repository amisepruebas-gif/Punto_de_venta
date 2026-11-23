import { describe, expect, it } from "vitest";
import {
  FILTRO_SIN,
  clasificacionVigente,
  coincideConsulta,
  coincidePalabras,
  contarOpciones,
  hayFiltros,
  nombreEnCaja,
  normalizarEtiqueta,
  normalizarTexto,
  palabrasDeConsulta,
  pasaFiltros,
  type CatalogosVigentes,
  type Clasificable,
} from "@shared";

/**
 * Tests de `shared/src/busqueda.ts`: el buscador y el panel de filtros de la
 * caja, y los filtros de la lista de artículos de admin.
 */

describe("normalizarTexto", () => {
  it("quita acentos, diéresis y la tilde de la ñ, y pasa a minúsculas", () => {
    expect(normalizarTexto("Películas")).toBe("peliculas");
    expect(normalizarTexto("PINGÜINO Niño")).toBe("pinguino nino");
  });
  it("colapsa y recorta espacios", () => {
    expect(normalizarTexto("  K-POP   llavero \t ")).toBe("k-pop llavero");
    expect(normalizarTexto("   ")).toBe("");
  });
});

describe("palabras y coincidencias", () => {
  it("separa la consulta en palabras normalizadas", () => {
    expect(palabrasDeConsulta("  Llavero   ANIMÉ ")).toEqual(["llavero", "anime"]);
    expect(palabrasDeConsulta("")).toEqual([]);
  });
  it("pide todas las palabras, en cualquier orden y como parte de palabra", () => {
    const texto = normalizarTexto("Llavero Naruto 12300010 anime llavero");
    expect(coincideConsulta(texto, "anime llavero")).toBe(true);
    expect(coincideConsulta(texto, "llav nar")).toBe(true);
    expect(coincideConsulta(texto, "llavero kpop")).toBe(false);
    expect(coincideConsulta(texto, "")).toBe(true);
  });
  it("busca sin acentos en ninguno de los dos lados", () => {
    const texto = normalizarTexto("Peluche Películas Disney");
    expect(coincideConsulta(texto, "peliculas")).toBe(true);
    expect(coincideConsulta(texto, "PELÍCULAS")).toBe(true);
  });
  it("coincidePalabras sin palabras es true", () => {
    expect(coincidePalabras("lo que sea", [])).toBe(true);
  });
});

describe("normalizarEtiqueta", () => {
  it("compara sin #, mayúsculas ni acentos", () => {
    expect(normalizarEtiqueta("#Twice")).toBe("twice");
    expect(normalizarEtiqueta("  ##Pokémon ")).toBe("pokemon");
  });
});

const catalogos: CatalogosVigentes = {
  categorias: new Set(["llavero", "peluche"]),
  subcategorias: new Set(["metal"]),
  generos: new Set(["anime", "k-pop"]),
};

describe("clasificacionVigente", () => {
  it("convierte ids borrados o vacíos en 'sin …' y deja etiquetas únicas", () => {
    const c = clasificacionVigente(
      {
        categoriaId: "borrada",
        subcategoriaId: "",
        generoId: "anime",
        etiquetas: ["Twice", "#twice", "lovely", ""],
      },
      catalogos,
    );
    expect(c).toEqual({
      categoriaId: undefined,
      subcategoriaId: undefined,
      generoId: "anime",
      etiquetas: ["twice", "lovely"],
    });
  });
  it("sin catálogos no valida ids", () => {
    expect(clasificacionVigente({ categoriaId: "cualquiera" }).categoriaId).toBe("cualquiera");
  });
});

describe("pasaFiltros", () => {
  const llaveroAnime: Clasificable = {
    categoriaId: "llavero",
    generoId: "anime",
    etiquetas: ["naruto"],
  };
  it("sin filtros pasa todo", () => {
    expect(pasaFiltros(llaveroAnime, {}, catalogos)).toBe(true);
    expect(hayFiltros({})).toBe(false);
    expect(hayFiltros({ generoId: "anime" })).toBe(true);
  });
  it("combina categoría, género y etiqueta", () => {
    expect(pasaFiltros(llaveroAnime, { categoriaId: "llavero", generoId: "anime" }, catalogos)).toBe(true);
    expect(pasaFiltros(llaveroAnime, { categoriaId: "peluche" }, catalogos)).toBe(false);
    expect(pasaFiltros(llaveroAnime, { generoId: "k-pop" }, catalogos)).toBe(false);
    expect(pasaFiltros(llaveroAnime, { etiqueta: "#NARUTO" }, catalogos)).toBe(true);
    expect(pasaFiltros(llaveroAnime, { etiqueta: "twice" }, catalogos)).toBe(false);
  });
  it("FILTRO_SIN encuentra los que no tienen el dato o lo tienen borrado", () => {
    expect(pasaFiltros({}, { generoId: FILTRO_SIN }, catalogos)).toBe(true);
    expect(pasaFiltros({ generoId: "borrado" }, { generoId: FILTRO_SIN }, catalogos)).toBe(true);
    expect(pasaFiltros(llaveroAnime, { generoId: FILTRO_SIN }, catalogos)).toBe(false);
    expect(pasaFiltros({ categoriaId: "borrada" }, { categoriaId: FILTRO_SIN }, catalogos)).toBe(true);
  });
});

describe("contarOpciones", () => {
  const arts: Clasificable[] = [
    { categoriaId: "llavero", generoId: "anime", etiquetas: ["naruto"] },
    { categoriaId: "llavero", generoId: "k-pop", etiquetas: ["twice"] },
    { categoriaId: "peluche", generoId: "anime", etiquetas: ["naruto", "lovely"] },
    { categoriaId: "peluche" },
    { generoId: "borrado" },
  ];
  const vigentes = arts.map((a) => clasificacionVigente(a, catalogos));

  it("sin filtros cuenta todo", () => {
    const r = contarOpciones(vigentes, {});
    expect(r.total).toBe(5);
    expect(Object.fromEntries(r.categorias)).toEqual({ llavero: 2, peluche: 2, [FILTRO_SIN]: 1 });
    expect(Object.fromEntries(r.generos)).toEqual({ anime: 2, "k-pop": 1, [FILTRO_SIN]: 2 });
    expect(Object.fromEntries(r.etiquetas)).toEqual({ naruto: 2, twice: 1, lovely: 1 });
  });

  it("cada grupo se cuenta con los otros filtros puestos", () => {
    const r = contarOpciones(vigentes, { generoId: "anime" });
    expect(r.total).toBe(2);
    // Categorías dentro de "anime".
    expect(Object.fromEntries(r.categorias)).toEqual({ llavero: 1, peluche: 1 });
    // Géneros: no cuenta su propio filtro (para poder cambiar de género).
    expect(Object.fromEntries(r.generos)).toEqual({ anime: 2, "k-pop": 1, [FILTRO_SIN]: 2 });
    expect(Object.fromEntries(r.etiquetas)).toEqual({ naruto: 2, lovely: 1 });
  });

  it("dos filtros a la vez", () => {
    const r = contarOpciones(vigentes, { generoId: "anime", categoriaId: "peluche" });
    expect(r.total).toBe(1);
    expect(Object.fromEntries(r.categorias)).toEqual({ llavero: 1, peluche: 1 });
    expect(Object.fromEntries(r.generos)).toEqual({ anime: 1, [FILTRO_SIN]: 1 });
  });
});

describe("nombreEnCaja", () => {
  it("pone la categoría antes del nombre", () => {
    expect(nombreEnCaja("vegueta", "llavero")).toBe("llavero vegueta");
    expect(nombreEnCaja("Vegueta", "Llavero")).toBe("Llavero Vegueta");
    expect(nombreEnCaja("  vegueta ", " llavero ")).toBe("llavero vegueta");
  });

  it("sin categoría deja el nombre tal cual", () => {
    expect(nombreEnCaja("vegueta")).toBe("vegueta");
    expect(nombreEnCaja("vegueta", "")).toBe("vegueta");
    expect(nombreEnCaja("vegueta", null)).toBe("vegueta");
  });

  it("no repite la categoría si el nombre ya empieza con ella", () => {
    expect(nombreEnCaja("Llavero vegueta", "llavero")).toBe("Llavero vegueta");
    expect(nombreEnCaja("LLAVÉRO vegueta", "llavero")).toBe("LLAVÉRO vegueta");
    expect(nombreEnCaja("llavero", "Llavero")).toBe("llavero");
    expect(nombreEnCaja("Llavero-vegueta", "llavero")).toBe("Llavero-vegueta");
  });

  it("singular y plural cuentan como la misma categoría", () => {
    expect(nombreEnCaja("llavero vegueta", "Llaveros")).toBe("llavero vegueta");
    expect(nombreEnCaja("llaveros vegueta", "Llavero")).toBe("llaveros vegueta");
    expect(nombreEnCaja("peluche osito", "Peluches")).toBe("peluche osito");
    expect(nombreEnCaja("pin de anime", "Pines")).toBe("pin de anime");
  });

  it("solo palabras completas: «pinza» no es «pin»", () => {
    expect(nombreEnCaja("pinza roja", "Pines")).toBe("Pines pinza roja");
    expect(nombreEnCaja("llaverito vegueta", "llavero")).toBe("llavero llaverito vegueta");
  });

  it("la búsqueda encuentra el nombre de caja por partes", () => {
    expect(coincideConsulta(normalizarTexto(nombreEnCaja("vegueta", "Llavero")), "llav veg")).toBe(true);
  });
});
