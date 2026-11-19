// Pruebas de las reglas de la IMPRESORA DE ETIQUETAS: impresoras, cola de
// impresión y el contador de etiquetas de lote que sube el programa
// (../firestore.rules.candidata, igual a ../firestore.rules).
//
// Correr (desde rules-test/):
//   npx firebase emulators:exec --project demo-test --only firestore "node test.mjs && node lotes.test.mjs && node impresion.test.mjs"
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
const LEJOS = 4102444800000; // año 2100: armar e imprimir no vencen

const env = await initializeTestEnvironment({
  projectId: "demo-test",
  firestore: { rules: RULES, host: "127.0.0.1", port: 8155 },
});
await env.clearFirestore();

const ctx = (uid, claims) => env.authenticatedContext(uid, claims).firestore();
const anon = env.unauthenticatedContext().firestore();
const admin = ctx("a1", { role: "admin", negocioId: NID });
const merc = ctx("m1", { role: "mercancia", negocioId: NID, sucursalId: S1, mercanciaUid: "m1" });
const nodo1 = ctx("n1", { role: "nodo", negocioId: NID, sucursalId: S1, nodoId: "n1" });
const nodo2 = ctx("n2", { role: "nodo", negocioId: NID, sucursalId: S2, nodoId: "n2" });
const enlace = (enlaceId, tipo, extra = {}) => ({
  role: "enlace", negocioId: NID, enlaceId, tipo, gen: 0, vence: LEJOS, ...extra,
});
const UID_ARMAR = "enl_E1_aaaa";
const armar = ctx(UID_ARMAR, enlace("E1", "armar", { letra: "A" }));
const armarB = ctx("enl_E2_bbbb", enlace("E2", "armar", { letra: "B" }));
const UID_P1 = "enl_I1_pc01";
const pc1 = ctx(UID_P1, enlace("I1", "imprimir", { sucursalId: S1 }));
const pc3 = ctx("enl_I3_pc03", enlace("I3", "imprimir"));
const pcApagada = ctx("enl_I2_pc02", enlace("I2", "imprimir"));
const pcGenVieja = ctx("enl_IG_pc09", enlace("IG", "imprimir"));
const fotos = ctx("enl_F1_ffff", enlace("F1", "recibir", { resurtidoId: "L1", sucursalId: S1, vence: Date.now() + 600_000 }));

const N = `negocios_web_new_version/${NID}`;
const acceso = (id) => `${N}/enlaces_lote_web_new_version/${id}`;
const impresora = (id) => `${N}/impresoras_web_new_version/${id}`;
const trabajo = (id) => `${N}/impresiones_web_new_version/${id}`;
const COLA = `${N}/impresiones_web_new_version`;
const CONTADOR = `${N}/datos_web_new_version/_contadorEtiquetasLote`;
const HASH = "a".repeat(64);

await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  const e = (extra) => ({ activo: true, gen: 0, secretoHash: HASH, creadoPor: "a1", ...extra });
  await setDoc(doc(db, acceso("E1")), e({ tipo: "armar", letra: "A" }));
  await setDoc(doc(db, acceso("E2")), e({ tipo: "armar", letra: "B" }));
  await setDoc(doc(db, acceso("I1")), e({ tipo: "imprimir", nombre: "Centro", sucursalId: S1 }));
  await setDoc(doc(db, acceso("I2")), e({ tipo: "imprimir", nombre: "Apagada", activo: false }));
  await setDoc(doc(db, acceso("I3")), e({ tipo: "imprimir", nombre: "Taller" }));
  await setDoc(doc(db, acceso("IG")), e({ tipo: "imprimir", nombre: "Renovada", gen: 1 }));
  await setDoc(doc(db, acceso("F1")), e({ tipo: "recibir", sucursalId: S1, resurtidoId: "L1" }));
  await setDoc(doc(db, impresora("I1")), { nombre: "Centro", sucursalId: S1 });
  await setDoc(doc(db, impresora("I2")), { nombre: "Apagada" });
  await setDoc(doc(db, impresora("I3")), { nombre: "Taller" });
  await setDoc(doc(db, impresora("IG")), { nombre: "Renovada" });
  await setDoc(doc(db, CONTADOR), { ultimo: 100 });
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

// ============ Accesos de impresora ============
const accesoNuevo = (extra = {}) => ({
  tipo: "imprimir", activo: true, gen: 0, nombre: "Bodega", secretoHash: HASH,
  creadoPor: "a1", creadoEn: serverTimestamp(), ...extra,
});
await check("admin crea un acceso de impresora", "ok", setDoc(doc(admin, acceso("I9")), accesoNuevo({ sucursalId: S2 })));
await check("caja NO crea un acceso de impresora", "fail", setDoc(doc(nodo1, acceso("I8")), accesoNuevo({ creadoPor: "n1", sucursalId: S1 })));
await check("mercancia NO crea un acceso de impresora", "fail", setDoc(doc(merc, acceso("I7")), accesoNuevo({ creadoPor: "m1" })));

// ============ Impresoras ============
await check("admin crea una impresora", "ok", setDoc(doc(admin, impresora("I9")), { nombre: "Bodega", sucursalId: S2, creadoEn: serverTimestamp() }));
await check("admin NO crea una impresora con campos del programa", "fail", setDoc(doc(admin, impresora("I8")), { nombre: "X", latidoEn: serverTimestamp() }));
await check("caja NO crea impresoras", "fail", setDoc(doc(nodo1, impresora("I8")), { nombre: "X" }));
await check("caja lee las impresoras", "ok", getDocs(collection(nodo1, `${N}/impresoras_web_new_version`)));
await check("mercancia lee las impresoras", "ok", getDoc(doc(merc, impresora("I1"))));
await check("el teléfono de armar lee las impresoras", "ok", getDocs(collection(armar, `${N}/impresoras_web_new_version`)));
await check("el teléfono de fotos NO lee impresoras", "fail", getDoc(doc(fotos, impresora("I1"))));
await check("anon NO lee impresoras", "fail", getDoc(doc(anon, impresora("I1"))));
await check("el programa lee su impresora", "ok", getDoc(doc(pc1, impresora("I1"))));
await check("el programa NO lee otra impresora", "fail", getDoc(doc(pc1, impresora("I3"))));
await check("el programa avisa que sigue vivo y dice su impresora de Windows", "ok", updateDoc(doc(pc1, impresora("I1")), {
  latidoEn: serverTimestamp(), windows: "Etiquetas AMISE", pausada: false, version: "1.0.0",
}));
await check("el programa NO falsea la hora de su aviso", "fail", updateDoc(doc(pc1, impresora("I1")), { latidoEn: new Date(2030, 0, 1) }));
await check("el programa NO se cambia el nombre", "fail", updateDoc(doc(pc1, impresora("I1")), { nombre: "Otra" }));
await check("el programa NO se cambia de sucursal", "fail", updateDoc(doc(pc1, impresora("I1")), { sucursalId: S2 }));
await check("el programa NO toca otra impresora", "fail", updateDoc(doc(pc1, impresora("I3")), { pausada: true }));
await check("el programa apagado NO avisa", "fail", updateDoc(doc(pcApagada, impresora("I2")), { latidoEn: serverTimestamp() }));
await check("el programa de un acceso renovado NO avisa", "fail", updateDoc(doc(pcGenVieja, impresora("IG")), { latidoEn: serverTimestamp() }));
await check("admin renombra una impresora", "ok", updateDoc(doc(admin, impresora("I3")), { nombre: "Taller Puebla" }));
await check("admin NO escribe el aviso de vida", "fail", updateDoc(doc(admin, impresora("I3")), { pausada: true }));

// ============ Contador de etiquetas ============
await check("el programa lee el contador de etiquetas", "ok", getDoc(doc(pc3, CONTADOR)));
await check("el programa NO lee otros datos", "fail", getDoc(doc(pc3, `${N}/datos_web_new_version/articulos_ac`)));
await check("el programa NO baja el contador", "fail", updateDoc(doc(pc3, CONTADOR), { ultimo: 50 }));
await check("el programa NO sube el contador más de 300", "fail", updateDoc(doc(pc3, CONTADOR), { ultimo: 401 }));
await check("el programa NO mete otros campos al contador", "fail", updateDoc(doc(pc3, CONTADOR), { ultimo: 101, x: 1 }));
await check("el teléfono NO sube el contador", "fail", updateDoc(doc(armar, CONTADOR), { ultimo: 101 }));
await check("el programa apagado NO sube el contador", "fail", updateDoc(doc(pcApagada, CONTADOR), { ultimo: 101 }));
await check("el programa NO sube el contador sin decir de qué orden", "fail", updateDoc(doc(pc3, CONTADOR), { ultimo: 101 }));
await check("el programa NO sube el contador con una orden que no existe", "fail", updateDoc(doc(pc3, CONTADOR), { ultimo: 101, trabajoId: "NO_EXISTE" }));

// ============ Cola: crear ============
const orden = (extra) => ({ estado: "pendiente", creadoEn: serverTimestamp(), ...extra });
const deLote = (uid, cantidad, impresoraId, extra = {}) =>
  orden({ tipo: "etiquetas_lote", impresoraId, origen: "enlace", creadoPor: uid, cantidad, enlaceId: "E1", quien: "Taller", ...extra });
const dePrecio = (uid, impresoraId, extra = {}) =>
  orden({ tipo: "etiquetas_precio", impresoraId, origen: "nodo", creadoPor: uid, nodoId: "n1", sucursalId: S1,
    renglones: [{ codigo: "12300001", precio: "35", piezas: 3 }, { precio: "20", piezas: 1 }], ...extra });

await check("el teléfono pide 20 etiquetas a la impresora del taller", "ok", setDoc(doc(armar, trabajo("T1")), deLote(UID_ARMAR, 20, "I3")));
await check("el teléfono NO pide más de 60", "fail", setDoc(doc(armar, trabajo("T2")), deLote(UID_ARMAR, 61, "I3")));
await check("el teléfono NO pide 0", "fail", setDoc(doc(armar, trabajo("T2")), deLote(UID_ARMAR, 0, "I3")));
await check("el teléfono NO pide a una impresora apagada", "fail", setDoc(doc(armar, trabajo("T2")), deLote(UID_ARMAR, 5, "I2")));
await check("el teléfono NO pide a una impresora que no existe", "fail", setDoc(doc(armar, trabajo("T2")), deLote(UID_ARMAR, 5, "NADA")));
await check("el teléfono NO trae sus propios números", "fail", setDoc(doc(armar, trabajo("T2")), deLote(UID_ARMAR, 5, "I3", { desde: 1, hasta: 5 })));
await check("el teléfono NO la crea ya impresa", "fail", setDoc(doc(armar, trabajo("T2")), deLote(UID_ARMAR, 5, "I3", { estado: "impreso" })));
await check("el teléfono NO pide a nombre de otro acceso", "fail", setDoc(doc(armar, trabajo("T2")), deLote(UID_ARMAR, 5, "I3", { enlaceId: "E2" })));
await check("el teléfono NO pide a nombre de otra sesión", "fail", setDoc(doc(armar, trabajo("T2")), deLote("otro", 5, "I3")));
await check("el teléfono NO pide etiquetas de precio", "fail", setDoc(doc(armar, trabajo("T2")), dePrecio(UID_ARMAR, "I3", { origen: "enlace", enlaceId: "E1" })));
await check("el teléfono NO falsea la hora", "fail", setDoc(doc(armar, trabajo("T2")), deLote(UID_ARMAR, 5, "I3", { creadoEn: new Date(2020, 0, 1) })));
await check("admin pide 300 etiquetas", "ok", setDoc(doc(admin, trabajo("T3")), orden({ tipo: "etiquetas_lote", impresoraId: "I3", origen: "admin", creadoPor: "a1", cantidad: 300, quien: "a@x.com" })));
await check("admin NO pide más de 300", "fail", setDoc(doc(admin, trabajo("T4")), orden({ tipo: "etiquetas_lote", impresoraId: "I3", origen: "admin", creadoPor: "a1", cantidad: 301 })));
await check("la caja manda etiquetas de precio a la impresora de su sucursal", "ok", setDoc(doc(nodo1, trabajo("T5")), dePrecio("n1", "I1", { quien: "Vendedor" })));
await check("la caja NO manda a una impresora sin sucursal", "fail", setDoc(doc(nodo1, trabajo("T6")), dePrecio("n1", "I3")));
await check("la caja NO manda a la impresora de otra sucursal", "fail", setDoc(doc(nodo2, trabajo("T6")), dePrecio("n2", "I1", { nodoId: "n2", sucursalId: S2 })));
await check("la caja NO dice otra sucursal", "fail", setDoc(doc(nodo1, trabajo("T6")), dePrecio("n1", "I1", { sucursalId: S2 })));
await check("la caja NO manda sin renglones", "fail", setDoc(doc(nodo1, trabajo("T6")), dePrecio("n1", "I1", { renglones: [] })));
await check("la caja NO pide etiquetas de lote", "fail", setDoc(doc(nodo1, trabajo("T6")), orden({ tipo: "etiquetas_lote", impresoraId: "I1", origen: "nodo", creadoPor: "n1", cantidad: 5, nodoId: "n1", sucursalId: S1 })));
await check("mercancia NO manda órdenes", "fail", setDoc(doc(merc, trabajo("T6")), orden({ tipo: "etiquetas_lote", impresoraId: "I3", origen: "admin", creadoPor: "m1", cantidad: 5 })));
await check("el programa NO se manda órdenes", "fail", setDoc(doc(pc3, trabajo("T6")), orden({ tipo: "etiquetas_lote", impresoraId: "I3", origen: "admin", creadoPor: "enl_I3_pc03", cantidad: 5 })));

// ============ Cola: leer ============
await check("el teléfono ve su orden", "ok", getDoc(doc(armar, trabajo("T1"))));
await check("el teléfono lista sus órdenes", "ok", getDocs(query(collection(armar, COLA), where("enlaceId", "==", "E1"))));
await check("el teléfono NO ve la orden de admin", "fail", getDoc(doc(armar, trabajo("T3"))));
await check("el teléfono pregunta por una orden que no existe", "ok", getDoc(doc(armar, trabajo("NO_EXISTE"))));
await check("la caja pregunta por una orden que no existe", "ok", getDoc(doc(nodo1, trabajo("NO_EXISTE"))));
await check("el teléfono de fotos NO lee órdenes", "fail", getDoc(doc(fotos, trabajo("NO_EXISTE"))));
await check("otro teléfono NO ve la orden", "fail", getDoc(doc(armarB, trabajo("T1"))));
await check("la caja ve la orden de su sucursal", "ok", getDoc(doc(nodo1, trabajo("T5"))));
await check("la caja de otra sucursal NO la ve", "fail", getDoc(doc(nodo2, trabajo("T5"))));
await check("el programa lista las órdenes pendientes de su impresora", "ok", getDocs(query(collection(pc3, COLA), where("impresoraId", "==", "I3"), where("estado", "==", "pendiente"))));
await check("el programa NO lista toda la cola", "fail", getDocs(collection(pc3, COLA)));
await check("el programa NO ve órdenes de otra impresora", "fail", getDoc(doc(pc3, trabajo("T5"))));
await check("admin ve toda la cola", "ok", getDocs(collection(admin, COLA)));

// ============ Cola: el programa toma, aparta números e imprime ============
// El contador se sube con el id de la orden que se toma (`trabajoContador`
// solo cambia para probar que no se puede poner el de otra).
const tomar = (db, uid, id, campos, contador, trabajoContador = id) => {
  const b = writeBatch(db);
  b.update(doc(db, trabajo(id)), { estado: "imprimiendo", tomadoPor: uid, tomadoEn: serverTimestamp(), ...campos });
  if (contador !== undefined) b.update(doc(db, CONTADOR), { ultimo: contador, trabajoId: trabajoContador });
  return b.commit();
};
await env.withSecurityRulesDisabled(async (c) => {
  // Otra orden de 20 al taller, para intentar darle el mismo rango que a T1.
  await setDoc(doc(c.firestore(), trabajo("T12")), { tipo: "etiquetas_lote", impresoraId: "I3", estado: "pendiente",
    origen: "admin", creadoPor: "a1", cantidad: 20 });
});
const dosConElMismoRango = (db, uid) => {
  const b = writeBatch(db);
  const rango = { estado: "imprimiendo", tomadoPor: uid, tomadoEn: serverTimestamp(), desde: 101, hasta: 120 };
  b.update(doc(db, trabajo("T1")), rango);
  b.update(doc(db, trabajo("T12")), rango);
  b.update(doc(db, CONTADOR), { ultimo: 120, trabajoId: "T1" });
  return b.commit();
};
await check("el programa NO sube el contador con una orden que no toma en la misma escritura", "fail", updateDoc(doc(pc3, CONTADOR), { ultimo: 120, trabajoId: "T1" }));
await check("el programa NO pone en el contador el id de otra orden", "fail", tomar(pc3, "enl_I3_pc03", "T1", { desde: 101, hasta: 120 }, 120, "T3"));
await check("el programa NO da el mismo rango a dos órdenes en una escritura", "fail", dosConElMismoRango(pc3, "enl_I3_pc03"));
await env.withSecurityRulesDisabled(async (c) => {
  const b = writeBatch(c.firestore());
  b.delete(doc(c.firestore(), trabajo("T12")));
  await b.commit();
});
await check("otra impresora NO toma la orden", "fail", tomar(pc1, UID_P1, "T1", { desde: 101, hasta: 120 }, 120));
await check("el programa NO toma una de lote sin apartar números", "fail", tomar(pc3, "enl_I3_pc03", "T1", {}));
await check("el programa NO aparta números que no siguen al contador", "fail", tomar(pc3, "enl_I3_pc03", "T1", { desde: 90, hasta: 109 }, 109));
await check("el programa NO aparta más números de los que pide la orden", "fail", tomar(pc3, "enl_I3_pc03", "T1", { desde: 101, hasta: 125 }, 125));
await check("el programa NO aparta sin subir el contador", "fail", tomar(pc3, "enl_I3_pc03", "T1", { desde: 101, hasta: 120 }));
await check("el programa NO toma a nombre de otra sesión", "fail", tomar(pc3, "otro", "T1", { desde: 101, hasta: 120 }, 120));
await check("el programa toma la orden y aparta 101 a 120 subiendo el contador", "ok", tomar(pc3, "enl_I3_pc03", "T1", { desde: 101, hasta: 120 }, 120));
await check("el programa NO reusa una orden ya tomada para subir el contador", "fail", updateDoc(doc(pc3, CONTADOR), { ultimo: 140, trabajoId: "T1" }));
await check("el programa NO cambia la cantidad", "fail", updateDoc(doc(pc3, trabajo("T1")), { cantidad: 60 }));
await check("el programa NO cambia sus números al terminar", "fail", updateDoc(doc(pc3, trabajo("T1")), { estado: "impreso", terminadoEn: serverTimestamp(), impresiones: 1, desde: 1 }));
await check("el programa la marca impresa", "ok", updateDoc(doc(pc3, trabajo("T1")), { estado: "impreso", terminadoEn: serverTimestamp(), impresiones: 1 }));
await check("el teléfono NO marca su orden impresa", "fail", updateDoc(doc(armar, trabajo("T1")), { estado: "error", error: "x" }));
await check("el teléfono NO deja texto en el error al reimprimir", "fail", updateDoc(doc(armar, trabajo("T1")), { estado: "pendiente", error: "x" }));
await check("el teléfono la manda a reimprimir", "ok", updateDoc(doc(armar, trabajo("T1")), { estado: "pendiente" }));
await check("al reimprimir NO se apartan números nuevos", "fail", tomar(pc3, "enl_I3_pc03", "T1", { desde: 121, hasta: 140 }, 140));
await check("al reimprimir el programa la toma con sus mismos números", "ok", tomar(pc3, "enl_I3_pc03", "T1", {}));
await check("y cuenta una impresión más", "ok", updateDoc(doc(pc3, trabajo("T1")), { estado: "impreso", terminadoEn: serverTimestamp(), impresiones: 2 }));
await check("el programa toma la de admin (121 a 420)", "ok", tomar(pc3, "enl_I3_pc03", "T3", { desde: 121, hasta: 420 }, 420));
await check("el programa NO deja un error enorme", "fail", updateDoc(doc(pc3, trabajo("T3")), { estado: "error", terminadoEn: serverTimestamp(), error: "x".repeat(301) }));
await check("el programa la marca con error", "ok", updateDoc(doc(pc3, trabajo("T3")), { estado: "error", terminadoEn: serverTimestamp(), error: "Sin papel" }));
await check("la caja NO toma órdenes", "fail", tomar(nodo1, "n1", "T5", {}));
await check("el programa de la sucursal toma la orden de precio (sin números)", "ok", tomar(pc1, UID_P1, "T5", {}));
await check("el programa NO aparta números en una orden de precio", "fail", updateDoc(doc(pc1, trabajo("T5")), { estado: "impreso", terminadoEn: serverTimestamp(), impresiones: 1, desde: 1, hasta: 2 }));
await check("el programa la marca impresa", "ok", updateDoc(doc(pc1, trabajo("T5")), { estado: "impreso", terminadoEn: serverTimestamp(), impresiones: 1 }));
await check("la caja de otra sucursal NO la reimprime", "fail", updateDoc(doc(nodo2, trabajo("T5")), { estado: "pendiente" }));
await check("la caja la manda a reimprimir", "ok", updateDoc(doc(nodo1, trabajo("T5")), { estado: "pendiente" }));

// Una que se quedó "imprimiendo" (la PC se apagó): admin la libera.
await env.withSecurityRulesDisabled(async (c) => {
  await setDoc(doc(c.firestore(), trabajo("T7")), { tipo: "etiquetas_lote", impresoraId: "I3", estado: "imprimiendo", origen: "admin",
    creadoPor: "a1", cantidad: 5, desde: 421, hasta: 425, tomadoPor: "enl_I3_vieja" });
});
await check("el programa NO termina una que tomó otra sesión", "fail", updateDoc(doc(pc3, trabajo("T7")), { estado: "impreso", terminadoEn: serverTimestamp(), impresiones: 1 }));
await check("admin libera una que se quedó imprimiendo", "ok", updateDoc(doc(admin, trabajo("T7")), { estado: "error", error: "Se interrumpió" }));
await check("admin NO la reimprime dejando su error", "fail", updateDoc(doc(admin, trabajo("T7")), { estado: "pendiente" }));
await check("admin la manda a reimprimir", "ok", updateDoc(doc(admin, trabajo("T7")), { estado: "pendiente", error: deleteField() }));
await check("el teléfono NO cancela una orden en cola", "fail", updateDoc(doc(armar, trabajo("T7")), { estado: "error", error: "x" }));
await check("admin cancela una orden en cola", "ok", updateDoc(doc(admin, trabajo("T7")), { estado: "error", error: "Se canceló en admin" }));
await check("admin NO marca impresa una orden", "fail", updateDoc(doc(admin, trabajo("T7")), { estado: "impreso" }));

// "Reimprimir" solo a una impresora que existe y está prendida (si no, la
// orden se quedaría en la cola para siempre).
await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  const conError = (impresoraId, extra = {}) => ({ tipo: "etiquetas_lote", impresoraId, estado: "error", origen: "admin",
    creadoPor: "a1", cantidad: 2, desde: 426, hasta: 427, error: "La impresora no respondió", ...extra });
  await setDoc(doc(db, trabajo("T9")), conError("I2"));
  await setDoc(doc(db, trabajo("T10")), conError("I2", { origen: "enlace", creadoPor: UID_ARMAR, enlaceId: "E1" }));
  await setDoc(doc(db, trabajo("T11")), conError("BORRADA"));
});
await check("admin NO reimprime a una impresora apagada", "fail", updateDoc(doc(admin, trabajo("T9")), { estado: "pendiente", error: deleteField() }));
await check("el teléfono NO reimprime a una impresora apagada", "fail", updateDoc(doc(armar, trabajo("T10")), { estado: "pendiente", error: deleteField() }));
await check("admin NO reimprime a una impresora que ya se borró", "fail", updateDoc(doc(admin, trabajo("T11")), { estado: "pendiente", error: deleteField() }));
await check("el programa pregunta por una orden que admin ya borró", "ok", getDoc(doc(pc3, trabajo("NO_EXISTE"))));

// Sin contador todavía: el programa lo crea al tomar la primera orden.
await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  await setDoc(doc(db, trabajo("T8")), { tipo: "etiquetas_lote", impresoraId: "I3", estado: "pendiente", origen: "admin",
    creadoPor: "a1", cantidad: 5 });
  const b = writeBatch(db);
  b.delete(doc(db, CONTADOR));
  await b.commit();
});
const tomarCreando = (db, uid, id, campos, ultimo) => {
  const b = writeBatch(db);
  b.update(doc(db, trabajo(id)), { estado: "imprimiendo", tomadoPor: uid, tomadoEn: serverTimestamp(), ...campos });
  b.set(doc(db, CONTADOR), { ultimo, trabajoId: id });
  return b.commit();
};
await check("sin contador NO lo crea sin decir de qué orden", "fail", (() => {
  const b = writeBatch(pc3);
  b.update(doc(pc3, trabajo("T8")), { estado: "imprimiendo", tomadoPor: "enl_I3_pc03", tomadoEn: serverTimestamp(), desde: 1, hasta: 5 });
  b.set(doc(pc3, CONTADOR), { ultimo: 5 });
  return b.commit();
})());
await check("sin contador NO empieza en otro número que 1", "fail", tomarCreando(pc3, "enl_I3_pc03", "T8", { desde: 2, hasta: 6 }, 6));
await check("sin contador el programa lo crea y aparta 1 a 5", "ok", tomarCreando(pc3, "enl_I3_pc03", "T8", { desde: 1, hasta: 5 }, 5));

// ============ Página aparte de etiquetas de precio (acceso `precio`) ============
// Un código de 8 dígitos con su precio y cuántas, como la app "codigos".
await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  const e = (extra) => ({ activo: true, gen: 0, secretoHash: HASH, creadoPor: "a1", tipo: "precio", ...extra });
  await setDoc(doc(db, acceso("P1")), e({ nombre: "Mostrador" }));
  await setDoc(doc(db, acceso("P2")), e({ nombre: "Apagado", activo: false }));
  await setDoc(doc(db, acceso("P3")), e({ nombre: "Otro mostrador" }));
  await setDoc(doc(db, acceso("PG")), e({ nombre: "Renovado", gen: 1 }));
});
const UID_PRECIO = "enl_P1_pppp";
const precio = ctx(UID_PRECIO, enlace("P1", "precio"));
const precioB = ctx("enl_P3_qqqq", enlace("P3", "precio"));
const precioApagado = ctx("enl_P2_xxxx", enlace("P2", "precio"));
const precioGenVieja = ctx("enl_PG_yyyy", enlace("PG", "precio"));
const dePagina = (renglon, extra = {}) =>
  orden({ tipo: "etiquetas_precio", impresoraId: "I3", origen: "enlace", creadoPor: UID_PRECIO, enlaceId: "P1",
    quien: "Mostrador", renglones: [renglon], ...extra });
const R = { codigo: "12345678", precio: "150", piezas: 3 };

await check("admin crea un acceso de etiquetas de precio", "ok", setDoc(doc(admin, acceso("P9")), accesoNuevo({ tipo: "precio", nombre: "Mostrador 2" })));
await check("caja NO crea un acceso de etiquetas de precio", "fail", setDoc(doc(nodo1, acceso("P8")), accesoNuevo({ tipo: "precio", creadoPor: "n1", sucursalId: S1 })));
await check("mercancia NO crea un acceso de etiquetas de precio", "fail", setDoc(doc(merc, acceso("P8")), accesoNuevo({ tipo: "precio", creadoPor: "m1" })));
await check("la página de precio lee las impresoras", "ok", getDocs(collection(precio, `${N}/impresoras_web_new_version`)));
await check("la página de precio apagada NO lee impresoras", "fail", getDoc(doc(precioApagado, impresora("I3"))));
await check("la página de precio de un acceso renovado NO lee impresoras", "fail", getDoc(doc(precioGenVieja, impresora("I3"))));

await check("la página manda un código con su precio", "ok", setDoc(doc(precio, trabajo("TP1")), dePagina(R)));
await check("la página manda precio con centavos y 100 piezas", "ok", setDoc(doc(precio, trabajo("TP2")), dePagina({ codigo: "00000001", precio: "99.50", piezas: 100 })));
await check("la página NO manda sin código", "fail", setDoc(doc(precio, trabajo("TP9")), dePagina({ precio: "150", piezas: 1 })));
await check("la página NO manda un código de 7 dígitos", "fail", setDoc(doc(precio, trabajo("TP9")), dePagina({ ...R, codigo: "1234567" })));
await check("la página NO manda un código de 9 dígitos", "fail", setDoc(doc(precio, trabajo("TP9")), dePagina({ ...R, codigo: "123456789" })));
await check("la página NO manda un código con letras", "fail", setDoc(doc(precio, trabajo("TP9")), dePagina({ ...R, codigo: "1234567A" })));
await check("la página NO manda un precio con coma", "fail", setDoc(doc(precio, trabajo("TP9")), dePagina({ ...R, precio: "1,500" })));
await check("la página NO manda un precio con 3 decimales", "fail", setDoc(doc(precio, trabajo("TP9")), dePagina({ ...R, precio: "1.505" })));
await check("la página NO manda un precio vacío", "fail", setDoc(doc(precio, trabajo("TP9")), dePagina({ ...R, precio: "" })));
await check("la página NO manda el precio como número", "fail", setDoc(doc(precio, trabajo("TP9")), dePagina({ ...R, precio: 150 })));
await check("la página NO manda 0 piezas", "fail", setDoc(doc(precio, trabajo("TP9")), dePagina({ ...R, piezas: 0 })));
await check("la página NO manda más de 100 piezas", "fail", setDoc(doc(precio, trabajo("TP9")), dePagina({ ...R, piezas: 101 })));
await check("la página NO manda piezas como texto", "fail", setDoc(doc(precio, trabajo("TP9")), dePagina({ ...R, piezas: "3" })));
await check("la página NO manda otros campos en el renglón", "fail", setDoc(doc(precio, trabajo("TP9")), dePagina({ ...R, nombre: "Blusa" })));
await check("la página NO manda dos renglones", "fail", setDoc(doc(precio, trabajo("TP9")), dePagina(R, { renglones: [R, R] })));
await check("la página NO manda sin renglones", "fail", setDoc(doc(precio, trabajo("TP9")), dePagina(R, { renglones: [] })));
await check("la página NO manda a una impresora apagada", "fail", setDoc(doc(precio, trabajo("TP9")), dePagina(R, { impresoraId: "I2" })));
await check("la página NO manda a una impresora que no existe", "fail", setDoc(doc(precio, trabajo("TP9")), dePagina(R, { impresoraId: "NADA" })));
await check("la página NO manda a nombre de otro acceso", "fail", setDoc(doc(precio, trabajo("TP9")), dePagina(R, { enlaceId: "P3" })));
await check("la página NO manda a nombre de otra sesión", "fail", setDoc(doc(precio, trabajo("TP9")), dePagina(R, { creadoPor: "otro" })));
await check("la página NO dice que viene de la caja", "fail", setDoc(doc(precio, trabajo("TP9")), dePagina(R, { origen: "nodo" })));
await check("la página NO la crea ya impresa", "fail", setDoc(doc(precio, trabajo("TP9")), dePagina(R, { estado: "impreso" })));
await check("la página NO falsea la hora", "fail", setDoc(doc(precio, trabajo("TP9")), dePagina(R, { creadoEn: new Date(2020, 0, 1) })));
await check("la página NO pide etiquetas de lote", "fail", setDoc(doc(precio, trabajo("TP9")),
  orden({ tipo: "etiquetas_lote", impresoraId: "I3", origen: "enlace", creadoPor: UID_PRECIO, cantidad: 5, enlaceId: "P1" })));
await check("la página apagada NO manda", "fail", setDoc(doc(precioApagado, trabajo("TP9")),
  dePagina(R, { creadoPor: "enl_P2_xxxx", enlaceId: "P2" })));
await check("la página de un acceso renovado NO manda", "fail", setDoc(doc(precioGenVieja, trabajo("TP9")),
  dePagina(R, { creadoPor: "enl_PG_yyyy", enlaceId: "PG" })));
await check("el teléfono de armar NO usa la orden de la página", "fail", setDoc(doc(armar, trabajo("TP9")),
  dePagina(R, { creadoPor: UID_ARMAR, enlaceId: "E1" })));

await check("la página ve su orden", "ok", getDoc(doc(precio, trabajo("TP1"))));
await check("la página lista sus órdenes abiertas", "ok", getDocs(query(collection(precio, COLA), where("enlaceId", "==", "P1"),
  where("estado", "in", ["pendiente", "imprimiendo", "error"]))));
await check("la página pregunta por una orden que no existe", "ok", getDoc(doc(precio, trabajo("NO_EXISTE"))));
await check("la página NO lista toda la cola", "fail", getDocs(collection(precio, COLA)));
await check("la página NO ve la orden del teléfono", "fail", getDoc(doc(precio, trabajo("T10"))));
await check("otra página NO ve la orden", "fail", getDoc(doc(precioB, trabajo("TP1"))));
await check("el teléfono de armar NO ve la orden de la página", "fail", getDoc(doc(armar, trabajo("TP1"))));
await check("la página apagada NO ve su orden", "fail", getDoc(doc(precioApagado, trabajo("TP1"))));

await check("la página NO toma su orden", "fail", tomar(precio, UID_PRECIO, "TP1", {}));
await check("el programa toma la orden de la página (sin números)", "ok", tomar(pc3, "enl_I3_pc03", "TP1", {}));
await check("el programa la marca con error", "ok", updateDoc(doc(pc3, trabajo("TP1")), { estado: "error", terminadoEn: serverTimestamp(), error: "Sin papel" }));
await check("otra página NO la reimprime", "fail", updateDoc(doc(precioB, trabajo("TP1")), { estado: "pendiente", error: deleteField() }));
await check("la página NO cambia el renglón al reimprimir", "fail", updateDoc(doc(precio, trabajo("TP1")), { estado: "pendiente", error: deleteField(), renglones: [{ ...R, piezas: 100 }] }));
await check("la página NO deja un error enorme al reimprimir", "fail", updateDoc(doc(precio, trabajo("TP1")), { estado: "pendiente", error: "x".repeat(5000) }));
await check("la página NO deja un mapa en el error al reimprimir", "fail", updateDoc(doc(precio, trabajo("TP1")), { estado: "pendiente", error: { a: 1 } }));
await check("la página la manda a reimprimir", "ok", updateDoc(doc(precio, trabajo("TP1")), { estado: "pendiente", error: deleteField() }));
await check("la página NO reimprime la orden del teléfono", "fail", updateDoc(doc(precio, trabajo("T10")), { estado: "pendiente", error: deleteField() }));
await check("la página NO cancela una orden en cola", "fail", updateDoc(doc(precio, trabajo("TP2")), { estado: "error", error: "x" }));
await check("la página NO borra órdenes", "fail", deleteDoc(doc(precio, trabajo("TP2"))));
await check("la página NO lee el contador", "fail", getDoc(doc(precio, CONTADOR)));
await check("la página NO lee los accesos", "fail", getDoc(doc(precio, acceso("P1"))));

// Lo de antes sigue igual.
await check("caja sigue escribiendo su huella", "ok", setDoc(doc(nodo1, `${N}/datos_web_new_version/articulos_ac`), { huella: "h2" }));
await check("caja NO avanza el contador de etiquetas", "fail", updateDoc(doc(nodo1, CONTADOR), { ultimo: 6 }));
await check("el teléfono NO borra órdenes", "fail", deleteDoc(doc(armar, trabajo("T1"))));
await check("el programa NO borra órdenes", "fail", deleteDoc(doc(pc3, trabajo("T1"))));
await check("admin borra órdenes viejas", "ok", deleteDoc(doc(admin, trabajo("T1"))));

let ok = true;
for (const [pass, name] of res) { console.log((pass ? "PASS" : "FALLA") + "  " + name); if (!pass) ok = false; }
await env.cleanup();
console.log(ok ? `\nOK: ${res.length}/${res.length} reglas de impresión verificadas` : `\nFALLAS presentes`);
process.exit(ok ? 0 : 1);
