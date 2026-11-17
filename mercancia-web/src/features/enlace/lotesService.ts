// ============================================================
// Lotes de envío desde el teléfono (enlace de armar)
// ============================================================
//
// Todo con la sesión del enlace (`SesionEnlace.db`), nunca con el `db` de
// la sesión de PIN. Las reglas (`firestore.rules`, bloque de resurtidos con
// `esEnlace`) son estrictas: cada escritura lleva exactamente los campos que
// permiten. Contrato de referencia: `rules-test/lotes.test.mjs`.
//
// Cada paso se guarda al momento y en una transacción que primero lee el
// lote: así se revisa contra lo último guardado (otra pestaña, admin que lo
// regresó…) y, sin internet, la transacción FALLA en vez de quedar en cola
// como haría un `updateDoc` (con caché en memoria quedaría esperando y
// la pantalla no sabría si se guardó). Cada función devuelve el lote como
// quedó, para pintar la pantalla sin volver a leerlo.

import {
  collection,
  deleteField,
  doc,
  getDocFromServer,
  getDocsFromServer,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type Transaction,
} from "firebase/firestore";
import {
  LOTE_MAX_CAJAS,
  LOTE_MAX_PAQUETES,
  LoteConProblemas,
  contenidoDePaquete,
  esCodigoEtiquetaLote,
  etiquetaLoteLegible,
  fechaISO_MX,
  folioLote,
  generarID,
  llaveCajaLote,
  llavePaqueteLote,
  paquetesDeCaja,
  paths,
  siguienteOrden,
  sueltasDeCaja,
  validarLote,
  ymdPaddedMX,
  type LoteCaja,
  type LoteContenido,
  type LotePaquete,
  type LoteSuelta,
  type Resurtido,
} from "@shared";
import {
  ErrorEnlace,
  ahoraServidor,
  esPermisoDenegado,
  exigirInternet,
  type SesionEnlace,
} from "@/firebase/enlaceApp";

/** Lote leído (el id del documento es su código). */
export type Lote = Resurtido & { cajas: Record<string, LoteCaja> };

const MAX_PIEZAS_RENGLON = 100_000;

/** Lo que el teléfono todavía puede cambiar: creando y sin `listo`. */
export function seArma(l: Pick<Resurtido, "estado" | "listo">): boolean {
  return l.estado === "creando" && l.listo !== true;
}

function refLote(s: SesionEnlace, loteId: string) {
  return doc(s.db, paths.resurtido(s.negocioId, loteId));
}

function refEtiqueta(s: SesionEnlace, codigo: string) {
  return doc(s.db, paths.etiquetaLote(s.negocioId, codigo));
}

/** Lee el lote dentro de la transacción y comprueba que se pueda editar. */
async function leerLoteEditable(
  tx: Transaction,
  s: SesionEnlace,
  loteId: string,
): Promise<Lote> {
  const snap = await tx.get(refLote(s, loteId));
  if (!snap.exists()) throw new ErrorEnlace("Este lote ya no existe.");
  const l = snap.data() as Lote;
  if (!seArma(l)) {
    throw new ErrorEnlace(
      l.estado === "creando"
        ? "Este lote ya está listo y no se puede cambiar. Si hay que corregirlo, pide al administrador que lo regrese."
        : "Este lote ya se envió: ya no se puede cambiar.",
    );
  }
  return { ...l, cajas: l.cajas ?? {} };
}

/** Corre una escritura con la sesión del enlace. */
async function escribir<T>(
  s: SesionEnlace,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  exigirInternet();
  return runTransaction(s.db, fn);
}

// ---------- Leer ----------

/** Lotes de este acceso, más nuevos primero. La regla exige el filtro por
 *  `enlaceId` (sin él la lista se rechaza). Se lee del servidor: con caché en
 *  memoria y sin red, `getDocs` devolvería una lista vacía como si nada. */
export async function listarMisLotes(s: SesionEnlace): Promise<Lote[]> {
  const snap = await getDocsFromServer(
    query(
      collection(s.db, paths.resurtidosCol(s.negocioId)),
      where("enlaceId", "==", s.enlaceId),
    ),
  );
  const lotes = snap.docs.map((d) => {
    const l = d.data() as Lote;
    return { ...l, id: l.id || d.id, cajas: l.cajas ?? {} };
  });
  lotes.sort(
    (a, b) =>
      (b.fechaCreacion ?? "").localeCompare(a.fechaCreacion ?? "") ||
      b.id.localeCompare(a.id),
  );
  return lotes;
}

/** Un lote por su código. `null` si no existe. */
export async function leerLote(s: SesionEnlace, loteId: string): Promise<Lote | null> {
  // Sin listeners y sin caché vieja: se lee una vez, del servidor.
  const snap = await getDocFromServer(refLote(s, loteId));
  if (!snap.exists()) return null;
  const l = snap.data() as Lote;
  return { ...l, id: l.id || snap.id, cajas: l.cajas ?? {} };
}

// ---------- Crear y borrar ----------

/** Número del lote de hoy en un código `L261116-A3` → 3. */
function numeroDeHoy(folio: string, prefijo: string): number | null {
  if (!folio.startsWith(prefijo)) return null;
  const n = Number(folio.slice(prefijo.length));
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Lote nuevo. Su código (`L261116-A1`) es también el id del documento: se
 * prueba el siguiente número libre del día y, si ya existe (o es de otro
 * acceso y no se puede ni leer), el que sigue. Los campos son EXACTAMENTE
 * los que permite la regla de creación.
 */
export async function crearLote(
  s: SesionEnlace,
  destino: { sucursalDestinoId: string; sucursalDestinoNombre: string },
  misLotes?: readonly Pick<Resurtido, "id" | "folio">[],
): Promise<Lote> {
  if (!s.letra) throw new ErrorEnlace("Este acceso no sirve para armar lotes.");
  exigirInternet();
  const hoy = ahoraServidor(s);
  const ymd = ymdPaddedMX(hoy);
  const prefijo = folioLote(ymd, s.letra, 1).slice(0, -1);
  const lista = misLotes ?? (await listarMisLotes(s));
  // Se empieza después del mayor de hoy (no del conteo): si se borró uno,
  // no se vuelve a probar un número ocupado.
  let n = 1;
  for (const l of lista) {
    const k = numeroDeHoy(l.folio ?? l.id, prefijo);
    if (k !== null && k >= n) n = k + 1;
  }

  let ultimoError: unknown = null;
  for (let intento = 0; intento < 20 && n <= 999; intento++, n++) {
    const id = folioLote(ymd, s.letra, n);
    const ref = refLote(s, id);
    try {
      const creado = await runTransaction(s.db, async (tx) => {
        const snap = await tx.get(ref);
        if (snap.exists()) return null;
        const lote: Lote = {
          id,
          folio: id,
          estado: "creando",
          enlaceId: s.enlaceId,
          creadoPorUid: s.uid,
          sucursalDestinoId: destino.sucursalDestinoId,
          sucursalDestinoNombre: destino.sucursalDestinoNombre,
          fechaCreacion: fechaISO_MX(hoy),
          responsableEmpaco: s.nombre || "Enlace",
          lineas: [],
          cajas: {},
        };
        tx.set(ref, lote);
        return lote;
      });
      if (creado) return creado;
    } catch (e) {
      // Permiso denegado al LEER = ese código es de otro acceso: el siguiente.
      if (!esPermisoDenegado(e)) throw e;
      ultimoError = e;
    }
  }
  // Si todo fue "sin permiso", lo más seguro es que el acceso esté apagado.
  if (ultimoError) throw ultimoError;
  throw new ErrorEnlace("No se encontró un código libre para el lote. Intenta mañana o pide ayuda.");
}

/** Borra un lote que se está armando. Sus etiquetas quedan apartadas para
 *  ese código (solo admin las libera). */
export async function borrarLote(s: SesionEnlace, loteId: string): Promise<void> {
  await escribir(s, async (tx) => {
    await leerLoteEditable(tx, s, loteId);
    tx.delete(refLote(s, loteId));
  });
}

export async function cambiarDestino(
  s: SesionEnlace,
  loteId: string,
  destino: { sucursalDestinoId: string; sucursalDestinoNombre: string },
): Promise<Lote> {
  return escribir(s, async (tx) => {
    const lote = await leerLoteEditable(tx, s, loteId);
    tx.update(refLote(s, loteId), {
      sucursalDestinoId: destino.sucursalDestinoId,
      sucursalDestinoNombre: destino.sucursalDestinoNombre,
    });
    return { ...lote, ...destino };
  });
}

// ---------- Etiquetas ----------

/** Dónde está ya una etiqueta dentro del lote, o `null`. */
export function usoDeEtiquetaEnLote(lote: Lote, codigo: string): string | null {
  const caja = lote.cajas[llaveCajaLote(codigo)];
  if (caja) return `Esa etiqueta ya es la caja ${caja.orden} de este lote.`;
  if (lote.paquetes?.[llavePaqueteLote(codigo)]) {
    return "Esa etiqueta ya es un paquete de este lote.";
  }
  return null;
}

/** El código de una etiqueta como se guarda: sin espacios ni guiones (se
 *  puede teclear como se lee, `8800 0000 0011`). */
export function limpiarCodigoEtiqueta(codigo: string): string {
  return codigo.replace(/[\s-]/g, "");
}

function exigirCodigo(codigo: string): string {
  const c = limpiarCodigoEtiqueta(codigo);
  if (!esCodigoEtiquetaLote(c)) {
    throw new ErrorEnlace(
      "Ese código no es de una etiqueta de caja o paquete (son 12 números que empiezan con 88).",
    );
  }
  return c;
}

/**
 * Revisa ANTES de capturar nada si una etiqueta se puede usar en este lote.
 * Devuelve el problema o `null`. (Al guardar se vuelve a revisar en la
 * transacción: esto solo evita capturar un paquete para nada.)
 */
export async function revisarEtiqueta(
  s: SesionEnlace,
  lote: Lote,
  codigo: string,
): Promise<string | null> {
  const c = limpiarCodigoEtiqueta(codigo);
  if (!esCodigoEtiquetaLote(c)) {
    return "Ese código no es de una etiqueta de caja o paquete (son 12 números que empiezan con 88).";
  }
  const aqui = usoDeEtiquetaEnLote(lote, c);
  if (aqui) return aqui;
  const snap = await getDocFromServer(refEtiqueta(s, c));
  const usadaEn = snap.exists() ? String(snap.data().resurtidoId ?? "") : "";
  if (usadaEn && usadaEn !== lote.id) {
    return `Esa etiqueta ya se usó en el lote ${usadaEn}: toma otra.`;
  }
  return null;
}

/**
 * Aparta la etiqueta para este lote dentro de la transacción. Si ya estaba
 * apartada para ESTE lote (se quitó y se vuelve a poner) no se reescribe:
 * la regla no deja actualizarla.
 */
async function apartarEtiqueta(
  tx: Transaction,
  s: SesionEnlace,
  loteId: string,
  codigo: string,
): Promise<() => void> {
  const ref = refEtiqueta(s, codigo);
  const snap = await tx.get(ref);
  if (snap.exists()) {
    const usadaEn = String(snap.data().resurtidoId ?? "");
    if (usadaEn !== loteId) {
      throw new ErrorEnlace(`Esa etiqueta ya se usó en el lote ${usadaEn}: toma otra.`);
    }
    return () => undefined;
  }
  // La escritura se hace después de leer el lote (en una transacción todas
  // las lecturas van antes que las escrituras).
  return () =>
    tx.set(ref, { resurtidoId: loteId, enlaceId: s.enlaceId, creadoEn: serverTimestamp() });
}

// ---------- Cajas ----------

export async function agregarCaja(
  s: SesionEnlace,
  loteId: string,
  codigoCrudo: string,
): Promise<Lote> {
  const codigo = exigirCodigo(codigoCrudo);
  return escribir(s, async (tx) => {
    const escribirEtiqueta = await apartarEtiqueta(tx, s, loteId, codigo);
    const lote = await leerLoteEditable(tx, s, loteId);
    const repetida = usoDeEtiquetaEnLote(lote, codigo);
    if (repetida) throw new ErrorEnlace(repetida);
    if (Object.keys(lote.cajas).length >= LOTE_MAX_CAJAS) {
      throw new ErrorEnlace(`Máximo ${LOTE_MAX_CAJAS} cajas por lote: empieza otro lote.`);
    }
    const llave = llaveCajaLote(codigo);
    const caja: LoteCaja = { codigo, orden: siguienteOrden(lote.cajas) };
    escribirEtiqueta();
    tx.update(refLote(s, loteId), { [`cajas.${llave}`]: caja });
    return { ...lote, cajas: { ...lote.cajas, [llave]: caja } };
  });
}

/**
 * Quita una caja con todo lo que trae (paquetes y sueltas) en una sola
 * escritura, y vuelve a numerar las demás (1, 2, 3…): la caja que recibe
 * dice "Caja 2 de 3" con ese número.
 */
export async function quitarCaja(
  s: SesionEnlace,
  loteId: string,
  llaveCaja: string,
): Promise<Lote> {
  return escribir(s, async (tx) => {
    const lote = await leerLoteEditable(tx, s, loteId);
    if (!lote.cajas[llaveCaja]) return lote;
    const restantes = Object.entries(lote.cajas)
      .filter(([k]) => k !== llaveCaja)
      .sort(([ka, a], [kb, b]) => a.orden - b.orden || ka.localeCompare(kb));
    const cajas: Record<string, LoteCaja> = {};
    restantes.forEach(([k, c], i) => {
      cajas[k] = { codigo: c.codigo, orden: i + 1 };
    });
    const cambios: Record<string, unknown> = { cajas };
    const paquetes = { ...(lote.paquetes ?? {}) };
    const sueltas = { ...(lote.sueltas ?? {}) };
    for (const [k, p] of Object.entries(lote.paquetes ?? {})) {
      if (p.caja === llaveCaja) {
        cambios[`paquetes.${k}`] = deleteField();
        delete paquetes[k];
      }
    }
    for (const [k, x] of Object.entries(lote.sueltas ?? {})) {
      if (x.caja === llaveCaja) {
        cambios[`sueltas.${k}`] = deleteField();
        delete sueltas[k];
      }
    }
    tx.update(refLote(s, loteId), cambios);
    return { ...lote, cajas, paquetes, sueltas };
  });
}

// ---------- Paquetes ----------

/** Renglones limpios: piezas enteras ≥ 1, sin variación vacía, y el mismo
 *  artículo junto en un solo renglón. */
export function limpiarContenido(contenido: readonly LoteContenido[]): LoteContenido[] {
  const junto = new Map<string, LoteContenido>();
  for (const r of contenido) {
    const piezas = Number(r.piezas);
    if (!r.articuloId || !Number.isInteger(piezas) || piezas < 1) {
      throw new ErrorEnlace("Cada artículo necesita sus piezas (un número entero de 1 en adelante).");
    }
    if (piezas > MAX_PIEZAS_RENGLON) {
      throw new ErrorEnlace(`Máximo ${MAX_PIEZAS_RENGLON} piezas por artículo.`);
    }
    const sub = r.subvariacionCodigo || undefined;
    const clave = sub ? `${r.articuloId}|${sub}` : r.articuloId;
    const ya = junto.get(clave);
    if (ya) ya.piezas += piezas;
    else junto.set(clave, { articuloId: r.articuloId, ...(sub ? { subvariacionCodigo: sub } : {}), piezas });
  }
  const lista = [...junto.values()];
  if (lista.length === 0) throw new ErrorEnlace("El paquete está vacío: agrega al menos un artículo.");
  return lista;
}

export async function guardarPaquete(
  s: SesionEnlace,
  loteId: string,
  datos: { codigo: string; caja: string; contenido: readonly LoteContenido[] },
): Promise<Lote> {
  const codigo = exigirCodigo(datos.codigo);
  const contenido = limpiarContenido(datos.contenido);
  return escribir(s, async (tx) => {
    const escribirEtiqueta = await apartarEtiqueta(tx, s, loteId, codigo);
    const lote = await leerLoteEditable(tx, s, loteId);
    if (!lote.cajas[datos.caja]) throw new ErrorEnlace("Esa caja ya no está en el lote.");
    const repetida = usoDeEtiquetaEnLote(lote, codigo);
    if (repetida) throw new ErrorEnlace(repetida);
    if (Object.keys(lote.paquetes ?? {}).length >= LOTE_MAX_PAQUETES) {
      throw new ErrorEnlace(`Máximo ${LOTE_MAX_PAQUETES} paquetes por lote: empieza otro lote.`);
    }
    const llave = llavePaqueteLote(codigo);
    const paquete: LotePaquete = {
      codigo,
      caja: datos.caja,
      contenido,
      orden: siguienteOrden(lote.paquetes),
    };
    escribirEtiqueta();
    tx.update(refLote(s, loteId), { [`paquetes.${llave}`]: paquete });
    return { ...lote, paquetes: { ...(lote.paquetes ?? {}), [llave]: paquete } };
  });
}

/** Corrige lo que trae un paquete (la etiqueta y la caja no cambian). */
export async function editarPaquete(
  s: SesionEnlace,
  loteId: string,
  llave: string,
  contenidoNuevo: readonly LoteContenido[],
): Promise<Lote> {
  const contenido = limpiarContenido(contenidoNuevo);
  return escribir(s, async (tx) => {
    const lote = await leerLoteEditable(tx, s, loteId);
    const actual = lote.paquetes?.[llave];
    if (!actual) throw new ErrorEnlace("Ese paquete ya no está en el lote.");
    const paquete: LotePaquete = { ...actual, contenido };
    tx.update(refLote(s, loteId), { [`paquetes.${llave}`]: paquete });
    return { ...lote, paquetes: { ...(lote.paquetes ?? {}), [llave]: paquete } };
  });
}

/** Quita un paquete. Su etiqueta queda apartada para ESTE lote: se puede
 *  volver a usar aquí, pero no en otro. */
export async function quitarPaquete(
  s: SesionEnlace,
  loteId: string,
  llave: string,
): Promise<Lote> {
  return escribir(s, async (tx) => {
    const lote = await leerLoteEditable(tx, s, loteId);
    if (!lote.paquetes?.[llave]) return lote;
    tx.update(refLote(s, loteId), { [`paquetes.${llave}`]: deleteField() });
    const paquetes = { ...lote.paquetes };
    delete paquetes[llave];
    return { ...lote, paquetes };
  });
}

// ---------- Piezas sueltas ----------

/** Guarda piezas sueltas (sin etiqueta). `llave` null = nuevas. */
export async function guardarSuelta(
  s: SesionEnlace,
  loteId: string,
  llave: string | null,
  datos: { caja: string; articuloId: string; subvariacionCodigo?: string; piezas: number },
): Promise<Lote> {
  const [renglon] = limpiarContenido([datos]);
  return escribir(s, async (tx) => {
    const lote = await leerLoteEditable(tx, s, loteId);
    if (!lote.cajas[datos.caja]) throw new ErrorEnlace("Esa caja ya no está en el lote.");
    const k = llave ?? `s${generarID()}`;
    const actual = llave ? lote.sueltas?.[llave] : undefined;
    if (llave && !actual) throw new ErrorEnlace("Esas piezas ya no están en el lote.");
    if (!llave && Object.keys(lote.sueltas ?? {}).length >= 999) {
      throw new ErrorEnlace("Demasiadas piezas sueltas en este lote: usa paquetes.");
    }
    const suelta: LoteSuelta = {
      caja: datos.caja,
      ...renglon!,
      orden: actual?.orden ?? siguienteOrden(lote.sueltas),
    };
    tx.update(refLote(s, loteId), { [`sueltas.${k}`]: suelta });
    return { ...lote, sueltas: { ...(lote.sueltas ?? {}), [k]: suelta } };
  });
}

export async function quitarSuelta(
  s: SesionEnlace,
  loteId: string,
  llave: string,
): Promise<Lote> {
  return escribir(s, async (tx) => {
    const lote = await leerLoteEditable(tx, s, loteId);
    if (!lote.sueltas?.[llave]) return lote;
    tx.update(refLote(s, loteId), { [`sueltas.${llave}`]: deleteField() });
    const sueltas = { ...lote.sueltas };
    delete sueltas[llave];
    return { ...lote, sueltas };
  });
}

// ---------- Listo ----------

/**
 * Termina de armar: el lote queda esperando a que admin confirme el envío.
 * Antes se corre `validarLote` (lanza `LoteConProblemas` con TODO lo que
 * falta). Después de esto el teléfono ya no lo puede editar.
 */
export async function marcarLoteListo(
  s: SesionEnlace,
  loteId: string,
  datos: { responsableEmpaco: string; paqueteria?: string; guias?: Record<string, string> },
): Promise<Lote> {
  const responsable = datos.responsableEmpaco.trim();
  if (!responsable) throw new ErrorEnlace("Escribe el nombre de quien armó el lote.");
  return escribir(s, async (tx) => {
    const lote = await leerLoteEditable(tx, s, loteId);
    const problemas = validarLote(lote);
    if (problemas.length > 0) throw new LoteConProblemas(problemas);
    const guias: Record<string, string> = {};
    for (const [k, g] of Object.entries(datos.guias ?? {})) {
      const t = g.trim();
      if (t && lote.cajas[k]) guias[k] = t.slice(0, 80);
    }
    const paqueteria = datos.paqueteria?.trim().slice(0, 80);
    const cambios = {
      listo: true,
      fechaListo: fechaISO_MX(ahoraServidor(s)),
      responsableEmpaco: responsable.slice(0, 80),
      ...(paqueteria ? { paqueteria } : {}),
      ...(Object.keys(guias).length > 0 ? { guias } : {}),
    };
    tx.update(refLote(s, loteId), cambios);
    return { ...lote, ...cambios };
  });
}

/** Para mostrar un código de etiqueta: `8800 0000 0011`. */
export const legible = etiquetaLoteLegible;

/** Cuántos paquetes, sueltas y piezas trae una caja. */
export function totalesCaja(
  lote: Lote,
  llaveCaja: string,
): { paquetes: number; sueltas: number; piezas: number } {
  const paquetes = paquetesDeCaja(lote, llaveCaja);
  const sueltas = sueltasDeCaja(lote, llaveCaja);
  let piezas = 0;
  for (const { paquete } of paquetes) {
    for (const n of contenidoDePaquete(paquete).values()) piezas += n;
  }
  for (const { suelta } of sueltas) piezas += Number(suelta.piezas) || 0;
  return { paquetes: paquetes.length, sueltas: sueltas.length, piezas };
}
