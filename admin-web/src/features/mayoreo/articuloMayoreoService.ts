import {
  deleteField,
  doc,
  getDoc,
  runTransaction,
  setDoc,
  type FieldValue,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import {
  camposPrecioMayoreo,
  fechaISO_MX,
  generarVariacionCodigo,
  nivelDeTexto,
  nombrarVariaciones,
  nombreAutomaticoArticulo,
  paths,
  resolverPrecioHeredado,
  tieneExistencias,
  validarArticuloMayoreo,
  type Articulo,
  type ArticuloSubvariacion,
  type PrecioMayoreoNivel,
  type PreciosMayoreo,
  type RegistroImagenProcesada,
} from "@shared";
import {
  marcarArticuloEnSync,
  reservarIdsArticulo,
  uploadImagenPrincipal,
  uploadImagenSubvariacion,
} from "@/features/articulos/articuloService";
import {
  nuevoRegistroNanobanana,
  type DatosUsuario,
} from "@/lib/costosNanobanana";

// ============================================================
// Registro simplificado de artículos «Solo mayoreo»
// ============================================================
// Categoría y subcategoría obligatorias; el nombre del artículo y el de cada
// variación son opcionales (el sistema los pone). El precio sale de la
// escalera categoría → subcategoría → artículo. Cada artículo final (el
// artículo, o cada variación) recibe un código de 8 dígitos.
//
// Este registro NO captura existencias y NUNCA las pisa: al editar arma las
// variaciones dentro de una transacción a partir del doc recién leído, así
// que una venta o un movimiento que ocurra mientras el formulario está
// abierto no se pierde.

export type VariacionMayoreoInput = {
  /** Código interno `v-NN-XXX` si la variación ya existe. */
  codigo?: string;
  /** Vacío → el sistema le pone «m1», «m2»… */
  nombre: string;
  /** Imagen nueva. */
  imagenFile?: File | null;
  imagenViaNanobanana?: boolean;
  /** `true` = quitar la imagen que tenía. */
  quitarImagen?: boolean;
};

export type ArticuloMayoreoInput = {
  categoriaId: string;
  subcategoriaId: string;
  /** Para el nombre automático («Metálico 3»). */
  subcategoriaNombre: string;
  /** Vacío → nombre automático. */
  nombre: string;
  tieneVariaciones: boolean;
  variaciones: VariacionMayoreoInput[];
  precioPropio: boolean;
  /** Solo con `precioPropio`. */
  precio: string;
  menudeo: string;
  /** Costo de compra (opcional). */
  costo: string;
  generoId: string;
  etiquetas: string[];
  imagenFile?: File | null;
  imagenViaNanobanana?: boolean;
  quitarImagen?: boolean;
  usuario?: DatosUsuario | null;
};

function validar(input: ArticuloMayoreoInput, precios: PreciosMayoreo | null): void {
  const error = validarArticuloMayoreo(
    {
      categoriaId: input.categoriaId,
      subcategoriaId: input.subcategoriaId,
      tieneVariaciones: input.tieneVariaciones,
      variaciones: input.variaciones.length,
      precioPropio: input.precioPropio,
      precio: input.precio,
      menudeo: input.menudeo,
    },
    precios,
  );
  if (error) throw new Error(error);
  const costo = Number(input.costo || 0);
  if (!Number.isFinite(costo) || costo < 0) {
    throw new Error("El costo debe ser un número mayor o igual a 0");
  }
}

function nivelDe(
  input: ArticuloMayoreoInput,
  precios: PreciosMayoreo | null,
): PrecioMayoreoNivel {
  if (input.precioPropio) return nivelDeTexto(input.precio, input.menudeo);
  const heredado = resolverPrecioHeredado(input, precios);
  if (!heredado) throw new Error("Esta categoría todavía no tiene precio de mayoreo");
  return { precio: heredado.precio, menudeo: heredado.menudeo };
}

function nombreFinal(input: ArticuloMayoreoInput, otrosNombres: readonly string[]): string {
  return (
    input.nombre.trim() ||
    nombreAutomaticoArticulo(input.subcategoriaNombre, otrosNombres)
  );
}

/**
 * Da de alta un artículo de mayoreo. `otrosNombres` son los nombres de los
 * demás artículos (para numerar el nombre automático).
 */
export async function crearArticuloMayoreo(
  negocioId: string,
  input: ArticuloMayoreoInput,
  precios: PreciosMayoreo | null,
  otrosNombres: readonly string[],
): Promise<Articulo> {
  validar(input, precios);
  const variaciones = input.tieneVariaciones ? input.variaciones : [];
  // Un solo apartado: el id del artículo y el código de cada variación.
  const [id, ...codigos] = await reservarIdsArticulo(negocioId, 1 + variaciones.length);

  let imagenUrl: string | undefined;
  if (input.imagenFile) {
    imagenUrl = await uploadImagenPrincipal(negocioId, id, input.imagenFile);
  }
  const imagenProcesos: RegistroImagenProcesada[] | undefined =
    input.imagenFile && input.imagenViaNanobanana
      ? [nuevoRegistroNanobanana(imagenUrl, input.usuario ?? null)]
      : undefined;

  const nombradas = nombrarVariaciones(variaciones);
  const subvariaciones: ArticuloSubvariacion[] = [];
  for (const [i, v] of nombradas.entries()) {
    const codigo = generarVariacionCodigo(id, subvariaciones);
    const url = v.imagenFile
      ? await uploadImagenSubvariacion(id, codigo, v.imagenFile)
      : undefined;
    subvariaciones.push({
      codigo,
      nombre: v.nombre,
      codigoBarras: codigos[i],
      ...(url ? { imagenUrl: url } : {}),
      ...(url && v.imagenViaNanobanana
        ? { imagenProcesos: [nuevoRegistroNanobanana(url, input.usuario ?? null)] }
        : {}),
    });
  }

  const costo = String(Number(input.costo || 0));
  const articulo: Articulo = {
    id,
    codigo: id,
    nombre: nombreFinal(input, otrosNombres),
    sigla: "",
    referencia: "",
    cantidad: "0",
    preciCompra: costo,
    ...camposPrecioMayoreo(nivelDe(input, precios), { preciCompra: costo, cantidad: "0" }),
    fecha: fechaISO_MX(),
    categoriaId: input.categoriaId,
    subcategoriaId: input.subcategoriaId,
    soloMayoreo: true,
    // Sin «precio diferente» el artículo sigue el precio de su subcategoría
    // o categoría (lo mantienen las functions).
    ...(input.precioPropio ? {} : { heredaPrecio: true }),
    ...(input.generoId ? { generoId: input.generoId } : {}),
    ...(input.etiquetas.length > 0 ? { etiquetas: input.etiquetas } : {}),
    ...(imagenUrl ? { imagenUrl } : {}),
    ...(imagenProcesos ? { imagenProcesos } : {}),
    ...(subvariaciones.length > 0 ? { subvariaciones } : {}),
  };

  await setDoc(doc(db, paths.articulo(negocioId, id)), articulo);
  await marcarArticuloEnSync(negocioId);
  return articulo;
}

/**
 * Guarda los cambios de un artículo de mayoreo sin tocar existencias. No
 * deja quitar una variación con piezas, ni pasar de "sin variaciones" a
 * "con variaciones" (o al revés) mientras haya piezas que se perderían de
 * vista.
 */
export async function actualizarArticuloMayoreo(
  negocioId: string,
  id: string,
  input: ArticuloMayoreoInput,
  precios: PreciosMayoreo | null,
  otrosNombres: readonly string[],
): Promise<Articulo> {
  validar(input, precios);
  const ref = doc(db, paths.articulo(negocioId, id));
  const previoSnap = await getDoc(ref);
  if (!previoSnap.exists()) throw new Error(`El artículo ${id} ya no existe`);
  const previo = previoSnap.data() as Articulo;
  const previas = previo.subvariaciones ?? [];
  const variaciones = input.tieneVariaciones ? input.variaciones : [];

  // Fuera de la transacción: códigos e imágenes (no se pueden subir dentro).
  // Las variaciones nuevas reciben su `v-NN-XXX`; todas las que no tengan
  // código de 8 dígitos (nuevas o de antes de este registro) reciben uno.
  const acumulado: ArticuloSubvariacion[] = [...previas];
  const preparadas: Array<VariacionMayoreoInput & { codigo: string; esNueva: boolean }> = [];
  for (const v of variaciones) {
    const existente = v.codigo ? previas.find((p) => p.codigo === v.codigo) : undefined;
    if (existente?.codigo) {
      preparadas.push({ ...v, codigo: existente.codigo, esNueva: false });
    } else {
      const codigo = generarVariacionCodigo(id, acumulado);
      acumulado.push({ codigo, nombre: v.nombre });
      preparadas.push({ ...v, codigo, esNueva: true });
    }
  }
  const sinCodigoBarras = preparadas.filter(
    (v) => v.esNueva || !previas.find((p) => p.codigo === v.codigo)?.codigoBarras,
  );
  const reservados = await reservarIdsArticulo(negocioId, sinCodigoBarras.length);
  const codigoBarrasNuevo = new Map(
    sinCodigoBarras.map((v, i) => [v.codigo, reservados[i]] as const),
  );

  const imagenes = new Map<string, string>();
  for (const v of preparadas) {
    if (v.imagenFile) {
      imagenes.set(v.codigo, await uploadImagenSubvariacion(id, v.codigo, v.imagenFile));
    }
  }
  const imagenPrincipal = input.imagenFile
    ? await uploadImagenPrincipal(negocioId, id, input.imagenFile)
    : undefined;

  const actualizado = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error(`El artículo ${id} ya no existe`);
    const actual = snap.data() as Articulo;
    const actuales = actual.subvariaciones ?? [];

    if (actuales.length === 0 && preparadas.length > 0 && tieneExistencias(actual)) {
      throw new Error(
        "Este artículo ya tiene existencias: no se le pueden agregar variaciones. Déjalo en cero primero",
      );
    }
    const quedan = new Set(preparadas.map((v) => v.codigo));
    for (const sv of actuales) {
      if (sv.codigo && !quedan.has(sv.codigo) && tieneExistencias(sv)) {
        throw new Error(
          `La variación «${sv.nombre}» tiene existencias: no se puede quitar. Déjala en cero primero`,
        );
      }
    }

    // Las variaciones se arman sobre las del doc recién leído: todo lo que
    // este formulario no maneja (existencias, descuentos…) se conserva.
    const subvariaciones: ArticuloSubvariacion[] = nombrarVariaciones(preparadas).map((v) => {
      const base: ArticuloSubvariacion =
        actuales.find((a) => a.codigo === v.codigo) ?? { codigo: v.codigo, nombre: v.nombre };
      const nueva: ArticuloSubvariacion = { ...base, nombre: v.nombre };
      const codigoBarras = base.codigoBarras ?? codigoBarrasNuevo.get(v.codigo);
      if (codigoBarras) nueva.codigoBarras = codigoBarras;
      const url = imagenes.get(v.codigo);
      if (url) {
        nueva.imagenUrl = url;
        if (v.imagenViaNanobanana) {
          nueva.imagenProcesos = [
            ...(base.imagenProcesos ?? []),
            nuevoRegistroNanobanana(url, input.usuario ?? null),
          ];
        }
      } else if (v.quitarImagen) {
        delete nueva.imagenUrl;
      }
      return nueva;
    });

    // `campos` se escriben; `quitar` se borran del doc. Solo datos de
    // catálogo: ninguna cantidad a nivel artículo.
    const costo = String(Number(input.costo || 0));
    const campos: Partial<Articulo> = {
      nombre: nombreFinal(input, otrosNombres),
      categoriaId: input.categoriaId,
      subcategoriaId: input.subcategoriaId,
      preciCompra: costo,
      soloMayoreo: true,
      ...camposPrecioMayoreo(nivelDe(input, precios), {
        preciCompra: costo,
        cantidad: actual.cantidad,
      }),
    };
    // Los artículos de mayoreo toman su precio de la escalera, no de una zona.
    const quitar: Array<keyof Articulo> = ["zonaPrecioId"];
    if (input.generoId) campos.generoId = input.generoId;
    else quitar.push("generoId");
    if (input.etiquetas.length > 0) campos.etiquetas = input.etiquetas;
    else quitar.push("etiquetas");
    if (input.precioPropio) quitar.push("heredaPrecio");
    else campos.heredaPrecio = true;
    if (subvariaciones.length > 0) campos.subvariaciones = subvariaciones;
    else quitar.push("subvariaciones");
    if (imagenPrincipal) {
      campos.imagenUrl = imagenPrincipal;
      if (input.imagenViaNanobanana) {
        campos.imagenProcesos = [
          ...(actual.imagenProcesos ?? []),
          nuevoRegistroNanobanana(imagenPrincipal, input.usuario ?? null),
        ];
      }
    } else if (input.quitarImagen) {
      quitar.push("imagenUrl");
    }

    const patch: Record<string, unknown | FieldValue> = { ...campos };
    for (const k of quitar) patch[k] = deleteField();
    tx.update(ref, patch);

    const resultado: Articulo = { ...actual, ...campos };
    for (const k of quitar) delete resultado[k];
    return resultado;
  });

  await marcarArticuloEnSync(negocioId);
  return actualizado;
}
