import {
  collection,
  doc,
  getDocs,
  runTransaction,
  setDoc,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import {
  COL_DATOS,
  COL_SUCURSALES,
  DOC_ARTICULOS_AC,
  fechaISO_MX,
  generarID,
  paths,
  type Articulo,
  type ArticuloSubvariacion,
  type Negocio,
  type Resurtido,
  type ResurtidoDisposicion,
  type ResurtidoLinea,
} from "@shared";

// ============================================================
// Helpers de stock por ubicación
// ============================================================

/**
 * Resuelve si la sucursal `sid` es la default del negocio. Si el negocio
 * tiene `sucursalDefaultId` seteado, esa es la respuesta. Si no, fallback:
 * sólo se considera default cuando es la única sucursal conocida (caso
 * actual de "amise"). En la práctica el caller pasa una lista de sucursales
 * cuando aplica el fallback.
 */
function esSucursalDefault(
  sid: string,
  defaultId: string | undefined,
  fallbackPrimerId?: string,
): boolean {
  if (defaultId) return sid === defaultId;
  if (fallbackPrimerId) return sid === fallbackPrimerId;
  // Sin info: tratamos como NO default — entra al mapa, evita pisar `cantidad`.
  return false;
}

/**
 * Lee el stock actual de tienda (no bodega) para una sucursal específica
 * sobre un Articulo o ArticuloSubvariacion. Sigue la regla:
 *   - Si `sid` es default → `obj.cantidad`.
 *   - Si no → `obj.cantidadPorSucursal?.[sid]`.
 *
 * Devuelve número (parseado), 0 si no hay valor.
 */
export function leerStockTienda(
  obj: { cantidad?: string; cantidadPorSucursal?: Record<string, string> },
  sid: string,
  esDefault: boolean,
): number {
  const raw = esDefault
    ? obj.cantidad
    : obj.cantidadPorSucursal?.[sid];
  return Number(raw) || 0;
}

/**
 * Carga la lista de IDs de sucursales del negocio ordenados alfabéticamente.
 * Sirve para resolver `fallbackPrimerId` de `esSucursalDefault` cuando
 * `Negocio.sucursalDefaultId` no está seteado. Esto preserva el contrato
 * legacy de que la primera sucursal (única "amise" hoy) usa `cantidad`.
 */
async function cargarSucursalesIds(negocioId: string): Promise<string[]> {
  const snap = await getDocs(
    collection(db, `${paths.negocio(negocioId)}/${COL_SUCURSALES}`),
  );
  const ids: string[] = [];
  snap.forEach((d) => ids.push(d.id));
  ids.sort();
  return ids;
}

/**
 * Recalcula `cantidad` y `cantidadBodega` (snapshots a nivel de padre)
 * como suma de las subvariaciones. Mantiene el contrato que `articuloService`
 * establece al guardar el artículo.
 */
function recalcularSnapshots(subs: ArticuloSubvariacion[]): {
  cantidad: string;
  cantidadBodega: string;
} {
  let cant = 0;
  let bodega = 0;
  for (const s of subs) {
    cant += Number(s.cantidad) || 0;
    bodega += Number(s.cantidadBodega) || 0;
  }
  return { cantidad: String(cant), cantidadBodega: String(bodega) };
}

// ============================================================
// Crear / avanzar / cerrar resurtido
// ============================================================

export type CrearResurtidoInput = {
  sucursalDestinoId: string;
  sucursalDestinoNombre: string;
  responsableEmpaco: string;
  lineas: Array<Omit<ResurtidoLinea, "disposicion">>;
  notas?: string;
};

/** Crea un resurtido en estado `creando`. NO toca stock. */
export async function crearResurtido(
  negocioId: string,
  input: CrearResurtidoInput,
): Promise<Resurtido> {
  if (input.lineas.length === 0) {
    throw new Error("El resurtido debe tener al menos una línea");
  }
  if (!input.responsableEmpaco.trim()) {
    throw new Error("Falta el responsable que empacó");
  }
  for (const l of input.lineas) {
    if (!Number.isInteger(l.cantidadEnviada) || l.cantidadEnviada <= 0) {
      throw new Error(
        `Cantidad inválida en "${l.nombreSnapshot}": debe ser entero ≥ 1`,
      );
    }
  }
  const id = generarID();
  const resurtido: Resurtido = {
    id,
    estado: "creando",
    sucursalDestinoId: input.sucursalDestinoId,
    sucursalDestinoNombre: input.sucursalDestinoNombre,
    fechaCreacion: fechaISO_MX(),
    responsableEmpaco: input.responsableEmpaco.trim(),
    lineas: input.lineas.map((l) => ({
      articuloId: l.articuloId,
      ...(l.subvariacionCodigo
        ? { subvariacionCodigo: l.subvariacionCodigo }
        : {}),
      nombreSnapshot: l.nombreSnapshot,
      ...(l.siglaSnapshot ? { siglaSnapshot: l.siglaSnapshot } : {}),
      cantidadEnviada: l.cantidadEnviada,
      ...(l.notas ? { notas: l.notas } : {}),
    })),
    ...(input.notas ? { notas: input.notas } : {}),
  };
  await setDoc(doc(db, paths.resurtido(negocioId, id)), resurtido);
  return resurtido;
}

/**
 * Pasa de `creando` → `en_transito`. Atómico:
 *   1. Carga todos los artículos referenciados.
 *   2. Verifica que cada `cantidadBodega` (o `subvariaciones[i].cantidadBodega`)
 *      tenga al menos `linea.cantidadEnviada`.
 *   3. Decrementa.
 *   4. Actualiza el doc del resurtido a `en_transito`.
 *
 * Si una línea falla la validación, se aborta la transacción completa.
 */
export async function marcarEnTransito(
  negocioId: string,
  resurtidoId: string,
  responsableTraslado: string,
): Promise<void> {
  if (!responsableTraslado.trim()) {
    throw new Error("Falta el responsable que trasladó");
  }
  const refResurtido = doc(db, paths.resurtido(negocioId, resurtidoId));
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(refResurtido);
    if (!snap.exists()) throw new Error("Resurtido no encontrado");
    const r = snap.data() as Resurtido;
    if (r.estado !== "creando") {
      throw new Error(
        `No se puede pasar a en_transito desde "${r.estado}"`,
      );
    }

    // Agrupar líneas por articuloId para no leer el mismo doc dos veces.
    const articuloIds = Array.from(new Set(r.lineas.map((l) => l.articuloId)));
    const articuloRefs = articuloIds.map((id) =>
      doc(db, paths.articulo(negocioId, id)),
    );
    const articuloSnaps = await Promise.all(articuloRefs.map((ref) => tx.get(ref)));
    const articuloDocs = new Map<string, Articulo>();
    for (let i = 0; i < articuloIds.length; i++) {
      const s = articuloSnaps[i]!;
      if (!s.exists()) {
        throw new Error(`Artículo ${articuloIds[i]} no existe`);
      }
      articuloDocs.set(articuloIds[i]!, s.data() as Articulo);
    }

    // Construir patches por articulo. Acumulamos sobre `Patch` cuando hay
    // múltiples líneas que tocan el mismo articulo (ej. 2 subvariaciones
    // distintas o varias líneas duplicadas del mismo padre sin variación).
    type Patch = {
      cantidad?: string;
      cantidadBodega?: string;
      subvariaciones?: ArticuloSubvariacion[];
    };
    const patches = new Map<string, Patch>();
    for (const linea of r.lineas) {
      const art = articuloDocs.get(linea.articuloId)!;
      const patch = patches.get(linea.articuloId) ?? {};
      if (linea.subvariacionCodigo) {
        const subs = patch.subvariaciones ?? art.subvariaciones ?? [];
        const idx = subs.findIndex(
          (s) => s.codigo === linea.subvariacionCodigo,
        );
        if (idx === -1) {
          throw new Error(
            `Subvariación ${linea.subvariacionCodigo} no encontrada en ${linea.articuloId}`,
          );
        }
        const actual = Number(subs[idx]!.cantidadBodega) || 0;
        if (actual < linea.cantidadEnviada) {
          throw new Error(
            `Stock bodega insuficiente para "${linea.nombreSnapshot}": ${actual} disponibles, ${linea.cantidadEnviada} solicitadas`,
          );
        }
        const nuevoSubs = subs.map((s, i) =>
          i === idx
            ? { ...s, cantidadBodega: String(actual - linea.cantidadEnviada) }
            : s,
        );
        patch.subvariaciones = nuevoSubs;
        // Snapshot del padre = suma de subvariaciones (mismo contrato que
        // articuloService cuando se guarda un artículo con subvariaciones).
        const snap = recalcularSnapshots(nuevoSubs);
        patch.cantidad = snap.cantidad;
        patch.cantidadBodega = snap.cantidadBodega;
      } else {
        const actual =
          patch.cantidadBodega !== undefined
            ? Number(patch.cantidadBodega)
            : Number(art.cantidadBodega) || 0;
        if (actual < linea.cantidadEnviada) {
          throw new Error(
            `Stock bodega insuficiente para "${linea.nombreSnapshot}": ${actual} disponibles, ${linea.cantidadEnviada} solicitadas`,
          );
        }
        patch.cantidadBodega = String(actual - linea.cantidadEnviada);
      }
      patches.set(linea.articuloId, patch);
    }

    // Aplicar patches.
    for (const [aid, patch] of patches) {
      const ref = doc(db, paths.articulo(negocioId, aid));
      tx.update(ref, patch as Record<string, unknown>);
    }

    tx.update(refResurtido, {
      estado: "en_transito",
      fechaEnTransito: fechaISO_MX(),
      responsableTraslado: responsableTraslado.trim(),
    });
  });

  // Best-effort: huella articulos_ac.
  try {
    await setDoc(
      doc(db, `${paths.negocio(negocioId)}/${COL_DATOS}/${DOC_ARTICULOS_AC}`),
      { huella: generarID() },
      { merge: true },
    );
  } catch (e) {
    console.warn("No se pudo marcar huella:", e);
  }
}

/** Pasa de `en_transito` → `recibido`. NO toca stock. */
export async function marcarRecibido(
  negocioId: string,
  resurtidoId: string,
  responsableRecibe: string,
): Promise<void> {
  if (!responsableRecibe.trim()) {
    throw new Error("Falta el responsable que recibió");
  }
  const ref = doc(db, paths.resurtido(negocioId, resurtidoId));
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Resurtido no encontrado");
    const r = snap.data() as Resurtido;
    if (r.estado !== "en_transito") {
      throw new Error(`No se puede recibir desde "${r.estado}"`);
    }
    tx.update(ref, {
      estado: "recibido",
      fechaRecibido: fechaISO_MX(),
      responsableRecibe: responsableRecibe.trim(),
    });
  });
}

export type CerrarResurtidoInput = {
  responsableConfirma: string;
  /** Una entrada por cada línea del resurtido (mismo orden). */
  disposiciones: ResurtidoDisposicion[];
};

/**
 * Pasa de `recibido` → `cerrado`. Atómico:
 *   1. Lee el negocio (para resolver `sucursalDefaultId`).
 *   2. Lee todos los artículos referenciados.
 *   3. Por cada línea, suma `disposicion.tienda` al campo correcto:
 *      `cantidad` si el destino es default, `cantidadPorSucursal[sid]` si no.
 *      `dañado` y `perdido` no suman a ningún stock — quedan como reporte.
 *   4. Persiste las disposiciones en cada `linea` y cambia estado a `cerrado`.
 *
 * Valida que la suma `tienda + dañado + perdido === cantidadEnviada` para
 * cada línea.
 */
export async function cerrarResurtido(
  negocioId: string,
  resurtidoId: string,
  input: CerrarResurtidoInput,
): Promise<void> {
  if (!input.responsableConfirma.trim()) {
    throw new Error("Falta el responsable que confirmó");
  }
  // Pre-cargar IDs de sucursales para resolver el fallback alfabético del
  // default (cuando `Negocio.sucursalDefaultId` no está seteado). Hace
  // falta hacerlo FUERA de la transacción porque las tx no pueden leer
  // colecciones, sólo docs.
  const sucursalesIdsAlfabetico = await cargarSucursalesIds(negocioId);
  const fallbackPrimerSucursalId = sucursalesIdsAlfabetico[0];
  const refResurtido = doc(db, paths.resurtido(negocioId, resurtidoId));
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(refResurtido);
    if (!snap.exists()) throw new Error("Resurtido no encontrado");
    const r = snap.data() as Resurtido;
    if (r.estado !== "recibido") {
      throw new Error(`No se puede cerrar desde "${r.estado}"`);
    }
    if (input.disposiciones.length !== r.lineas.length) {
      throw new Error(
        "El número de disposiciones no coincide con el de líneas",
      );
    }
    // Validar sumas.
    for (let i = 0; i < r.lineas.length; i++) {
      const linea = r.lineas[i]!;
      const d = input.disposiciones[i]!;
      const total = d.tienda + d.dañado + d.perdido;
      if (
        !Number.isInteger(d.tienda) ||
        !Number.isInteger(d.dañado) ||
        !Number.isInteger(d.perdido) ||
        d.tienda < 0 ||
        d.dañado < 0 ||
        d.perdido < 0
      ) {
        throw new Error(
          `Disposición inválida en "${linea.nombreSnapshot}": deben ser enteros ≥ 0`,
        );
      }
      if (total !== linea.cantidadEnviada) {
        throw new Error(
          `Disposición de "${linea.nombreSnapshot}": ${total} no coincide con enviadas ${linea.cantidadEnviada}`,
        );
      }
    }

    // Resolver default sucursal.
    const negocioSnap = await tx.get(doc(db, paths.negocio(negocioId)));
    const negocio = negocioSnap.exists()
      ? (negocioSnap.data() as Negocio)
      : null;
    const destEsDefault = esSucursalDefault(
      r.sucursalDestinoId,
      negocio?.sucursalDefaultId,
      fallbackPrimerSucursalId,
    );

    // Cargar artículos referenciados. Si alguno fue borrado entre creación
    // y cierre, abortamos toda la transacción — el reporte quedaría con
    // disposicion.tienda > 0 contra un articulo inexistente, y nadie podría
    // remediar el "stock fantasma" ya persistido. Mejor obligar a resolver
    // (restaurando el artículo o cancelando el resurtido) antes.
    const articuloIds = Array.from(new Set(r.lineas.map((l) => l.articuloId)));
    const articuloRefs = articuloIds.map((id) =>
      doc(db, paths.articulo(negocioId, id)),
    );
    const articuloSnaps = await Promise.all(articuloRefs.map((ref) => tx.get(ref)));
    const articuloDocs = new Map<string, Articulo>();
    const faltantes: string[] = [];
    for (let i = 0; i < articuloIds.length; i++) {
      const s = articuloSnaps[i]!;
      if (!s.exists()) {
        faltantes.push(articuloIds[i]!);
        continue;
      }
      articuloDocs.set(articuloIds[i]!, s.data() as Articulo);
    }
    if (faltantes.length > 0) {
      throw new Error(
        `No se puede cerrar: artículo(s) borrado(s) entre creación y cierre [${faltantes.join(", ")}]. Restáuralos o cancela el resurtido.`,
      );
    }

    type Patch = {
      cantidad?: string;
      cantidadPorSucursal?: Record<string, string>;
      subvariaciones?: ArticuloSubvariacion[];
    };
    const patches = new Map<string, Patch>();

    for (let i = 0; i < r.lineas.length; i++) {
      const linea = r.lineas[i]!;
      const sumaTienda = input.disposiciones[i]!.tienda;
      if (sumaTienda === 0) continue; // dañado/perdido = no incremento
      const art = articuloDocs.get(linea.articuloId)!;
      const patch = patches.get(linea.articuloId) ?? {};

      if (linea.subvariacionCodigo) {
        const subs = patch.subvariaciones ?? art.subvariaciones ?? [];
        const idx = subs.findIndex(
          (s) => s.codigo === linea.subvariacionCodigo,
        );
        if (idx === -1) {
          throw new Error(
            `Subvariación ${linea.subvariacionCodigo} fue eliminada del artículo ${linea.articuloId} entre creación y cierre. Restáurala o cancela.`,
          );
        }
        const sv = subs[idx]!;
        let svActualizada: ArticuloSubvariacion;
        if (destEsDefault) {
          const actual = Number(sv.cantidad) || 0;
          svActualizada = { ...sv, cantidad: String(actual + sumaTienda) };
        } else {
          const mapaActual = { ...(sv.cantidadPorSucursal ?? {}) };
          const actual = Number(mapaActual[r.sucursalDestinoId]) || 0;
          mapaActual[r.sucursalDestinoId] = String(actual + sumaTienda);
          svActualizada = { ...sv, cantidadPorSucursal: mapaActual };
        }
        const subsNuevas = subs.map((s, j) => (j === idx ? svActualizada : s));
        patch.subvariaciones = subsNuevas;
        // Mantener `cantidad` snapshot del padre como suma de subs (mismo
        // contrato que `articuloService.resolverSubvariaciones`). Sólo se
        // actualiza si el destino es default — sino, las subs cambian
        // `cantidadPorSucursal[sid]` pero `cantidad` queda igual.
        if (destEsDefault) {
          const snap = recalcularSnapshots(subsNuevas);
          patch.cantidad = snap.cantidad;
        }
        // `cantidadBodega` snapshot del padre NO cambia aquí: bodega ya se
        // decrementó al pasar a en_transito; sus valores en subs siguen
        // intactos en este punto.
      } else if (destEsDefault) {
        const actual =
          patch.cantidad !== undefined
            ? Number(patch.cantidad)
            : Number(art.cantidad) || 0;
        patch.cantidad = String(actual + sumaTienda);
      } else {
        const mapaActual =
          patch.cantidadPorSucursal ?? { ...(art.cantidadPorSucursal ?? {}) };
        const actual = Number(mapaActual[r.sucursalDestinoId]) || 0;
        mapaActual[r.sucursalDestinoId] = String(actual + sumaTienda);
        patch.cantidadPorSucursal = mapaActual;
      }

      patches.set(linea.articuloId, patch);
    }

    for (const [aid, patch] of patches) {
      const ref = doc(db, paths.articulo(negocioId, aid));
      tx.update(ref, patch as Record<string, unknown>);
    }

    // Actualizar líneas con disposiciones + cerrar el resurtido.
    const lineasCerradas: ResurtidoLinea[] = r.lineas.map((l, i) => ({
      ...l,
      disposicion: input.disposiciones[i],
    }));
    tx.update(refResurtido, {
      estado: "cerrado",
      fechaCerrado: fechaISO_MX(),
      responsableConfirma: input.responsableConfirma.trim(),
      lineas: lineasCerradas,
    });
  });

  // Huella best-effort.
  try {
    await setDoc(
      doc(db, `${paths.negocio(negocioId)}/${COL_DATOS}/${DOC_ARTICULOS_AC}`),
      { huella: generarID() },
      { merge: true },
    );
  } catch (e) {
    console.warn("No se pudo marcar huella:", e);
  }
}

/**
 * Cancela un resurtido sólo si está en `creando`. Si ya pasó a `en_transito`,
 * tendría que devolverse stock — caso fuera de scope MVP.
 */
export async function cancelarResurtidoCreando(
  negocioId: string,
  resurtidoId: string,
): Promise<void> {
  const ref = doc(db, paths.resurtido(negocioId, resurtidoId));
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Resurtido no encontrado");
    const r = snap.data() as Resurtido;
    if (r.estado !== "creando") {
      throw new Error(
        `Sólo se puede cancelar un resurtido en estado "creando"`,
      );
    }
    tx.delete(ref);
  });
}
