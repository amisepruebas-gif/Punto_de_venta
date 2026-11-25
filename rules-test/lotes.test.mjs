// Pruebas de las reglas de LOTES de envío, enlaces, etiquetas y fotos
// (../firestore.rules.candidata, igual a ../firestore.rules).
//
// Correr (desde rules-test/):
//   npx firebase emulators:exec --project demo-test --only firestore "node test.mjs && node lotes.test.mjs"
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { readFileSync } from "node:fs";

const RULES = readFileSync(new URL("../firestore.rules.candidata", import.meta.url), "utf8");
const NID = "amise", S1 = "suc1", S2 = "suc2";
const LEJOS = 4102444800000; // año 2100: los enlaces de armar no vencen
const MIN30 = Date.now() + 30 * 60_000;

const env = await initializeTestEnvironment({
  projectId: "demo-test",
  firestore: { rules: RULES, host: "127.0.0.1", port: 8155 },
});

// El emulador puede traer datos de test.mjs: se empieza en limpio.
await env.clearFirestore();

const ctx = (uid, claims) => env.authenticatedContext(uid, claims).firestore();
const anon = env.unauthenticatedContext().firestore();
const admin = ctx("a1", { role: "admin", negocioId: NID });
const supera = ctx("sa", { role: "superadmin" });
const merc = ctx("m1", { role: "mercancia", negocioId: NID, sucursalId: S1, mercanciaUid: "m1" });
const nodo1 = ctx("n1", { role: "nodo", negocioId: NID, sucursalId: S1, nodoId: "n1" });
const nodo2 = ctx("n2", { role: "nodo", negocioId: NID, sucursalId: S2, nodoId: "n2" });
const enlace = (enlaceId, extra = {}) => ({
  role: "enlace", negocioId: NID, enlaceId, tipo: "armar", gen: 0, letra: "A", vence: LEJOS, ...extra,
});
const UID_A = "enl_E1_aaaa";
const armar = ctx(UID_A, enlace("E1"));
const armarB = ctx("enl_E2_bbbb", enlace("E2", { letra: "B" }));
const armarApagado = ctx("enl_EOFF_x", enlace("EOFF"));
const armarGenViejo = ctx("enl_EGEN_x", enlace("EGEN"));
const armarVencido = ctx("enl_E1_venc", enlace("E1", { vence: 1 }));
const armarSinDoc = ctx("enl_NADA_x", enlace("NADA"));
const armarOtroNeg = ctx("enl_E1_otro", { ...enlace("E1"), negocioId: "OTRO" });
const UID_F = "enl_F1_ffff";
const fotos = (enlaceId, extra = {}) => ({
  role: "enlace", negocioId: NID, enlaceId, tipo: "recibir", gen: 0,
  resurtidoId: "L261116-A2", sucursalId: S1, vence: MIN30, ...extra,
});
const recibir = ctx(UID_F, fotos("F1"));
const recibirApagado = ctx("enl_FOFF_x", fotos("FOFF"));
const recibirVencido = ctx("enl_F1_venc", fotos("F1", { vence: Date.now() - 1000 }));

const N = `negocios_web_new_version/${NID}`;
const lote = (id) => `${N}/resurtidos_web_new_version/${id}`;
const COL_LOTES = `${N}/resurtidos_web_new_version`;
const enl = (id) => `${N}/enlaces_lote_web_new_version/${id}`;
const etiqueta = (c) => `${N}/etiquetas_lote_web_new_version/${c}`;
const foto = (rid, fid) => `${lote(rid)}/fotos_web_new_version/${fid}`;
const art = (id) => `${N}/articulos_n_web_new_version/${id}`;
const dato = (k) => `${N}/datos_web_new_version/${k}`;
const HASH = "a".repeat(64);

const CAJA = { c880000000001: { codigo: "880000000001", orden: 1 } };
const PAQ = {
  p880000000011: { codigo: "880000000011", caja: "c880000000001", orden: 1, contenido: [{ articuloId: "ARTF", piezas: 12 }] },
};
const borrador = (id, enlaceId, uid, extra = {}) => ({
  id, folio: id, estado: "creando", enlaceId, creadoPorUid: uid,
  sucursalDestinoId: S1, sucursalDestinoNombre: "Suc 1",
  fechaCreacion: "2026-11-16 10:00:00", responsableEmpaco: "Taller",
  lineas: [], cajas: {}, ...extra,
});
const enviado = (id, sucursalId, extra = {}) => ({
  ...borrador(id, "E1", UID_A),
  estado: "enviado", listo: true, sucursalDestinoId: sucursalId, cajas: CAJA, paquetes: PAQ,
  lineas: [{ articuloId: "ARTF", nombreSnapshot: "Llavero", cantidadEnviada: 12 }],
  ...extra,
});
const SESION = { tipo: "recepcion", fecha: "2026-11-18 12:00:00", quien: "Ana", paquetes: ["p880000000011"] };

await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  const e = (extra) => ({ tipo: "armar", activo: true, gen: 0, letra: "A", secretoHash: HASH, creadoPor: "a1", ...extra });
  // El registro de la sesión `merc` (uid m1): las reglas lo leen en vivo.
  await setDoc(doc(db, `${N}/sucursales_data_web_new_version/${S1}/usuariosMercancia_web_new_version/m1`), { nombre: "Merc", pinHash: HASH, habilitado: true });
  await setDoc(doc(db, enl("E1")), e({}));
  await setDoc(doc(db, enl("E2")), e({ letra: "B" }));
  await setDoc(doc(db, enl("EOFF")), e({ activo: false }));
  await setDoc(doc(db, enl("EGEN")), e({ gen: 1 }));
  await setDoc(doc(db, enl("F1")), e({ tipo: "recibir", creadoPor: "n1", sucursalId: S1, resurtidoId: "L261116-A2" }));
  await setDoc(doc(db, enl("FOFF")), e({ tipo: "recibir", activo: false, creadoPor: "n1", sucursalId: S1, resurtidoId: "L261116-A2" }));
  await setDoc(doc(db, enl("FNODO2")), e({ tipo: "recibir", creadoPor: "n2", sucursalId: S2, resurtidoId: "L261116-A4" }));
  await setDoc(doc(db, lote("L261116-A1")), borrador("L261116-A1", "E1", UID_A));
  await setDoc(doc(db, lote("L261116-A2")), enviado("L261116-A2", S1));
  await setDoc(doc(db, lote("L261116-A3")), borrador("L261116-A3", "E1", UID_A, { listo: true, cajas: CAJA, paquetes: PAQ }));
  await setDoc(doc(db, lote("L261116-A4")), enviado("L261116-A4", S2));
  await setDoc(doc(db, lote("L261116-A5")), borrador("L261116-A5", "E1", UID_A));
  await setDoc(doc(db, lote("L261116-A6")), enviado("L261116-A6", S1, {
    estado: "parcial", recepcion: { sesiones: { s1: SESION } },
  }));
  await setDoc(doc(db, lote("L261116-A7")), borrador("L261116-A7", "E1", UID_A));
  await setDoc(doc(db, lote("L261116-A8")), enviado("L261116-A8", S1));
  await setDoc(doc(db, lote("L261116-B1")), borrador("L261116-B1", "E2", "enl_E2_bbbb"));
  // Cerrado con "no llegó": todavía puede recibir lo que aparezca.
  await setDoc(doc(db, lote("L261116-A30")), enviado("L261116-A30", S1, {
    estado: "cerrado", fechaCerrado: "2026-11-20 10:00:00",
    recepcion: { sesiones: { n1: { tipo: "no_llego", fecha: "2026-11-20 10:00:00", quien: "a@x.com", noLlego: { ARTF: 12 } } } },
  }));
  const simple = (estado, sucursalId) => ({
    id: "x", estado, sucursalDestinoId: sucursalId, sucursalDestinoNombre: "Suc",
    fechaCreacion: "2026-11-16 10:00:00", responsableEmpaco: "Bodega",
    lineas: [{ articuloId: "ART1", nombreSnapshot: "X", cantidadEnviada: 3 }],
  });
  await setDoc(doc(db, lote("R_S1")), simple("en_transito", S1));
  await setDoc(doc(db, lote("R_S1B")), simple("en_transito", S1));
  await setDoc(doc(db, lote("R_S2")), simple("en_transito", S2));
  await setDoc(doc(db, lote("R_REC")), simple("recibido", S1));
  await setDoc(doc(db, lote("R_CRE")), simple("creando", S1));
  await setDoc(doc(db, art("ART1")), { nombre: "X", cantidad: "10" });
  await setDoc(doc(db, art("ARTF")), { nombre: "Llavero", cantidad: "0", fabricado: true });
  await setDoc(doc(db, art("ARTB")), { nombre: "Viejo del taller", cantidad: "0", cantidadBodega: "5" });
  await setDoc(doc(db, art("ARTB0")), { nombre: "Sin piezas en el taller", cantidad: "3", cantidadBodega: "0" });
  await setDoc(doc(db, art("ARTBX")), { nombre: "Bodega rara", cantidad: "3", cantidadBodega: "abc" });
  await setDoc(doc(db, etiqueta("880000000001")), { resurtidoId: "L261116-A2", enlaceId: "E1" });
  await setDoc(doc(db, foto("L261116-A2", "enl_F1_otro_00")), { ruta: "x", subidoPor: "enl_F1_otro" });
  await setDoc(doc(db, dato("_contadorEtiquetasLote")), { ultimo: 100 });
  await setDoc(doc(db, dato("articulos_ac")), { huella: "h" });
  await setDoc(doc(db, `${N}/categorias_web_new_version/C1`), { nombre: "Ropa" });
});

const res = [];
async function check(name, expect, p) {
  try {
    await (expect === "ok" ? assertSucceeds(p) : assertFails(p));
    res.push([true, name]);
  } catch (e) {
    res.push([false, `${name}  <- ${e.message || e}`]);
  }
}
const mio = (db) => getDocs(query(collection(db, COL_LOTES), where("enlaceId", "==", "E1")));

// ============ ENLACE DE ARMAR: sus lotes ============
const NUEVO = "L261116-A9";
await check("ARMAR crea un lote suyo", "ok", setDoc(doc(armar, lote(NUEVO)), borrador(NUEVO, "E1", UID_A)));
await check("ARMAR NO crea con la letra de otro acceso", "fail", setDoc(doc(armar, lote("L261116-B9")), borrador("L261116-B9", "E1", UID_A)));
await check("ARMAR NO crea con un id que no es código de lote", "fail", setDoc(doc(armar, lote("loquesea")), borrador("loquesea", "E1", UID_A)));
await check("ARMAR NO crea con folio distinto del id", "fail", setDoc(doc(armar, lote("L261116-A10")), borrador("L261116-A11", "E1", UID_A)));
await check("ARMAR NO crea un lote ya enviado", "fail", setDoc(doc(armar, lote("L261116-A12")), borrador("L261116-A12", "E1", UID_A, { estado: "enviado" })));
await check("ARMAR NO crea a nombre de otro enlace", "fail", setDoc(doc(armar, lote("L261116-A13")), borrador("L261116-A13", "E2", UID_A)));
await check("ARMAR NO crea a nombre de otra sesión", "fail", setDoc(doc(armar, lote("L261116-A14")), borrador("L261116-A14", "E1", "otro")));
await check("ARMAR NO crea con recepción ya escrita", "fail", setDoc(doc(armar, lote("L261116-A15")), borrador("L261116-A15", "E1", UID_A, { recepcion: { sesiones: {} } })));
await check("ARMAR NO crea con la lista (lineas) ya escrita", "fail", setDoc(doc(armar, lote("L261116-A16")), borrador("L261116-A16", "E1", UID_A, { lineas: [{ articuloId: "ART1", cantidadEnviada: -5 }] })));
await check("ARMAR NO crea un resurtido simple (sin cajas)", "fail", setDoc(doc(armar, lote("L261116-A17")), (({ cajas, ...simple }) => simple)(borrador("L261116-A17", "E1", UID_A))));
await check("ARMAR lee un lote suyo", "ok", getDoc(doc(armar, lote("L261116-A1"))));
await check("ARMAR pregunta por un código de lote libre", "ok", getDoc(doc(armar, lote("L261116-A77"))));
await check("ARMAR NO lee el lote de otro enlace", "fail", getDoc(doc(armar, lote("L261116-B1"))));
await check("ARMAR NO lee un resurtido simple", "fail", getDoc(doc(armar, lote("R_S1"))));
await check("ARMAR lista sus lotes", "ok", mio(armar));
await check("ARMAR NO lista todos los resurtidos", "fail", getDocs(collection(armar, COL_LOTES)));
await check("ARMAR NO lista los lotes de otro enlace", "fail", getDocs(query(collection(armar, COL_LOTES), where("enlaceId", "==", "E2"))));
await check("ARMAR agrega caja y paquete a su lote", "ok", updateDoc(doc(armar, lote("L261116-A1")), {
  "cajas.c880000000001": CAJA.c880000000001, "paquetes.p880000000011": PAQ.p880000000011,
}));
await check("ARMAR cambia destino, paquetería y guía", "ok", updateDoc(doc(armar, lote("L261116-A1")), {
  sucursalDestinoId: S2, sucursalDestinoNombre: "Suc 2", paqueteria: "Estafeta", "guias.c880000000001": "G123", responsableEmpaco: "Juan",
}));
await check("ARMAR NO cambia el estado", "fail", updateDoc(doc(armar, lote("L261116-A1")), { estado: "enviado" }));
await check("ARMAR NO cambia de dueño el lote", "fail", updateDoc(doc(armar, lote("L261116-A1")), { enlaceId: "E2" }));
await check("ARMAR NO cambia el folio", "fail", updateDoc(doc(armar, lote("L261116-A1")), { folio: "L261116-A99" }));
await check("ARMAR NO escribe la lista (lineas)", "fail", updateDoc(doc(armar, lote("L261116-A1")), { lineas: [{ articuloId: "ART1", cantidadEnviada: 1 }] }));
await check("ARMAR NO escribe recepción", "fail", updateDoc(doc(armar, lote("L261116-A1")), { "recepcion.sesiones.s1": SESION }));
await check("ARMAR NO se pone como quien envió", "fail", updateDoc(doc(armar, lote("L261116-A1")), { enviadoPor: "yo" }));
await check("ARMAR NO convierte cajas en otra cosa", "fail", updateDoc(doc(armar, lote("L261116-A1")), { cajas: "x" }));
await check("ARMAR marca su lote como listo", "ok", updateDoc(doc(armar, lote("L261116-A1")), { listo: true, fechaListo: "2026-11-16 12:00:00" }));
await check("ARMAR NO edita un lote ya listo", "fail", updateDoc(doc(armar, lote("L261116-A1")), { paqueteria: "DHL" }));
await check("ARMAR NO reabre un lote listo", "fail", updateDoc(doc(armar, lote("L261116-A3")), { listo: false }));
await check("ARMAR NO edita un lote enviado", "fail", updateDoc(doc(armar, lote("L261116-A2")), { paqueteria: "DHL" }));
await check("ARMAR NO edita el lote de otro enlace", "fail", updateDoc(doc(armar, lote("L261116-B1")), { paqueteria: "DHL" }));
await check("ARMAR borra un lote suyo que se está armando", "ok", deleteDoc(doc(armar, lote("L261116-A5"))));
await check("ARMAR NO borra un lote listo", "fail", deleteDoc(doc(armar, lote("L261116-A3"))));
await check("ARMAR NO borra un lote enviado", "fail", deleteDoc(doc(armar, lote("L261116-A2"))));
await check("ARMAR NO borra el lote de otro enlace", "fail", deleteDoc(doc(armar, lote("L261116-B1"))));

// ============ ENLACE DE ARMAR: artículos y etiquetas ============
await check("ARMAR lee un fabricado por su código", "ok", getDoc(doc(armar, art("ARTF"))));
await check("ARMAR lee por su código uno con piezas en el taller", "ok", getDoc(doc(armar, art("ARTB"))));
await check("ARMAR pregunta por un código que no existe", "ok", getDoc(doc(armar, art("NOEXISTE"))));
await check("ARMAR NO lee por id uno que no es de fabricación ni está en el taller", "fail", getDoc(doc(armar, art("ART1"))));
await check("ARMAR NO lee por id uno sin piezas en el taller", "fail", getDoc(doc(armar, art("ARTB0"))));
await check("ARMAR NO lee por id uno con el taller mal escrito", "fail", getDoc(doc(armar, art("ARTBX"))));
await check("ARMAR lista los artículos fabricados", "ok", getDocs(query(collection(armar, `${N}/articulos_n_web_new_version`), where("fabricado", "==", true))));
await check("ARMAR NO lista el catálogo entero", "fail", getDocs(collection(armar, `${N}/articulos_n_web_new_version`)));
await check("ARMAR NO mueve inventario", "fail", updateDoc(doc(armar, art("ART1")), { cantidad: "999" }));
await check("ARMAR NO baja el taller", "fail", updateDoc(doc(armar, art("ARTF")), { cantidadBodega: "0" }));
await check("ARMAR NO crea artículos", "fail", setDoc(doc(armar, art("NUEVO")), { nombre: "x" }));
const etq = (resurtidoId, enlaceId = "E1") => ({ resurtidoId, enlaceId, creadoEn: serverTimestamp() });
/** Como lo hace el teléfono: la etiqueta y la caja (o paquete) en una sola escritura. */
const conLote = (db, codigo, loteId, campo) => {
  const b = writeBatch(db);
  b.set(doc(db, etiqueta(codigo)), etq(loteId));
  b.update(doc(db, lote(loteId)), campo);
  return b.commit();
};
await check("ARMAR registra una etiqueta de caja en su lote", "ok", conLote(armar, "880000000050", "L261116-A7", {
  "cajas.c880000000050": { codigo: "880000000050", orden: 1 },
}));
await check("ARMAR registra una etiqueta de paquete en su lote", "ok", conLote(armar, "880000000054", "L261116-A7", {
  "paquetes.p880000000054": { codigo: "880000000054", caja: "c880000000050", orden: 1, contenido: [{ articuloId: "ARTF", piezas: 3 }] },
}));
await check("ARMAR NO aparta una etiqueta que su lote no usa", "fail", setDoc(doc(armar, etiqueta("880000000055")), etq("L261116-A7")));
await check("ARMAR NO aparta una etiqueta que no se ha impreso (pasa del contador)", "fail", conLote(armar, "880000000101", "L261116-A7", {
  "cajas.c880000000101": { codigo: "880000000101", orden: 2 },
}));
await check("ARMAR NO aparta una etiqueta para un lote listo", "fail", setDoc(doc(armar, etiqueta("880000000056")), etq("L261116-A3")));
await check("ARMAR NO registra una etiqueta en el lote de otro", "fail", setDoc(doc(armar, etiqueta("880000000051")), etq("L261116-B1")));
await check("ARMAR NO registra a nombre de otro enlace", "fail", setDoc(doc(armar, etiqueta("880000000052")), etq("L261116-A7", "E2")));
await check("ARMAR NO registra un código que no es etiqueta", "fail", setDoc(doc(armar, etiqueta("12300001")), etq("L261116-A7")));
await check("ARMAR NO se queda una etiqueta ya usada", "fail", setDoc(doc(armar, etiqueta("880000000001")), etq("L261116-A7")));
await check("ARMAR NO registra con campos de más", "fail", setDoc(doc(armar, etiqueta("880000000053")), { ...etq("L261116-A7"), x: 1 }));
await check("ARMAR ve en qué lote se usó una etiqueta", "ok", getDoc(doc(armar, etiqueta("880000000001"))));
await check("ARMAR NO libera etiquetas", "fail", deleteDoc(doc(armar, etiqueta("880000000050"))));
await check("ARMAR NO lista las etiquetas", "fail", getDocs(collection(armar, `${N}/etiquetas_lote_web_new_version`)));
await check("caja ve en qué lote se usó una etiqueta", "ok", getDoc(doc(nodo1, etiqueta("880000000001"))));
await check("caja NO registra etiquetas", "fail", setDoc(doc(nodo1, etiqueta("880000000060")), etq("L261116-A7")));
await check("admin lista y libera etiquetas", "ok", getDocs(collection(admin, `${N}/etiquetas_lote_web_new_version`)));
await check("admin libera una etiqueta", "ok", deleteDoc(doc(admin, etiqueta("880000000050"))));

// ============ ENLACE apagado, renovado, vencido, sin doc, otro negocio ============
for (const [nombre, db] of [
  ["apagado", armarApagado], ["de una generación vieja (renovado)", armarGenViejo],
  ["vencido", armarVencido], ["sin documento", armarSinDoc], ["de otro negocio", armarOtroNeg],
]) {
  await check(`ARMAR ${nombre} NO lee sus lotes`, "fail", mio(db));
  await check(`ARMAR ${nombre} NO lee un lote`, "fail", getDoc(doc(db, lote("L261116-A7"))));
  await check(`ARMAR ${nombre} NO edita`, "fail", updateDoc(doc(db, lote("L261116-A7")), { paqueteria: "DHL" }));
  await check(`ARMAR ${nombre} NO lee artículos`, "fail", getDoc(doc(db, art("ARTF"))));
}

// ============ El enlace no toca nada más ============
await check("ARMAR NO lee datos", "fail", getDoc(doc(armar, dato("articulos_ac"))));
await check("ARMAR NO escribe datos", "fail", setDoc(doc(armar, dato("articulos_ac")), { huella: "x" }));
await check("ARMAR NO lee categorías", "fail", getDoc(doc(armar, `${N}/categorias_web_new_version/C1`)));
await check("ARMAR NO lee su propio enlace", "fail", getDoc(doc(armar, enl("E1"))));
await check("ARMAR NO se prende ni se renueva", "fail", updateDoc(doc(armar, enl("E1")), { gen: 5 }));
await check("ARMAR NO crea enlaces", "fail", setDoc(doc(armar, enl("X1")), { tipo: "armar", activo: true, gen: 0, secretoHash: HASH, creadoPor: UID_A, creadoEn: serverTimestamp() }));
await check("ARMAR NO lee ventas", "fail", getDoc(doc(armar, `${N}/sucursales_data_web_new_version/${S1}/ventas_n_web_new_version/2026/07/08/items/V1`)));
await check("ARMAR NO sube fotos", "fail", setDoc(doc(armar, foto("L261116-A2", `${UID_A}_00`)), { ruta: "x", subidoPor: UID_A, creadoEn: serverTimestamp() }));
await check("ARMAR NO lee fotos", "fail", getDoc(doc(armar, foto("L261116-A2", "enl_F1_otro_00"))));

// ============ ENLACE DE FOTOS ============
const RID = "L261116-A2";
const ruta = (rid, fid, ext = "webp") => `lotes_media_web_new_version/${NID}/${rid}/${fid}.${ext}`;
const fotoDoc = (rid, fid, extra = {}) => ({ ruta: ruta(rid, fid), subidoPor: UID_F, creadoEn: serverTimestamp(), ...extra });
await check("FOTOS registra una foto de su lote", "ok", setDoc(doc(recibir, foto(RID, `${UID_F}_07`)), fotoDoc(RID, `${UID_F}_07`, { nota: "caja golpeada" })));
await check("FOTOS registra una foto en JPG", "ok", setDoc(doc(recibir, foto(RID, `${UID_F}_08`)), { ...fotoDoc(RID, `${UID_F}_08`), ruta: ruta(RID, `${UID_F}_08`, "jpg") }));
await check("FOTOS NO pasa de 30 (id _30)", "fail", setDoc(doc(recibir, foto(RID, `${UID_F}_30`)), fotoDoc(RID, `${UID_F}_30`)));
await check("FOTOS NO usa el id de otro teléfono", "fail", setDoc(doc(recibir, foto(RID, "enl_F1_otro_01")), fotoDoc(RID, "enl_F1_otro_01")));
await check("FOTOS NO registra en otro lote", "fail", setDoc(doc(recibir, foto("L261116-A4", `${UID_F}_01`)), fotoDoc("L261116-A4", `${UID_F}_01`)));
await check("FOTOS NO apunta a otro archivo", "fail", setDoc(doc(recibir, foto(RID, `${UID_F}_02`)), { ...fotoDoc(RID, `${UID_F}_02`), ruta: "media_web_new_version/articulos/x.webp" }));
await check("FOTOS NO registra a nombre de otro", "fail", setDoc(doc(recibir, foto(RID, `${UID_F}_03`)), { ...fotoDoc(RID, `${UID_F}_03`), subidoPor: "otro" }));
await check("FOTOS NO mete campos de más", "fail", setDoc(doc(recibir, foto(RID, `${UID_F}_04`)), fotoDoc(RID, `${UID_F}_04`, { x: 1 })));
await check("FOTOS NO pone una nota enorme", "fail", setDoc(doc(recibir, foto(RID, `${UID_F}_05`)), fotoDoc(RID, `${UID_F}_05`, { nota: "x".repeat(301) })));
await check("FOTOS NO falsea la hora", "fail", setDoc(doc(recibir, foto(RID, `${UID_F}_06`)), { ...fotoDoc(RID, `${UID_F}_06`), creadoEn: new Date(2020, 0, 1) }));
await check("FOTOS NO edita una foto", "fail", updateDoc(doc(recibir, foto(RID, `${UID_F}_07`)), { nota: "otra" }));
await check("FOTOS NO borra una foto", "fail", deleteDoc(doc(recibir, foto(RID, `${UID_F}_07`))));
await check("FOTOS NO lee fotos", "fail", getDoc(doc(recibir, foto(RID, `${UID_F}_07`))));
await check("FOTOS NO lee el lote", "fail", getDoc(doc(recibir, lote(RID))));
await check("FOTOS NO edita el lote", "fail", updateDoc(doc(recibir, lote(RID)), { "recepcion.sesiones.s9": SESION }));
await check("FOTOS NO crea lotes", "fail", setDoc(doc(recibir, lote("L261116-A20")), borrador("L261116-A20", "F1", UID_F)));
await check("FOTOS NO lee artículos", "fail", getDoc(doc(recibir, art("ART1"))));
await check("FOTOS apagado NO registra", "fail", setDoc(doc(recibirApagado, foto(RID, "enl_FOFF_x_00")), { ruta: ruta(RID, "enl_FOFF_x_00"), subidoPor: "enl_FOFF_x", creadoEn: serverTimestamp() }));
await check("FOTOS vencido NO registra", "fail", setDoc(doc(recibirVencido, foto(RID, "enl_F1_venc_00")), { ruta: ruta(RID, "enl_F1_venc_00"), subidoPor: "enl_F1_venc", creadoEn: serverTimestamp() }));
await check("caja lee las fotos de un lote", "ok", getDocs(collection(nodo1, `${lote(RID)}/fotos_web_new_version`)));
await check("caja NO registra fotos", "fail", setDoc(doc(nodo1, foto(RID, "n1_00")), { ruta: ruta(RID, "n1_00"), subidoPor: "n1", creadoEn: serverTimestamp() }));
await check("admin lee y borra una foto", "ok", deleteDoc(doc(admin, foto(RID, `${UID_F}_08`))));
await check("anon NO lee fotos", "fail", getDoc(doc(anon, foto(RID, `${UID_F}_07`))));

// ============ ENLACES (los documentos) ============
const enlaceNuevo = (extra = {}) => ({
  tipo: "armar", activo: true, gen: 0, letra: "C", nombre: "Taller", secretoHash: HASH,
  creadoPor: "a1", creadoEn: serverTimestamp(), ...extra,
});
const enlaceFotos = (uid, sucursalId, resurtidoId, extra = {}) => ({
  tipo: "recibir", activo: true, gen: 0, secretoHash: HASH, creadoPor: uid,
  creadoEn: serverTimestamp(), sucursalId, resurtidoId, ...extra,
});
await check("admin crea un acceso de armar", "ok", setDoc(doc(admin, enl("N1")), enlaceNuevo()));
await check("superadmin crea un acceso de armar", "ok", setDoc(doc(supera, enl("N2")), enlaceNuevo({ creadoPor: "sa" })));
await check("admin NO crea un acceso apagado ni con generación", "fail", setDoc(doc(admin, enl("N3")), enlaceNuevo({ gen: 3 })));
await check("admin NO crea con el secreto en claro", "fail", setDoc(doc(admin, enl("N4")), enlaceNuevo({ secretoHash: "secreto" })));
await check("admin NO falsea la hora de creación", "fail", setDoc(doc(admin, enl("N5")), enlaceNuevo({ creadoEn: new Date(2020, 0, 1) })));
await check("admin NO escribe el vencimiento a mano", "fail", setDoc(doc(admin, enl("N6")), enlaceNuevo({ expira: LEJOS })));
await check("admin lista los accesos", "ok", getDocs(collection(admin, `${N}/enlaces_lote_web_new_version`)));
await check("admin apaga un acceso", "ok", updateDoc(doc(admin, enl("N1")), { activo: false }));
await check("admin lo vuelve a prender y lo renombra", "ok", updateDoc(doc(admin, enl("N1")), { activo: true, nombre: "Taller 2" }));
await check("admin renueva el enlace", "ok", updateDoc(doc(admin, enl("N1")), { secretoHash: "b".repeat(64), gen: 1, canjes: 0 }));
await check("admin NO cambia el tipo de un acceso", "fail", updateDoc(doc(admin, enl("N1")), { tipo: "recibir" }));
await check("admin NO le cambia el lote a un acceso de fotos", "fail", updateDoc(doc(admin, enl("F1")), { resurtidoId: "L261116-A4" }));
await check("admin borra un acceso", "ok", deleteDoc(doc(admin, enl("N2"))));
await check("mercancia NO crea accesos", "fail", setDoc(doc(merc, enl("M1")), enlaceNuevo({ creadoPor: "m1" })));
await check("mercancia NO lee accesos", "fail", getDoc(doc(merc, enl("E1"))));
await check("anon NO lee accesos", "fail", getDoc(doc(anon, enl("E1"))));
await check("caja crea un acceso de fotos para un lote enviado de su sucursal", "ok", setDoc(doc(nodo1, enl("Q1")), enlaceFotos("n1", S1, "L261116-A2")));
await check("caja crea un acceso de fotos para un lote recibido en parte", "ok", setDoc(doc(nodo1, enl("Q2")), enlaceFotos("n1", S1, "L261116-A6")));
await check("caja crea un acceso de fotos para un lote cerrado de su sucursal", "ok", setDoc(doc(nodo1, enl("Q11")), enlaceFotos("n1", S1, "L261116-A30")));
await check("caja NO crea un acceso para un lote de otra sucursal", "fail", setDoc(doc(nodo1, enl("Q3")), enlaceFotos("n1", S1, "L261116-A4")));
await check("caja NO crea un acceso diciendo otra sucursal", "fail", setDoc(doc(nodo1, enl("Q4")), enlaceFotos("n1", S2, "L261116-A4")));
await check("caja NO crea un acceso de armar", "fail", setDoc(doc(nodo1, enl("Q5")), enlaceNuevo({ creadoPor: "n1" })));
await check("caja NO crea un acceso para un lote que se está armando", "fail", setDoc(doc(nodo1, enl("Q6")), enlaceFotos("n1", S1, "L261116-A7")));
await check("caja NO crea un acceso para un resurtido simple", "fail", setDoc(doc(nodo1, enl("Q7")), enlaceFotos("n1", S1, "R_S1")));
await check("caja NO crea un acceso para un lote que no existe", "fail", setDoc(doc(nodo1, enl("Q8")), enlaceFotos("n1", S1, "NADA")));
await check("caja NO crea un acceso a nombre de otro", "fail", setDoc(doc(nodo1, enl("Q9")), enlaceFotos("otro", S1, "L261116-A2")));
await check("caja NO falsea la hora del acceso", "fail", setDoc(doc(nodo1, enl("Q10")), enlaceFotos("n1", S1, "L261116-A2", { creadoEn: new Date(2030, 0, 1) })));
await check("caja apaga un acceso que ella creó", "ok", updateDoc(doc(nodo1, enl("Q1")), { activo: false }));
await check("caja NO lo vuelve a prender", "fail", updateDoc(doc(nodo1, enl("Q1")), { activo: true }));
await check("caja NO apaga el acceso de otra caja", "fail", updateDoc(doc(nodo1, enl("FNODO2")), { activo: false }));
await check("caja NO apaga un acceso de armar", "fail", updateDoc(doc(nodo1, enl("E2")), { activo: false }));
await check("caja NO lee accesos", "fail", getDoc(doc(nodo1, enl("Q2"))));
await check("caja NO renueva accesos", "fail", updateDoc(doc(nodo1, enl("Q2")), { gen: 1 }));

// ============ CANDADO: la caja ============
const recibirSesion = (sid, extra = {}) => ({
  estado: "parcial", [`recepcion.sesiones.${sid}`]: SESION, fechaRecibido: "2026-11-18 12:00:00", responsableRecibe: "Ana", ...extra,
});
await check("caja agrega una sesión a un lote enviado de su sucursal", "ok", updateDoc(doc(nodo1, lote("L261116-A2")), recibirSesion("s1")));
await check("caja agrega otra sesión y cierra", "ok", updateDoc(doc(nodo1, lote("L261116-A2")), recibirSesion("s2", { estado: "cerrado", fechaCerrado: "2026-11-19 09:00:00" })));
await check("caja NO reabre un lote cerrado", "fail", updateDoc(doc(nodo1, lote("L261116-A2")), recibirSesion("s3")));
await check("caja recibe lo que aparece después de 'no llegó' y el lote sigue cerrado", "ok", updateDoc(doc(nodo1, lote("L261116-A30")), recibirSesion("t1", { estado: "cerrado" })));
await check("caja NO agrega dos sesiones de una vez", "fail", updateDoc(doc(nodo1, lote("L261116-A30")), {
  estado: "cerrado", "recepcion.sesiones.t2": SESION, "recepcion.sesiones.t3": SESION,
}));
await check("caja NO cierra un lote sin agregar una sesión", "fail", updateDoc(doc(nodo1, lote("L261116-A8")), { estado: "cerrado", fechaCerrado: "2026-11-19 09:00:00" }));
await check("caja NO edita una sesión guardada", "fail", updateDoc(doc(nodo1, lote("L261116-A6")), { "recepcion.sesiones.s1.quien": "Otro" }));
await check("caja NO borra una sesión guardada", "fail", updateDoc(doc(nodo1, lote("L261116-A6")), { "recepcion.sesiones.s1": deleteField() }));
await check("caja NO borra toda la recepción", "fail", updateDoc(doc(nodo1, lote("L261116-A6")), { recepcion: deleteField() }));
await check("caja NO cambia la lista (lineas) de un lote", "fail", updateDoc(doc(nodo1, lote("L261116-A6")), { ...recibirSesion("s2"), lineas: [] }));
await check("caja NO cambia las cajas de un lote", "fail", updateDoc(doc(nodo1, lote("L261116-A6")), { ...recibirSesion("s2"), "cajas.c880000000002": { codigo: "880000000002", orden: 2 } }));
await check("caja NO cambia el contenido de un paquete", "fail", updateDoc(doc(nodo1, lote("L261116-A6")), { ...recibirSesion("s2"), "paquetes.p880000000011.contenido": [{ articuloId: "ARTF", piezas: 999 }] }));
await check("caja NO usa el flujo viejo en un lote (recibido)", "fail", updateDoc(doc(nodo1, lote("L261116-A8")), { estado: "recibido", fechaRecibido: "x", responsableRecibe: "Ana" }));
await check("caja NO cierra un lote con el flujo viejo (lineas + cerrado)", "fail", updateDoc(doc(nodo1, lote("L261116-A8")), { estado: "cerrado", fechaCerrado: "x", responsableConfirma: "Ana", lineas: [{ articuloId: "ARTF", cantidadEnviada: 12, disposicion: { tienda: 12, dañado: 0, perdido: 0 } }] }));
await check("caja NO cierra un lote sin sesión por otro campo", "fail", updateDoc(doc(nodo1, lote("L261116-A8")), { estado: "cerrado", responsableConfirma: "Ana" }));
await check("caja NO regresa un lote a enviado", "fail", updateDoc(doc(nodo1, lote("L261116-A6")), { estado: "enviado" }));
await check("caja NO toca un lote de otra sucursal", "fail", updateDoc(doc(nodo1, lote("L261116-A4")), recibirSesion("s1")));
await check("caja NO toca un lote que se está armando", "fail", updateDoc(doc(nodo1, lote("L261116-A7")), recibirSesion("s1")));
await check("caja NO confirma el envío de un lote", "fail", updateDoc(doc(nodo1, lote("L261116-A3")), { estado: "enviado" }));
await check("caja NO le cambia el destino a un lote", "fail", updateDoc(doc(nodo1, lote("L261116-A6")), { ...recibirSesion("s2"), sucursalDestinoId: S2 }));
await check("caja de la otra sucursal sí recibe el suyo", "ok", updateDoc(doc(nodo2, lote("L261116-A4")), recibirSesion("s1")));
await check("caja NO crea resurtidos", "fail", setDoc(doc(nodo1, lote("R_NUEVO")), { estado: "creando", sucursalDestinoId: S1, lineas: [] }));
await check("caja NO borra resurtidos", "fail", deleteDoc(doc(nodo1, lote("R_CRE"))));
await check("caja NO borra lotes", "fail", deleteDoc(doc(nodo1, lote("L261116-A7"))));
// El flujo de hoy de la caja con un resurtido simple (lo que escribe nodo-web).
await check("caja recibe un resurtido simple de su sucursal", "ok", updateDoc(doc(nodo1, lote("R_S1")), { estado: "recibido", fechaRecibido: "2026-11-18 12:00:00", responsableRecibe: "Ana" }));
await check("caja cierra un resurtido simple de su sucursal", "ok", updateDoc(doc(nodo1, lote("R_S1")), {
  estado: "cerrado", fechaCerrado: "2026-11-18 12:05:00", responsableConfirma: "Ana",
  lineas: [{ articuloId: "ART1", nombreSnapshot: "X", cantidadEnviada: 3, disposicion: { tienda: 3, dañado: 0, perdido: 0 } }],
}));
await check("caja NO reabre un resurtido simple cerrado", "fail", updateDoc(doc(nodo1, lote("R_S1")), { estado: "recibido" }));
await check("caja NO toca un resurtido simple de otra sucursal", "fail", updateDoc(doc(nodo1, lote("R_S2")), { estado: "recibido", fechaRecibido: "x", responsableRecibe: "Ana" }));
await check("caja NO despacha un resurtido que se está creando", "fail", updateDoc(doc(nodo1, lote("R_CRE")), { estado: "en_transito" }));
await check("caja NO le cambia el destino a un resurtido simple", "fail", updateDoc(doc(nodo1, lote("R_S1B")), { estado: "recibido", sucursalDestinoId: S2 }));
await check("caja NO convierte un resurtido simple en lote", "fail", updateDoc(doc(nodo1, lote("R_S1B")), { estado: "recibido", cajas: {} }));
await check("caja sigue leyendo resurtidos", "ok", getDocs(query(collection(nodo1, COL_LOTES), where("sucursalDestinoId", "==", S1))));

// ============ CANDADO: admin y mercancía ============
await check("admin confirma el envío de un lote listo (escribe la lista)", "ok", updateDoc(doc(admin, lote("L261116-A3")), {
  estado: "enviado", fechaEnTransito: "2026-11-16 13:00:00", enviadoPor: "a@x.com",
  lineas: [{ articuloId: "ARTF", nombreSnapshot: "Llavero", cantidadEnviada: 12 }],
}));
await check("admin corrige paquetería y guías de un lote enviado", "ok", updateDoc(doc(admin, lote("L261116-A3")), { paqueteria: "DHL", "guias.c880000000001": "G9" }));
await check("admin NO cambia las cajas de un lote enviado", "fail", updateDoc(doc(admin, lote("L261116-A3")), { "cajas.c880000000002": { codigo: "880000000002", orden: 2 } }));
await check("admin NO cambia la lista de un lote enviado", "fail", updateDoc(doc(admin, lote("L261116-A3")), { lineas: [] }));
await check("admin NO cambia el destino de un lote enviado", "fail", updateDoc(doc(admin, lote("L261116-A3")), { sucursalDestinoId: S2 }));
await check("admin NO regresa un lote enviado a armarse", "fail", updateDoc(doc(admin, lote("L261116-A3")), { estado: "creando" }));
await check("admin NO cierra un lote que se está armando sin enviarlo", "fail", updateDoc(doc(admin, lote("L261116-A7")), { estado: "cerrado" }));
await check("admin NO cambia el folio", "fail", updateDoc(doc(admin, lote("L261116-A7")), { folio: "L261116-A99" }));
await check("admin NO le quita las cajas a un lote (volverlo simple)", "fail", updateDoc(doc(admin, lote("L261116-A7")), { cajas: deleteField() }));
await check("admin NO pone un lote en un estado viejo", "fail", updateDoc(doc(admin, lote("L261116-A7")), { estado: "en_transito" }));
await check("admin NO edita una sesión guardada", "fail", updateDoc(doc(admin, lote("L261116-A6")), { "recepcion.sesiones.s1.quien": "Otro" }));
await check('admin declara "no llegó" y cierra', "ok", updateDoc(doc(admin, lote("L261116-A6")), {
  estado: "cerrado", fechaCerrado: "2026-11-20 10:00:00", responsableConfirma: "a@x.com",
  "recepcion.sesiones.s2": { tipo: "no_llego", fecha: "2026-11-20 10:00:00", quien: "a@x.com", noLlego: { ARTF: 1 } },
}));
await check("admin regresa a armado un lote listo", "ok", updateDoc(doc(admin, lote("L261116-A1")), { listo: false }));
await check("admin NO borra un lote enviado", "fail", deleteDoc(doc(admin, lote("L261116-A3"))));
await check("admin borra un lote que se está armando", "ok", deleteDoc(doc(admin, lote("L261116-A1"))));
await check("superadmin corrige guías de un lote", "ok", updateDoc(doc(supera, lote("L261116-A8")), { paqueteria: "Estafeta" }));
await check("mercancia lee un lote", "ok", getDoc(doc(merc, lote("L261116-A8"))));
await check("mercancia NO edita un lote", "fail", updateDoc(doc(merc, lote("L261116-A8")), { paqueteria: "X" }));
await check("mercancia NO confirma el envío de un lote", "fail", updateDoc(doc(merc, lote("L261116-A7")), { estado: "enviado" }));
await check("mercancia NO crea lotes", "fail", setDoc(doc(merc, lote("L261116-M1")), borrador("L261116-M1", "E1", "m1")));
await check("mercancia NO borra lotes", "fail", deleteDoc(doc(merc, lote("L261116-A7"))));
await check("mercancia NO convierte un resurtido simple en lote", "fail", updateDoc(doc(merc, lote("R_CRE")), { cajas: {} }));
await check("mercancia sigue despachando resurtidos simples", "ok", updateDoc(doc(merc, lote("R_CRE")), { estado: "en_transito", fechaEnTransito: "x", responsableTraslado: "Juan" }));
await check("mercancia sigue borrando resurtidos simples", "ok", deleteDoc(doc(merc, lote("R_REC"))));
await check("admin sigue creando resurtidos simples", "ok", setDoc(doc(admin, lote("R_ADM")), { estado: "creando", sucursalDestinoId: S1, lineas: [] }));
await check("anon NO lee lotes", "fail", getDoc(doc(anon, lote("L261116-A8"))));

// ============ Contador de etiquetas ============
await check("admin avanza el contador de etiquetas", "ok", updateDoc(doc(admin, dato("_contadorEtiquetasLote")), { ultimo: 400 }));
await check("caja NO avanza el contador de etiquetas", "fail", updateDoc(doc(nodo1, dato("_contadorEtiquetasLote")), { ultimo: 1 }));
await check("mercancia NO avanza el contador de etiquetas", "fail", updateDoc(doc(merc, dato("_contadorEtiquetasLote")), { ultimo: 1 }));
await check("caja sigue escribiendo su huella", "ok", setDoc(doc(nodo1, dato("articulos_ac")), { huella: "h2" }));

let ok = true;
for (const [pass, name] of res) { console.log((pass ? "PASS" : "FALLA") + "  " + name); if (!pass) ok = false; }
await env.cleanup();
console.log(ok ? `\nOK: ${res.length}/${res.length} reglas de lotes verificadas` : `\nFALLAS presentes`);
process.exit(ok ? 0 : 1);
