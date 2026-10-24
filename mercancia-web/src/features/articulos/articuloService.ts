import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  setDoc,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";
import { db, storage } from "@/firebase/config";
import {
  paths,
  COL_ARTICULOS,
  COL_DATOS,
  DOC_ARTICULOS_AC,
  fechaISO_MX,
  generarID,
  generarVariacionCodigo,
  siguienteArticuloId,
  type Articulo,
  type ArticuloSubvariacion,
  type RegistroImagenProcesada,
} from "@shared";
import { compressToWebP } from "@/lib/image";
import {
  nuevoRegistroNanobanana,
  type DatosUsuario,
} from "@/lib/costosNanobanana";

// ============================================================
// Contador secuencial de IDs de artículo
// ============================================================
// Path: negocios_web_new_version/{nid}/datos_web_new_version/_contadorArticulos
// { ultimoId: string, actualizado: timestamp }
//
// El contador por sí solo no basta: si quedó ausente o atrasado respecto al
// catálogo (migración legacy que copió artículos sin inicializarlo, altas
// hechas desde otra app), `siguienteArticuloId(prev)` devuelve un ID que ya
// existe y el `setDoc` de `crearArticulo` sobrescribe ese artículo en
// silencio. Por eso SIEMPRE se escanea el máximo numérico de la colección y
// la base es `max(contador, máximo existente)` — mismo enfoque que admin-web.
// Costo: un pase por la colección por cada `crearArticulo`; es una acción
// manual y poco frecuente, y no compensa arriesgar una sobreescritura.
// ============================================================

async function siguienteId(negocioId: string): Promise<string> {
  const ref = doc(
    db,
    `${paths.negocio(negocioId)}/${COL_DATOS}/_contadorArticulos`,
  );

  // Máximo real del catálogo. Va fuera de la TX (el SDK web no puede leer una
  // colección dentro de una transacción) y es indispensable contra "contador
  // atrasado".
  const colArticulos = collection(
    db,
    `${paths.negocio(negocioId)}/${COL_ARTICULOS}`,
  );
  const todos = await getDocs(colArticulos);
  let scanMaxNum = 0;
  todos.forEach((d) => {
    if (/^\d+$/.test(d.id)) {
      const n = parseInt(d.id, 10);
      if (n > scanMaxNum) scanMaxNum = n;
    }
  });

  let nuevo = "";
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const prev = snap.exists()
      ? (snap.data().ultimoId as string | undefined) ?? null
      : null;
    const counterNum = prev && /^\d+$/.test(prev) ? parseInt(prev, 10) : 0;
    // max(contador, escaneo) cubre:
    //   - contador ausente → gana el escaneo
    //   - contador atrasado → gana el escaneo
    //   - catálogo vacío (recién vaciado) → gana el contador
    const baseNum = Math.max(counterNum, scanMaxNum);
    const base = baseNum > 0 ? String(baseNum) : null;
    nuevo = siguienteArticuloId(base);
    tx.set(ref, { ultimoId: nuevo }, { merge: true });
  });
  return nuevo;
}

// ============================================================
// Upload de imagen
// ============================================================

export async function uploadImagenPrincipal(
  negocioId: string,
  articuloId: string,
  file: File,
): Promise<string> {
  const blob = await compressToWebP(file);
  const path = `media_web_new_version/articulos/${articuloId}.webp`;
  const ref = storageRef(storage, path);
  await uploadBytes(ref, blob, { contentType: "image/webp" });
  const url = await getDownloadURL(ref);
  // Track negocio path in custom metadata? Storage paths are global por ahora.
  void negocioId;
  return url;
}

/**
 * Sube la imagen de una subvariación al path estable basado en su `codigo`.
 * Usa `paths.storageArticuloSubvariacion(artId, codigo)` (Fase 1) — ya no
 * depende del índice del array, así reordenar las subvariaciones no rompe
 * las URLs de imagen.
 */
export async function uploadImagenSubvariacion(
  articuloId: string,
  codigo: string,
  file: File,
): Promise<string> {
  const blob = await compressToWebP(file);
  const path = paths.storageArticuloSubvariacion(articuloId, codigo);
  const ref = storageRef(storage, path);
  await uploadBytes(ref, blob, { contentType: "image/webp" });
  return await getDownloadURL(ref);
}

async function borrarImagen(path: string): Promise<void> {
  try {
    await deleteObject(storageRef(storage, path));
  } catch (e) {
    console.warn("No se pudo borrar imagen:", path, e);
  }
}

// ============================================================
// Sync protocol: articulos_ac
// ============================================================
// Esquema:
//   { huella: string, [articuloId]: [{ deviceId: boolean }, ...] }
// ============================================================

// FIX C4: los nodos web usan onSnapshot sobre articulos_n y reciben los
// cambios en tiempo real sin necesidad del protocolo de acknowledge por
// deviceId. Escribimos únicamente la huella (contrato del schema) — si en
// el futuro reaparecen clientes legacy (Android/Electron) que lo requieran,
// se re-introduce el campo de flags por nodo.
async function marcarArticuloEnSync(negocioId: string): Promise<void> {
  const acRef = doc(
    db,
    `${paths.negocio(negocioId)}/${COL_DATOS}/${DOC_ARTICULOS_AC}`,
  );
  await setDoc(acRef, { huella: generarID() }, { merge: true });
}

// ============================================================
// Helpers de subvariaciones (Fase 4)
// ============================================================

/**
 * Resuelve las subvariaciones a guardar:
 *   - asigna `codigo` `v-NN-XXX` a las que no lo tienen (preserva los
 *     existentes — fundamental para que no cambie el ID al editar);
 *   - sube imágenes nuevas al path estable basado en codigo;
 *   - retorna también `cantidadSnapshot` = suma de cantidades por
 *     subvariación, para mantener `Articulo.cantidad` informativo.
 */
async function resolverSubvariaciones(
  articuloId: string,
  meta: ArticuloSubvariacion[],
  files: Array<File | null> | undefined,
  existentes: ArticuloSubvariacion[] = [],
  /** Para cada subvariación, indica si la imagen subida vino de Gemini.
   *  Si true, agregamos un `RegistroImagenProcesada` al historial. */
  viaNanobanana?: boolean[],
  usuario?: DatosUsuario | null,
): Promise<{
  subvariaciones: ArticuloSubvariacion[];
  cantidadSnapshot: number;
  cantidadBodegaSnapshot: number;
}> {
  const acumulado: ArticuloSubvariacion[] = [...existentes];

  const out = await Promise.all(
    meta.map(async (sv, idx) => {
      let codigo = sv.codigo;
      if (!codigo) {
        codigo = generarVariacionCodigo(articuloId, acumulado);
        acumulado.push({ codigo, nombre: sv.nombre });
      }

      const file = files?.[idx];
      let imagenUrl = sv.imagenUrl;
      if (file) {
        imagenUrl = await uploadImagenSubvariacion(articuloId, codigo, file);
      } else if (!imagenUrl) {
        imagenUrl = existentes.find((e) => e.codigo === codigo)?.imagenUrl;
      }

      // Historial de procesos: preserva existente; si esta subida vino de
      // nanobanana, agrega un registro nuevo.
      const existenteSv = existentes.find((e) => e.codigo === codigo);
      let imagenProcesos: RegistroImagenProcesada[] | undefined =
        existenteSv?.imagenProcesos
          ? [...existenteSv.imagenProcesos]
          : undefined;
      if (file && viaNanobanana?.[idx]) {
        const registro = nuevoRegistroNanobanana(imagenUrl, usuario ?? null);
        imagenProcesos = [...(imagenProcesos ?? []), registro];
      }

      const precioDescuento =
        sv.precioDescuento ?? existenteSv?.precioDescuento;

      const final: ArticuloSubvariacion = {
        codigo,
        nombre: sv.nombre,
        ...(sv.referencia ? { referencia: sv.referencia } : {}),
        ...(imagenUrl ? { imagenUrl } : {}),
        ...(sv.cantidad ? { cantidad: sv.cantidad } : {}),
        ...(sv.cantidadBodega ? { cantidadBodega: sv.cantidadBodega } : {}),
        // El editor no maneja el stock de las otras sucursales: se toma del
        // doc actual para no borrar lo que cargaron resurtidos o el editor de
        // existencias (ni pisar ventas hechas mientras se editaba; el form
        // conserva la copia de cuando se abrió la página).
        ...(existenteSv?.cantidadPorSucursal
          ? { cantidadPorSucursal: existenteSv.cantidadPorSucursal }
          : {}),
        // Tampoco maneja el descuento por subvariación (se edita en
        // admin-web): `sv` lo trae si el form lo conservó; si no, el del doc.
        // `""` = quitar el descuento.
        ...(precioDescuento ? { precioDescuento } : {}),
        ...(imagenProcesos && imagenProcesos.length > 0
          ? { imagenProcesos }
          : {}),
      };
      return final;
    }),
  );

  const cantidadSnapshot = out.reduce(
    (acc, sv) => acc + (Number(sv.cantidad) || 0),
    0,
  );
  const cantidadBodegaSnapshot = out.reduce(
    (acc, sv) => acc + (Number(sv.cantidadBodega) || 0),
    0,
  );

  return { subvariaciones: out, cantidadSnapshot, cantidadBodegaSnapshot };
}

// ============================================================
// CRUD
// ============================================================

export type ArticuloInput = Omit<Articulo, "id" | "codigo" | "fecha"> & {
  imagenFile?: File | null;
  /** true si `imagenFile` salió de "Quitar fondo" (Gemini). Si lo está,
   *  el service agrega un `RegistroImagenProcesada` al historial. */
  imagenViaNanobanana?: boolean;
  subvariacionesFiles?: Array<File | null>;
  /** Paralelo a `subvariacionesFiles` — true si la imagen de cada subvariación
   *  vino de Gemini. */
  subvariacionesViaNanobanana?: boolean[];
  /** Datos del usuario actual (para el campo `uidUsuario` / `emailUsuario`
   *  del registro). Si se omite, no se registra el dato. */
  usuario?: DatosUsuario | null;
};

export async function crearArticulo(
  negocioId: string,
  input: ArticuloInput,
): Promise<Articulo> {
  const id = await siguienteId(negocioId);

  const {
    imagenFile,
    imagenViaNanobanana,
    subvariacionesFiles,
    subvariacionesViaNanobanana,
    subvariaciones: subvariacionesMeta,
    usuario,
    ...rest
  } = input;

  let imagenUrl = input.imagenUrl;
  if (imagenFile) {
    imagenUrl = await uploadImagenPrincipal(negocioId, id, imagenFile);
  }

  // Si la imagen subida vino de nanobanana, registramos costo + fecha.
  const imagenProcesos: RegistroImagenProcesada[] | undefined =
    imagenFile && imagenViaNanobanana
      ? [nuevoRegistroNanobanana(imagenUrl, usuario ?? null)]
      : undefined;

  let subvariaciones: ArticuloSubvariacion[] | undefined;
  let cantidadSnapshot: number | undefined;
  let cantidadBodegaSnapshot: number | undefined;
  if (subvariacionesMeta && subvariacionesMeta.length > 0) {
    const r = await resolverSubvariaciones(
      id,
      subvariacionesMeta,
      subvariacionesFiles,
      [],
      subvariacionesViaNanobanana,
      usuario,
    );
    subvariaciones = r.subvariaciones;
    cantidadSnapshot = r.cantidadSnapshot;
    cantidadBodegaSnapshot = r.cantidadBodegaSnapshot;
  }

  const articulo: Articulo = {
    ...(rest as Omit<Articulo, "id" | "codigo" | "fecha">),
    id,
    codigo: id,
    fecha: fechaISO_MX(),
    imagenUrl,
    ...(cantidadSnapshot !== undefined
      ? { cantidad: String(cantidadSnapshot) }
      : {}),
    ...(cantidadBodegaSnapshot !== undefined
      ? { cantidadBodega: String(cantidadBodegaSnapshot) }
      : {}),
    ...(subvariaciones ? { subvariaciones } : {}),
    ...(imagenProcesos ? { imagenProcesos } : {}),
  };

  await setDoc(doc(db, paths.articulo(negocioId, id)), articulo);
  await marcarArticuloEnSync(negocioId);

  return articulo;
}

export async function actualizarArticulo(
  negocioId: string,
  id: string,
  input: ArticuloInput,
): Promise<Articulo> {
  const refDoc = doc(db, paths.articulo(negocioId, id));
  const existenteSnap = await getDoc(refDoc);
  if (!existenteSnap.exists()) {
    throw new Error(`Artículo ${id} no existe`);
  }
  const existente = existenteSnap.data() as Articulo;

  const {
    imagenFile,
    imagenViaNanobanana,
    subvariacionesFiles,
    subvariacionesViaNanobanana,
    subvariaciones: subvariacionesMeta,
    usuario,
    ...rest
  } = input;

  // FIX D3: `imagenUrl: ""` explícito del input = "user quitó la imagen".
  // `undefined` = "no se tocó" → mantener existente.
  let imagenUrl: string | undefined;
  if (imagenFile) {
    imagenUrl = await uploadImagenPrincipal(negocioId, id, imagenFile);
  } else if (input.imagenUrl === "") {
    imagenUrl = undefined;
    await borrarImagen(`media_web_new_version/articulos/${id}.webp`);
  } else if (input.imagenUrl !== undefined) {
    imagenUrl = input.imagenUrl;
  } else {
    imagenUrl = existente.imagenUrl;
  }

  // Historial de procesos: preserva existente; si esta actualización subió
  // imagen procesada por nanobanana, agrega un registro nuevo.
  let imagenProcesos: RegistroImagenProcesada[] | undefined =
    existente.imagenProcesos ? [...existente.imagenProcesos] : undefined;
  if (imagenFile && imagenViaNanobanana) {
    imagenProcesos = [
      ...(imagenProcesos ?? []),
      nuevoRegistroNanobanana(imagenUrl, usuario ?? null),
    ];
  }

  let subvariaciones: ArticuloSubvariacion[] | undefined;
  let cantidadSnapshot: number | undefined;
  let cantidadBodegaSnapshot: number | undefined;
  if (subvariacionesMeta) {
    const r = await resolverSubvariaciones(
      id,
      subvariacionesMeta,
      subvariacionesFiles,
      existente.subvariaciones ?? [],
      subvariacionesViaNanobanana,
      usuario,
    );
    subvariaciones = r.subvariaciones;
    cantidadSnapshot = r.cantidadSnapshot;
    cantidadBodegaSnapshot = r.cantidadBodegaSnapshot;
  }

  const actualizado: Articulo = {
    ...existente,
    ...(rest as Omit<Articulo, "id" | "codigo" | "fecha">),
    id,
    codigo: id,
    imagenUrl,
    ...(cantidadSnapshot !== undefined
      ? { cantidad: String(cantidadSnapshot) }
      : {}),
    ...(cantidadBodegaSnapshot !== undefined
      ? { cantidadBodega: String(cantidadBodegaSnapshot) }
      : {}),
    ...(subvariaciones !== undefined ? { subvariaciones } : {}),
    ...(imagenProcesos && imagenProcesos.length > 0
      ? { imagenProcesos }
      : {}),
  };

  await setDoc(refDoc, actualizado);
  await marcarArticuloEnSync(negocioId);

  return actualizado;
}

export async function eliminarArticulo(
  negocioId: string,
  id: string,
): Promise<void> {
  const refDoc = doc(db, paths.articulo(negocioId, id));
  const snap = await getDoc(refDoc);
  const existente = snap.exists() ? (snap.data() as Articulo) : null;

  await deleteDoc(refDoc);

  // Borrar imágenes best-effort
  await borrarImagen(paths.storageArticuloPrincipal(id));
  if (existente?.subvariaciones) {
    await Promise.all(
      existente.subvariaciones.map((sv, idx) => {
        // Doble path: codigo (v2) y _sv{idx} (legacy) — ambos best-effort.
        const tasks: Array<Promise<void>> = [];
        if (sv.codigo) {
          tasks.push(
            borrarImagen(paths.storageArticuloSubvariacion(id, sv.codigo)),
          );
        }
        tasks.push(
          borrarImagen(paths.storageArticuloSubvariacionLegacy(id, idx)),
        );
        return Promise.all(tasks);
      }),
    );
  }

  await marcarArticuloEnSync(negocioId);
}
