import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentReference,
} from "firebase/firestore";
import { deleteObject, ref as storageRef } from "firebase/storage";
import { auth, db, storage } from "@/firebase/config";
import { marcarHuellaArticulos } from "@/features/fabricacion/produccionService";
import {
  COL_ETIQUETAS_LOTE,
  DOC_CONTADOR_ETIQUETAS_LOTE,
  LoteConProblemas,
  URL_MERCANCIA_PRODUCCION,
  declaradoPorArticulo,
  esLote,
  fechaISO_MX,
  generarID,
  generarSecretoEnlace,
  hashSecretoEnlace,
  partirClaveArticulo,
  paths,
  planearEnvioLote,
  planearNoLlegoLote,
  siguienteLetraEnlace,
  urlEnlaceLote,
  validarLote,
  type Articulo,
  type EnlaceLote,
  type Resurtido,
} from "@shared";

// ============================================================
// Lotes de envío — lo que hace admin
// ============================================================
//
// Un lote lo arma un teléfono con un enlace; aquí admin lo confirma (baja
// el taller), corrige paquetería y guías, declara lo que no llegó y maneja
// los accesos por URL. Todo lo que mueve inventario va en UNA transacción
// que vuelve a leer el lote: dos pestañas de admin no pueden enviar el mismo
// lote dos veces.

/** Origen de mercancia-web, donde vive la pantalla del teléfono. `||` y no
 *  `??`: una variable vacía en el `.env` dejaría la URL sin dominio. */
const BASE_MERCANCIA: string =
  (import.meta.env.VITE_URL_MERCANCIA as string | undefined) || URL_MERCANCIA_PRODUCCION;

/** Writes por lote de `writeBatch` (el tope de Firestore es 500). */
const TAMANO_BATCH = 400;

function refLote(negocioId: string, loteId: string) {
  return doc(db, paths.resurtido(negocioId, loteId));
}

function leerLote(data: unknown): Resurtido & { cajas: NonNullable<Resurtido["cajas"]> } {
  const lote = data as Resurtido;
  if (!esLote(lote)) throw new Error("Esto no es un lote de envío");
  return lote;
}

// ---------- Confirmar el envío ----------

/**
 * Confirma el envío de un lote listo: vuelve a validar TODO el lote (lo
 * armó un enlace, no es de confianza), baja del taller lo declarado, escribe
 * la lista plana y lo pasa a `enviado`. Si algo falla lanza
 * `LoteConProblemas` con todos los problemas para que la pantalla los liste.
 */
export async function confirmarEnvioLote(
  negocioId: string,
  loteId: string,
  enviadoPor: string,
): Promise<void> {
  if (!enviadoPor.trim()) throw new Error("Falta quién confirma el envío");
  const loteRef = refLote(negocioId, loteId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(loteRef);
    if (!snap.exists()) throw new Error("El lote ya no existe");
    const lote = leerLote(snap.data());
    if (lote.estado !== "creando") throw new Error("Este lote ya se envió");
    if (lote.listo !== true) {
      throw new Error("Todavía lo están armando: espera a que lo marquen como listo");
    }
    // Validar antes de leer artículos: un lote mal armado puede traer cientos
    // de ids y no tiene caso leerlos para luego rechazarlo.
    const invalido = validarLote(lote);
    if (invalido.length > 0) throw new LoteConProblemas(invalido);

    const ids = [
      ...new Set([...declaradoPorArticulo(lote).keys()].map((c) => partirClaveArticulo(c).articuloId)),
    ];
    // Un id con "/" apuntaría a otra ruta de Firestore: viene de un enlace.
    const raros = ids.filter((id) => id.includes("/"));
    if (raros.length > 0) {
      throw new LoteConProblemas(raros.map((id) => `El artículo "${id}" no es válido`));
    }
    const refs = new Map<string, DocumentReference>(
      ids.map((id) => [id, doc(db, paths.articulo(negocioId, id))]),
    );
    const snaps = await Promise.all(ids.map((id) => tx.get(refs.get(id)!)));
    const articulos = new Map<string, Articulo>();
    snaps.forEach((s, i) => {
      if (s.exists()) articulos.set(ids[i]!, s.data() as Articulo);
    });

    // Lanza LoteConProblemas (artículos borrados, piezas que no hay…).
    const plan = planearEnvioLote(lote, articulos);
    for (const [id, parche] of plan.parches) tx.update(refs.get(id)!, parche);
    tx.update(loteRef, {
      estado: "enviado",
      lineas: plan.lineas,
      fechaEnTransito: fechaISO_MX(),
      enviadoPor: enviadoPor.trim(),
    });
  });
  await marcarHuellaArticulos(negocioId);
}

/** Lo regresa al teléfono para que lo sigan armando. */
export async function regresarLoteAArmado(negocioId: string, loteId: string): Promise<void> {
  const loteRef = refLote(negocioId, loteId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(loteRef);
    if (!snap.exists()) throw new Error("El lote ya no existe");
    const lote = leerLote(snap.data());
    if (lote.estado !== "creando") throw new Error("Este lote ya se envió");
    tx.update(loteRef, { listo: false });
  });
}

// ---------- "No llegó" ----------

/**
 * Declara como no llegado todo lo pendiente y cierra el lote. Es una sesión
 * más (no se borra nada de lo recibido), así queda en el historial.
 */
export async function declararNoLlegoLote(
  negocioId: string,
  loteId: string,
  quien: string,
  nota?: string,
): Promise<void> {
  const loteRef = refLote(negocioId, loteId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(loteRef);
    if (!snap.exists()) throw new Error("El lote ya no existe");
    const lote = leerLote(snap.data());
    const fecha = fechaISO_MX();
    const plan = planearNoLlegoLote(lote, { fecha, quien, nota });
    tx.update(loteRef, {
      estado: plan.estado,
      fechaCerrado: fecha,
      responsableConfirma: plan.sesion.quien,
      [`recepcion.sesiones.s${generarID()}`]: plan.sesion,
    });
  });
}

// ---------- Paquetería y guías ----------

/** Paquetería y guía de cada caja (por llave de caja). Se puede corregir
 *  en cualquier estado: las reglas lo permiten aun con el lote enviado. */
export async function guardarEnvioLote(
  negocioId: string,
  loteId: string,
  datos: { paqueteria: string; guias: Record<string, string> },
): Promise<void> {
  const paqueteria = datos.paqueteria.trim();
  const guias: Record<string, string> = {};
  for (const [llave, guia] of Object.entries(datos.guias)) {
    if (guia.trim()) guias[llave] = guia.trim();
  }
  await updateDoc(refLote(negocioId, loteId), {
    paqueteria: paqueteria || deleteField(),
    guias,
  });
}

// ---------- Borrar un lote que se está armando ----------

/**
 * Borra un lote que no se ha enviado y libera sus etiquetas para que se
 * puedan usar en otro. Un lote enviado ya no se borra (las reglas tampoco
 * lo dejan): su stock ya salió del taller.
 */
export async function borrarLoteArmandose(negocioId: string, loteId: string): Promise<void> {
  const loteRef = refLote(negocioId, loteId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(loteRef);
    if (!snap.exists()) return;
    const lote = leerLote(snap.data());
    if (lote.estado !== "creando") throw new Error("Un lote enviado no se puede borrar");
    tx.delete(loteRef);
  });
  // Fuera de la transacción (no puede consultar colecciones). Si falla, las
  // etiquetas quedan apartadas a un lote que ya no existe: solo se pierden
  // esas etiquetas, no hay nada que corregir en inventario.
  const etiquetas = await getDocs(
    query(
      collection(db, `${paths.negocio(negocioId)}/${COL_ETIQUETAS_LOTE}`),
      where("resurtidoId", "==", loteId),
    ),
  );
  const docs = etiquetas.docs;
  for (let i = 0; i < docs.length; i += TAMANO_BATCH) {
    const batch = writeBatch(db);
    for (const d of docs.slice(i, i + TAMANO_BATCH)) batch.delete(d.ref);
    await batch.commit();
  }
}

// ---------- Fotos ----------

/** Borra el registro de la foto (ya nadie la ve) y luego su archivo. */
export async function borrarFotoLote(
  negocioId: string,
  loteId: string,
  fotoId: string,
  ruta: string,
): Promise<void> {
  await deleteDoc(doc(db, paths.loteFoto(negocioId, loteId, fotoId)));
  try {
    await deleteObject(storageRef(storage, ruta));
  } catch (e) {
    // Sin el registro el archivo ya no se muestra en ningún lado.
    console.warn("No se pudo borrar el archivo de la foto:", e);
  }
}

// ---------- Accesos por enlace ----------

function enlacesCol(negocioId: string) {
  return collection(db, paths.enlacesLoteCol(negocioId));
}

function refEnlace(negocioId: string, enlaceId: string) {
  return doc(db, paths.enlaceLote(negocioId, enlaceId));
}

const MAX_NOMBRE_ENLACE = 60;

function limpiarNombre(nombre: string): string {
  const n = nombre.trim();
  if (!n) throw new Error("Ponle un nombre al acceso");
  if (n.length > MAX_NOMBRE_ENLACE) {
    throw new Error(`El nombre puede tener hasta ${MAX_NOMBRE_ENLACE} letras`);
  }
  return n;
}

/**
 * Crea un acceso para armar lotes. Devuelve la URL con el secreto: es la
 * ÚNICA vez que existe completa (solo se guarda su sha256), así que la
 * pantalla la debe mostrar en ese momento.
 */
export async function crearEnlaceArmar(
  negocioId: string,
  nombre: string,
  letrasUsadas: readonly string[],
): Promise<{ enlaceId: string; url: string }> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Vuelve a iniciar sesión");
  const limpio = limpiarNombre(nombre);
  const secreto = generarSecretoEnlace();
  const secretoHash = await hashSecretoEnlace(secreto);
  const ref = doc(enlacesCol(negocioId));
  // Las reglas exigen exactamente estos campos y valores.
  await setDoc(ref, {
    tipo: "armar",
    activo: true,
    gen: 0,
    nombre: limpio,
    letra: siguienteLetraEnlace(letrasUsadas),
    secretoHash,
    creadoPor: uid,
    creadoEn: serverTimestamp(),
  });
  return { enlaceId: ref.id, url: urlEnlaceLote(BASE_MERCANCIA, negocioId, ref.id, secreto) };
}

/**
 * Enlace nuevo para el mismo acceso (misma letra, mismos lotes): sube `gen`,
 * con eso las sesiones abiertas dejan de servir, y reinicia los canjes para
 * que pueda entrar otro teléfono.
 */
export async function renovarEnlace(
  negocioId: string,
  enlaceId: string,
): Promise<{ url: string }> {
  const secreto = generarSecretoEnlace();
  const secretoHash = await hashSecretoEnlace(secreto);
  const ref = refEnlace(negocioId, enlaceId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Ese acceso ya no existe");
    const e = snap.data() as EnlaceLote;
    if (e.tipo !== "armar") throw new Error("Solo se renuevan los accesos para armar");
    tx.update(ref, { secretoHash, gen: (Number(e.gen) || 0) + 1, canjes: 0 });
  });
  return { url: urlEnlaceLote(BASE_MERCANCIA, negocioId, enlaceId, secreto) };
}

/** El apagador: las reglas lo leen en cada operación del teléfono, así que
 *  apagarlo corta al instante. */
export async function prenderApagarEnlace(
  negocioId: string,
  enlaceId: string,
  activo: boolean,
): Promise<void> {
  await updateDoc(refEnlace(negocioId, enlaceId), { activo });
}

export async function renombrarEnlace(
  negocioId: string,
  enlaceId: string,
  nombre: string,
): Promise<void> {
  await updateDoc(refEnlace(negocioId, enlaceId), { nombre: limpiarNombre(nombre) });
}

/** Borra el acceso. Sus lotes se quedan; sus sesiones dejan de servir. */
export async function borrarEnlace(negocioId: string, enlaceId: string): Promise<void> {
  await deleteDoc(refEnlace(negocioId, enlaceId));
}

/** Apaga todos los accesos prendidos, de armar y de fotos. Devuelve cuántos. */
export async function apagarTodosLosEnlaces(negocioId: string): Promise<number> {
  const snap = await getDocs(query(enlacesCol(negocioId), where("activo", "==", true)));
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += TAMANO_BATCH) {
    const batch = writeBatch(db);
    for (const d of docs.slice(i, i + TAMANO_BATCH)) batch.update(d.ref, { activo: false });
    await batch.commit();
  }
  return docs.length;
}

// ---------- Etiquetas numeradas ----------

export const MAX_ETIQUETAS_POR_PDF = 3000;
const MAX_NUMERO_ETIQUETA = 9_999_999_999;

/**
 * Aparta `cantidad` números consecutivos del contador. Cada PDF lleva números
 * nuevos: así nunca hay dos etiquetas iguales, aunque se imprima en dos
 * computadoras a la vez. Si luego falla el PDF solo quedan números sin usar.
 */
export async function reservarEtiquetasLote(
  negocioId: string,
  cantidad: number,
): Promise<{ desde: number; hasta: number }> {
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAX_ETIQUETAS_POR_PDF) {
    throw new Error(`Indica de 1 a ${MAX_ETIQUETAS_POR_PDF} etiquetas`);
  }
  const contadorRef = doc(db, paths.dato(negocioId, DOC_CONTADOR_ETIQUETAS_LOTE));
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(contadorRef);
    const ultimo = snap.exists() ? Math.max(0, Math.floor(Number(snap.data().ultimo) || 0)) : 0;
    const desde = ultimo + 1;
    const hasta = ultimo + cantidad;
    if (hasta > MAX_NUMERO_ETIQUETA) throw new Error("Ya no quedan números de etiqueta");
    tx.set(contadorRef, { ultimo: hasta }, { merge: true });
    return { desde, hasta };
  });
}
