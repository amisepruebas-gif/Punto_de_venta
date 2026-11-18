import {
  collection,
  deleteField,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "@/firebase/config";
import {
  IMPRESION_TOPE_ADMIN,
  codigoVinculacionImpresora,
  generarSecretoEnlace,
  hashSecretoEnlace,
  paths,
  type EnlaceLote,
} from "@shared";

// ============================================================
// Impresoras de etiquetas — lo que hace admin
// ============================================================
//
// Cada impresora es una PC con el programa "AMISE Impresora". Se vincula con
// un acceso `imprimir` (como los enlaces de armar: un equipo, apagador,
// renovar) y tiene su doc en `impresoras_web_new_version` con el mismo id.
// El código de vinculación es la llave: solo se muestra al crearlo o
// renovarlo (se guarda su huella).

const MAX_NOMBRE = 60;

const APAGADA = "Esa impresora está apagada (Accesos → Impresoras) o ya no existe. Préndela y vuelve a intentar.";

/** Firestore dijo que no al mandar o reimprimir: con admin, es que la
 *  impresora está apagada o se borró. */
function traducirPermiso(e: unknown): never {
  const code = typeof e === "object" && e !== null && "code" in e ? String((e as { code: unknown }).code) : "";
  if (code === "permission-denied") throw new Error(APAGADA);
  throw e;
}

function limpiarNombre(nombre: string): string {
  const n = nombre.trim();
  if (!n) throw new Error("Ponle un nombre a la impresora");
  if (n.length > MAX_NOMBRE) throw new Error(`El nombre puede tener hasta ${MAX_NOMBRE} letras`);
  return n;
}

function uidActual(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Vuelve a iniciar sesión");
  return uid;
}

/**
 * Crea la impresora: su acceso `imprimir` y su doc, juntos. Devuelve el
 * código de vinculación: es la ÚNICA vez que existe completo.
 */
export async function crearImpresora(
  negocioId: string,
  nombre: string,
  sucursalId: string | null,
): Promise<{ impresoraId: string; codigo: string }> {
  const uid = uidActual();
  const limpio = limpiarNombre(nombre);
  const secreto = generarSecretoEnlace();
  const secretoHash = await hashSecretoEnlace(secreto);
  const ref = doc(collection(db, paths.enlacesLoteCol(negocioId)));
  const batch = writeBatch(db);
  // Las reglas exigen exactamente estos campos y valores.
  batch.set(ref, {
    tipo: "imprimir",
    activo: true,
    gen: 0,
    nombre: limpio,
    secretoHash,
    creadoPor: uid,
    creadoEn: serverTimestamp(),
    ...(sucursalId ? { sucursalId } : {}),
  });
  batch.set(doc(db, paths.impresora(negocioId, ref.id)), {
    nombre: limpio,
    ...(sucursalId ? { sucursalId } : {}),
    creadoEn: serverTimestamp(),
  });
  await batch.commit();
  return { impresoraId: ref.id, codigo: codigoVinculacionImpresora(negocioId, ref.id, secreto) };
}

/**
 * Código nuevo para la misma impresora (otra PC, o se perdió el código): sube
 * `gen`, así la PC vinculada deja de imprimir hasta que le peguen el nuevo.
 */
export async function renovarCodigoImpresora(
  negocioId: string,
  impresoraId: string,
): Promise<{ codigo: string }> {
  const secreto = generarSecretoEnlace();
  const secretoHash = await hashSecretoEnlace(secreto);
  const ref = doc(db, paths.enlaceLote(negocioId, impresoraId));
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Esa impresora ya no existe");
    const e = snap.data() as EnlaceLote;
    if (e.tipo !== "imprimir") throw new Error("Ese acceso no es de una impresora");
    tx.update(ref, { secretoHash, gen: (Number(e.gen) || 0) + 1, canjes: 0 });
  });
  return { codigo: codigoVinculacionImpresora(negocioId, impresoraId, secreto) };
}

export async function renombrarImpresora(negocioId: string, impresoraId: string, nombre: string): Promise<void> {
  const limpio = limpiarNombre(nombre);
  const batch = writeBatch(db);
  batch.update(doc(db, paths.enlaceLote(negocioId, impresoraId)), { nombre: limpio });
  batch.update(doc(db, paths.impresora(negocioId, impresoraId)), { nombre: limpio });
  await batch.commit();
}

/** La sucursal de la impresora: ahí manda la caja sus etiquetas de precio. */
export async function cambiarSucursalImpresora(
  negocioId: string,
  impresoraId: string,
  sucursalId: string | null,
): Promise<void> {
  await updateDoc(doc(db, paths.impresora(negocioId, impresoraId)), {
    sucursalId: sucursalId || deleteField(),
  });
}

/** Borra la impresora y cancela lo que esperaba en su cola. */
export async function borrarImpresora(negocioId: string, impresoraId: string): Promise<void> {
  const pendientes = await getDocs(
    query(
      collection(db, paths.impresionesCol(negocioId)),
      where("impresoraId", "==", impresoraId),
      where("estado", "==", "pendiente"),
    ),
  );
  const batch = writeBatch(db);
  for (const d of pendientes.docs) {
    batch.update(d.ref, { estado: "error", error: "La impresora se borró en admin." });
  }
  batch.delete(doc(db, paths.enlaceLote(negocioId, impresoraId)));
  batch.delete(doc(db, paths.impresora(negocioId, impresoraId)));
  await batch.commit();
}

// ---------- La cola ----------

export const MAX_ETIQUETAS_IMPRESORA = IMPRESION_TOPE_ADMIN;

/** Manda a imprimir etiquetas numeradas de lote. Los números los aparta la
 *  impresora al tomar la orden. Devuelve el id de la orden. */
export async function mandarEtiquetasLote(
  negocioId: string,
  impresoraId: string,
  cantidad: number,
  quien: string,
): Promise<string> {
  const uid = uidActual();
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAX_ETIQUETAS_IMPRESORA) {
    throw new Error(`Indica de 1 a ${MAX_ETIQUETAS_IMPRESORA} etiquetas`);
  }
  // El id se saca UNA vez y se crea en una transacción: si el SDK la repite
  // (se perdió la respuesta), encuentra la orden ya creada y no manda otra.
  const ref = doc(collection(db, paths.impresionesCol(negocioId)));
  await runTransaction(db, async (tx) => {
    const ya = await tx.get(ref);
    if (ya.exists()) return;
    tx.set(ref, {
      tipo: "etiquetas_lote",
      impresoraId,
      estado: "pendiente",
      origen: "admin",
      creadoPor: uid,
      ...(quien.trim() ? { quien: quien.trim().slice(0, 80) } : {}),
      creadoEn: serverTimestamp(),
      cantidad,
    });
  }).catch(traducirPermiso);
  return ref.id;
}

/** "Reimprimir": la regresa a la cola con sus mismos números. */
export async function reimprimirTrabajo(negocioId: string, trabajoId: string): Promise<void> {
  await updateDoc(doc(db, paths.impresion(negocioId, trabajoId)), {
    estado: "pendiente",
    error: deleteField(),
  }).catch(traducirPermiso);
}

/** Cancela una que espera en la cola, o libera una que se quedó imprimiendo. */
export async function cancelarTrabajo(
  negocioId: string,
  trabajoId: string,
  motivo: "cancelada" | "liberada",
): Promise<void> {
  await updateDoc(doc(db, paths.impresion(negocioId, trabajoId)), {
    estado: "error",
    error:
      motivo === "cancelada"
        ? "Se canceló en admin."
        : "Se liberó en admin: revisa si salieron y, si no, reimprime.",
  });
}

/** Quita de la lista una orden ya atendida. */
export async function borrarTrabajo(negocioId: string, trabajoId: string): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, paths.impresion(negocioId, trabajoId)));
  await batch.commit();
}
