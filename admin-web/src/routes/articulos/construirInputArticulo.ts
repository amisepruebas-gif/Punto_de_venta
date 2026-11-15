import type { ArticuloInput } from "@/features/articulos/articuloService";
import {
  escalonesDeTexto,
  type ArticuloSubvariacion,
  type EscalonTexto,
} from "@shared";

export type FormStateInput = {
  nombre: string;
  sigla: string;
  referencia: string;
  cantidad: string;
  cantidadBodega: string;
  preciCompra: string;
  precioVenta: string;
  categoriaId: string;
  subcategoriaId: string;
  /** Género (temática). "" = sin género. */
  generoId: string;
  etiquetas: string[];
  imagenUrl: string;
  tallas: string;
  /** Escalones de mayoreo como texto (0–3 filas). */
  escalones: EscalonTexto[];
  /** Zona de precios ("" = sin zona, precio propio). */
  zonaPrecioId: string;
  soloMayoreo: boolean;
  precioDescuento: string;
  flag3x2: boolean;
  flagSeña: boolean;
  promoBandera: boolean;
  subvariaciones: ArticuloSubvariacion[];
};

/** Clasificación como estaba al abrir la ficha (para mandar solo lo que el
 *  usuario cambió). La subcategoría va vacía si no hay categoría. */
export type ClasificacionInicial = {
  categoriaId: string;
  subcategoriaId: string;
  generoId: string;
  etiquetas: string[];
};

export function clasificacionDeForm(f: {
  categoriaId: string;
  subcategoriaId: string;
  generoId: string;
  etiquetas: string[];
}): ClasificacionInicial {
  return {
    categoriaId: f.categoriaId,
    subcategoriaId: f.categoriaId ? f.subcategoriaId : "",
    generoId: f.generoId,
    etiquetas: [...f.etiquetas],
  };
}

/**
 * Campos de clasificación a escribir. Al CREAR (sin `inicial`) van todos;
 * vacío = sin dato (`borrarLlavesVacias` los quita). Al EDITAR solo los que
 * el usuario cambió: así una ficha abierta desde antes no pisa lo que se
 * asignó en bloque mientras tanto. Cambiado a vacío = quitar.
 */
export function camposClasificacion(
  form: { categoriaId: string; subcategoriaId: string; generoId: string; etiquetas: string[] },
  inicial: ClasificacionInicial | null | undefined,
): Partial<Pick<ArticuloInput, "categoriaId" | "subcategoriaId" | "generoId" | "etiquetas">> {
  const actual = clasificacionDeForm(form);
  const out: Partial<Pick<ArticuloInput, "categoriaId" | "subcategoriaId" | "generoId" | "etiquetas">> = {};
  if (!inicial || actual.categoriaId !== inicial.categoriaId) out.categoriaId = actual.categoriaId;
  if (!inicial || actual.subcategoriaId !== inicial.subcategoriaId) out.subcategoriaId = actual.subcategoriaId;
  if (!inicial || actual.generoId !== inicial.generoId) out.generoId = actual.generoId;
  if (
    !inicial ||
    actual.etiquetas.length !== inicial.etiquetas.length ||
    actual.etiquetas.some((t, i) => t !== inicial.etiquetas[i])
  ) {
    out.etiquetas = actual.etiquetas;
  }
  return out;
}

export type ConstruirInputArgs = {
  form: FormStateInput;
  /** Clasificación al abrir la ficha; `null` al crear un artículo. */
  clasificacionInicial?: ClasificacionInicial | null;
  imagenFile: File | null;
  imagenViaNanobanana: boolean;
  imagenRemoved: boolean;
  subvFiles: Array<File | null>;
  subvViaNanobanana: boolean[];
  utilidad: number;
  utilidadTotal: number;
  usuario: { uid: string; email?: string } | null;
};

/**
 * Builder puro del `ArticuloInput` que recibe `articuloService.{crear,actualizar}Articulo`.
 *
 * Extraído de `ArticuloEditPage.onSubmit` para que el contrato sea
 * testeable como función pura. Especialmente importante: este helper
 * garantiza que `imagenFile` sea `null` si el usuario no eligió un archivo
 * nuevo. Re-uploads espurios romperían el ahorro de facturación del cache
 * nativo (cada upload rota el `?token=` y fuerza re-descarga en todos los
 * nodos), por eso el test `__tests__/construirInputArticulo.test.ts`
 * blinda contra esa regresión.
 */
export function construirInputArticulo(args: ConstruirInputArgs): ArticuloInput {
  const {
    form,
    clasificacionInicial,
    imagenFile,
    imagenViaNanobanana,
    imagenRemoved,
    subvFiles,
    subvViaNanobanana,
    utilidad,
    utilidadTotal,
    usuario,
  } = args;

  return {
    nombre: form.nombre.trim(),
    sigla: form.sigla.trim(),
    referencia: form.referencia.trim(),
    cantidad: form.cantidad || "0",
    ...(form.cantidadBodega && { cantidadBodega: form.cantidadBodega }),
    preciCompra: form.preciCompra || "0",
    precioVenta: form.precioVenta,
    utilidad: String(utilidad),
    utilidadTotal: String(utilidadTotal),
    // Clasificación: solo lo que cambió (al crear, todo). Vacío = QUITAR: el
    // service mezcla con el doc existente y `borrarLlavesVacias` borra los ""
    // y el []. Antes, quitar la categoría o las etiquetas no se guardaba.
    ...camposClasificacion(form, clasificacionInicial),
    // FIX D3: si el user quitó la imagen, pasar imagenUrl: "" explícito
    // para que el service lo respete en vez de fallback al existente.
    ...(imagenRemoved
      ? { imagenUrl: "" }
      : form.imagenUrl && !imagenFile
        ? { imagenUrl: form.imagenUrl }
        : {}),
    ...(form.tallas && { tallas: form.tallas }),
    // Mayoreo: siempre explícito para poder QUITARLO (el service mezcla con
    // el doc existente). Los escalones reemplazan al legacy de un escalón,
    // que se vacía; `zonaPrecioId: ""` = sin zona. articuloService borra
    // las llaves vacías.
    escalonesMayoreo: escalonesDeTexto(form.escalones),
    mayoreo: "",
    cantMayoreo: "",
    zonaPrecioId: form.zonaPrecioId,
    soloMayoreo: form.soloMayoreo,
    // Espejo de FIX D3 para imagenUrl: emitimos `precioDescuento` SIEMPRE.
    // `""` del form llega como "" al service → "user limpió el descuento",
    // el service lo strip-ea antes de persistir. Sin esto, el conditional
    // spread dejaba el descuento existente vivo para siempre (no había
    // forma de quitarlo desde la UI). `articuloService` también borra el
    // legacy `descuento` al guardar — ese campo ya no se lee.
    precioDescuento: form.precioDescuento,
    ...(form.flag3x2 && { "3x2": "" }),
    ...(form.flagSeña && { seña: "" }),
    ...(form.promoBandera && { promoBandera: "1" }),
    ...(form.subvariaciones.length > 0 && {
      subvariaciones: form.subvariaciones,
    }),
    imagenFile,
    imagenViaNanobanana,
    subvariacionesFiles: subvFiles,
    subvariacionesViaNanobanana: subvViaNanobanana,
    usuario,
  };
}
