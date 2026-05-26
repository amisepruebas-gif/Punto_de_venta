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
  etiquetas: [],
  imagenUrl: "https://firebasestorage.googleapis.com/v0/b/x.appspot.com/o/media_web_new_version%2Farticulos%2F123.webp?alt=media&token=abc",
  tallas: "",
  mayoreo: "",
  cantMayoreo: "",
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
