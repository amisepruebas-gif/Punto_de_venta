import { describe, expect, it } from "vitest";
import {
  construirInputArticulo,
  type FormStateInput,
} from "../construirInputArticulo";

const FORM_BASE: FormStateInput = {
  nombre: "Camisa",
  sigla: "CAM",
  referencia: "",
  cantidad: "10",
  cantidadBodega: "",
  preciCompra: "100",
  precioVenta: "150",
  categoriaId: "",
  subcategoriaId: "",
  generoId: "",
  etiquetas: [],
  imagenUrl: "https://firebasestorage.googleapis.com/v0/b/x.appspot.com/o/media_web_new_version%2Farticulos%2F123.webp?alt=media&token=abc",
  tallas: "",
  escalones: [],
  zonaPrecioId: "",
  soloMayoreo: false,
  precioMenudeo: "",
  precioDescuento: "",
  flag3x2: false,
  flagSeña: false,
  promoBandera: false,
  subvariaciones: [],
};

const ARGS_BASE = {
  form: FORM_BASE,
  imagenFile: null,
  imagenViaNanobanana: false,
  imagenRemoved: false,
  subvFiles: [],
  subvViaNanobanana: [],
  utilidad: 50,
  utilidadTotal: 500,
  usuario: { uid: "u1" },
};

describe("construirInputArticulo — guard de no-regresión imagenFile", () => {
  /**
   * Bug crítico de facturación: si el form pasa un `File` no nulo cuando el
   * usuario NO tocó la imagen, `articuloService.actualizarArticulo` la
   * re-sube → el `?token=` de Storage rota → todos los nodos re-descargan
   * la misma imagen. Este test blinda el contrato: editar campos
   * no-imagen DEBE producir `imagenFile: null`.
   */
  it("imagenFile=null al editar campos no-imagen sin tocar la imagen", () => {
    const input = construirInputArticulo({
      ...ARGS_BASE,
      form: { ...FORM_BASE, nombre: "Camisa actualizada", precioVenta: "175" },
      imagenFile: null,
      imagenRemoved: false,
    });
    expect(input.imagenFile).toBeNull();
  });

  it("imagenUrl se mantiene cuando no hay file ni remove (NO se re-uploadea)", () => {
    const input = construirInputArticulo({
      ...ARGS_BASE,
      imagenFile: null,
      imagenRemoved: false,
    });
    expect(input.imagenFile).toBeNull();
    expect(input.imagenUrl).toBe(FORM_BASE.imagenUrl);
  });

  it("imagenUrl='' explícito cuando user quitó la imagen (FIX D3)", () => {
    const input = construirInputArticulo({
      ...ARGS_BASE,
      imagenFile: null,
      imagenRemoved: true,
    });
    expect(input.imagenUrl).toBe("");
    expect(input.imagenFile).toBeNull();
  });

  it("propaga el File cuando user eligió uno nuevo", () => {
    const file = new File(["x"], "nueva.webp", { type: "image/webp" });
    const input = construirInputArticulo({
      ...ARGS_BASE,
      imagenFile: file,
      imagenRemoved: false,
    });
    expect(input.imagenFile).toBe(file);
    // Cuando hay archivo nuevo, no mandamos imagenUrl (el service la
    // sobreescribe con la URL del nuevo upload).
    expect(input.imagenUrl).toBeUndefined();
  });

  it("subvariacionesFiles se propaga tal cual (con nulls cuando no se tocaron)", () => {
    const f = new File(["x"], "sv.webp", { type: "image/webp" });
    const input = construirInputArticulo({
      ...ARGS_BASE,
      subvFiles: [null, f, null],
      subvViaNanobanana: [false, false, false],
    });
    expect(input.subvariacionesFiles).toEqual([null, f, null]);
  });

  /**
   * precioDescuento siempre se emite (incluyendo `""`). El service
   * interpreta `""` como "user limpió el descuento" y lo borra del doc.
   * Sin esto, el conditional spread previo dejaba descuentos huérfanos
   * vivos para siempre.
   */
  it("precioDescuento vacío se propaga como '' (señal de clear para el service)", () => {
    const input = construirInputArticulo({
      ...ARGS_BASE,
      form: { ...FORM_BASE, precioDescuento: "" },
    });
    expect(input.precioDescuento).toBe("");
  });

  it("precioDescuento con valor se propaga tal cual", () => {
    const input = construirInputArticulo({
      ...ARGS_BASE,
      form: { ...FORM_BASE, precioDescuento: "120" },
    });
    expect(input.precioDescuento).toBe("120");
  });
});

describe("construirInputArticulo — mayoreo, zona y solo mayoreo", () => {
  it("convierte los escalones y vacía el mayoreo legacy", () => {
    const input = construirInputArticulo({
      ...ARGS_BASE,
      form: {
        ...FORM_BASE,
        escalones: [
          { minPz: "10", precio: "130" },
          { minPz: "25", precio: "120" },
        ],
      },
    });
    expect(input.escalonesMayoreo).toEqual([
      { minPz: 10, precio: 130 },
      { minPz: 25, precio: 120 },
    ]);
    expect(input.mayoreo).toBe("");
    expect(input.cantMayoreo).toBe("");
  });

  it("sin mayoreo manda [] explícito (para poder quitarlo)", () => {
    const input = construirInputArticulo(ARGS_BASE);
    expect(input.escalonesMayoreo).toEqual([]);
  });

  it("soloMayoreo y zonaPrecioId siempre van explícitos", () => {
    const sin = construirInputArticulo(ARGS_BASE);
    expect(sin.soloMayoreo).toBe(false);
    expect(sin.zonaPrecioId).toBe("");
    const con = construirInputArticulo({
      ...ARGS_BASE,
      form: { ...FORM_BASE, soloMayoreo: true, zonaPrecioId: "llaveros" },
    });
    expect(con.soloMayoreo).toBe(true);
    expect(con.zonaPrecioId).toBe("llaveros");
  });

  it("precioMenudeo va siempre: con «Solo mayoreo» el valor, sin él '' (para quitarlo)", () => {
    const sin = construirInputArticulo(ARGS_BASE);
    expect(sin.precioMenudeo).toBe("");
    const con = construirInputArticulo({
      ...ARGS_BASE,
      form: { ...FORM_BASE, soloMayoreo: true, precioMenudeo: " 180 " },
    });
    expect(con.precioMenudeo).toBe("180");
    // Un valor viejo en el form sin «Solo mayoreo» no se guarda.
    const quitado = construirInputArticulo({
      ...ARGS_BASE,
      form: { ...FORM_BASE, soloMayoreo: false, precioMenudeo: "180" },
    });
    expect(quitado.precioMenudeo).toBe("");
  });
});

describe("construirInputArticulo — clasificación", () => {
  it("al crear va explícita aunque esté vacía (el service borra los vacíos)", () => {
    const input = construirInputArticulo(ARGS_BASE);
    expect(input.categoriaId).toBe("");
    expect(input.subcategoriaId).toBe("");
    expect(input.generoId).toBe("");
    expect(input.etiquetas).toEqual([]);
  });

  const INICIAL = { categoriaId: "llavero", subcategoriaId: "metal", generoId: "anime", etiquetas: ["naruto"] };
  const FORM_CLASIF = { ...FORM_BASE, ...INICIAL };

  it("al editar sin tocarla no manda nada (no pisa lo asignado en bloque)", () => {
    const input = construirInputArticulo({
      ...ARGS_BASE,
      form: { ...FORM_CLASIF, precioVenta: "999" },
      clasificacionInicial: INICIAL,
    });
    expect("categoriaId" in input).toBe(false);
    expect("subcategoriaId" in input).toBe(false);
    expect("generoId" in input).toBe(false);
    expect("etiquetas" in input).toBe(false);
  });

  it("al editar manda solo lo que cambió, y quitar va vacío", () => {
    const input = construirInputArticulo({
      ...ARGS_BASE,
      form: { ...FORM_CLASIF, generoId: "", etiquetas: ["naruto", "ninja"] },
      clasificacionInicial: INICIAL,
    });
    expect(input.generoId).toBe("");
    expect(input.etiquetas).toEqual(["naruto", "ninja"]);
    expect("categoriaId" in input).toBe(false);
    expect("subcategoriaId" in input).toBe(false);
  });

  it("al quitar la categoría también quita la subcategoría", () => {
    const input = construirInputArticulo({
      ...ARGS_BASE,
      form: { ...FORM_CLASIF, categoriaId: "" },
      clasificacionInicial: INICIAL,
    });
    expect(input.categoriaId).toBe("");
    expect(input.subcategoriaId).toBe("");
  });

  it("con valores los manda tal cual", () => {
    const input = construirInputArticulo({
      ...ARGS_BASE,
      form: {
        ...FORM_BASE,
        categoriaId: "llavero",
        subcategoriaId: "metal",
        generoId: "anime",
        etiquetas: ["naruto"],
      },
    });
    expect(input.categoriaId).toBe("llavero");
    expect(input.subcategoriaId).toBe("metal");
    expect(input.generoId).toBe("anime");
    expect(input.etiquetas).toEqual(["naruto"]);
  });

  it("sin categoría no manda subcategoría", () => {
    const input = construirInputArticulo({
      ...ARGS_BASE,
      form: { ...FORM_BASE, categoriaId: "", subcategoriaId: "metal" },
    });
    expect(input.subcategoriaId).toBe("");
  });
});
