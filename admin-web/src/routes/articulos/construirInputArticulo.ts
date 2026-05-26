import type { ArticuloInput } from "@/features/articulos/articuloService";
import type { ArticuloSubvariacion } from "@shared";

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
  etiquetas: string[];
  imagenUrl: string;
  tallas: string;
  mayoreo: string;
  cantMayoreo: string;
  precioDescuento: string;
  flag3x2: boolean;
  flagSeña: boolean;
  promoBandera: boolean;
  subvariaciones: ArticuloSubvariacion[];
};

export type ConstruirInputArgs = {
  form: FormStateInput;
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
    ...(form.categoriaId && { categoriaId: form.categoriaId }),
    ...(form.subcategoriaId && { subcategoriaId: form.subcategoriaId }),
    ...(form.etiquetas.length > 0 && { etiquetas: form.etiquetas }),
    // FIX D3: si el user quitó la imagen, pasar imagenUrl: "" explícito
    // para que el service lo respete en vez de fallback al existente.
    ...(imagenRemoved
      ? { imagenUrl: "" }
      : form.imagenUrl && !imagenFile
        ? { imagenUrl: form.imagenUrl }
        : {}),
    ...(form.tallas && { tallas: form.tallas }),
    ...(form.mayoreo && { mayoreo: form.mayoreo }),
    ...(form.cantMayoreo && { cantMayoreo: form.cantMayoreo }),
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
