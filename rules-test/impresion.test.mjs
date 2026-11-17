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
await check("otro teléfono NO ve la orden", "fail", getDoc(doc(armarB, trabajo("T1"))));
await check("la caja ve la orden de su sucursal", "ok", getDoc(doc(nodo1, trabajo("T5"))));
await check("la caja de otra sucursal NO la ve", "fail", getDoc(doc(nodo2, trabajo("T5"))));
await check("el programa lista las órdenes pendientes de su impresora", "ok", getDocs(query(collection(pc3, COLA), where("impresoraId", "==", "I3"), where("estado", "==", "pendiente"))));
await check("el programa NO lista toda la cola", "fail", getDocs(collection(pc3, COLA)));
await check("el programa NO ve órdenes de otra impresora", "fail", getDoc(doc(pc3, trabajo("T5"))));
await check("admin ve toda la cola", "ok", getDocs(collection(admin, COLA)));

// ============ Cola: el programa toma, aparta números e imprime ============
const tomar = (db, uid, id, campos, contador) => {
  const b = writeBatch(db);
  b.update(doc(db, trabajo(id)), { estado: "imprimiendo", tomadoPor: uid, tomadoEn: serverTimestamp(), ...campos });
  if (contador !== undefined) b.update(doc(db, CONTADOR), { ultimo: contador });
  return b.commit();
};
await check("otra impresora NO toma la orden", "fail", tomar(pc1, UID_P1, "T1", { desde: 101, hasta: 120 }, 120));
await check("el programa NO toma una de lote sin apartar números", "fail", tomar(pc3, "enl_I3_pc03", "T1", {}));
await check("el programa NO aparta números que no siguen al contador", "fail", tomar(pc3, "enl_I3_pc03", "T1", { desde: 90, hasta: 109 }, 109));
await check("el programa NO aparta más números de los que pide la orden", "fail", tomar(pc3, "enl_I3_pc03", "T1", { desde: 101, hasta: 125 }, 125));
await check("el programa NO aparta sin subir el contador", "fail", tomar(pc3, "enl_I3_pc03", "T1", { desde: 101, hasta: 120 }));
await check("el programa NO toma a nombre de otra sesión", "fail", tomar(pc3, "otro", "T1", { desde: 101, hasta: 120 }, 120));
await check("el programa toma la orden y aparta 101 a 120 subiendo el contador", "ok", tomar(pc3, "enl_I3_pc03", "T1", { desde: 101, hasta: 120 }, 120));
await check("el programa NO cambia la cantidad", "fail", updateDoc(doc(pc3, trabajo("T1")), { cantidad: 60 }));
await check("el programa NO cambia sus números al terminar", "fail", updateDoc(doc(pc3, trabajo("T1")), { estado: "impreso", terminadoEn: serverTimestamp(), impresiones: 1, desde: 1 }));
await check("el programa la marca impresa", "ok", updateDoc(doc(pc3, trabajo("T1")), { estado: "impreso", terminadoEn: serverTimestamp(), impresiones: 1 }));
await check("el teléfono NO marca su orden impresa", "fail", updateDoc(doc(armar, trabajo("T1")), { estado: "error", error: "x" }));
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
await check("admin la manda a reimprimir", "ok", updateDoc(doc(admin, trabajo("T7")), { estado: "pendiente", error: deleteField() }));

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
  b.set(doc(db, CONTADOR), { ultimo });
  return b.commit();
};
await check("sin contador NO empieza en otro número que 1", "fail", tomarCreando(pc3, "enl_I3_pc03", "T8", { desde: 2, hasta: 6 }, 6));
await check("sin contador el programa lo crea y aparta 1 a 5", "ok", tomarCreando(pc3, "enl_I3_pc03", "T8", { desde: 1, hasta: 5 }, 5));

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
