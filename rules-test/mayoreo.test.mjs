// Pruebas de las reglas del REGISTRO DE MAYOREO: el encargado de tienda (rol
// `encargado`, solo lectura), los precios por categoría (`_preciosMayoreo`,
// solo admin), el registro de movimientos de existencias (solo la CF), la
// bodega de tienda que escribe la caja y las etiquetas de precio de admin
// (../firestore.rules.candidata, igual a ../firestore.rules).
//
// Correr (desde rules-test/):
//   npx firebase emulators:exec --project demo-test --only firestore "node mayoreo.test.mjs"
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { readFileSync } from "node:fs";

const RULES = readFileSync(new URL("../firestore.rules.candidata", import.meta.url), "utf8");
const NID = "amise", S1 = "suc1", S2 = "suc2";

const env = await initializeTestEnvironment({
  projectId: "demo-test",
  firestore: { rules: RULES, host: "127.0.0.1", port: 8155 },
});
await env.clearFirestore();

const ctx = (uid, claims) => env.authenticatedContext(uid, claims).firestore();
const anon = env.unauthenticatedContext().firestore();
const admin = ctx("a1", { role: "admin", negocioId: NID });
const merc1 = ctx("m1", { role: "mercancia", negocioId: NID, sucursalId: S1, mercanciaUid: "m1" });
const merc2 = ctx("m2", { role: "mercancia", negocioId: NID, sucursalId: S2, mercanciaUid: "m2" });
const nodo2 = ctx("n2", { role: "nodo", negocioId: NID, sucursalId: S2, nodoId: "n2" });
const encargado = ctx("e2", { role: "encargado", negocioId: NID, sucursalId: S2, mercanciaUid: "e2" });
const encargadoOtroNegocio = ctx("e9", { role: "encargado", negocioId: "otro", sucursalId: S2, mercanciaUid: "e9" });

const N = `negocios_web_new_version/${NID}`;
const articulo = (id) => `${N}/articulos_n_web_new_version/${id}`;
const dato = (k) => `${N}/datos_web_new_version/${k}`;
const movimiento = (sid, id) =>
  `${N}/sucursales_data_web_new_version/${sid}/movimientos_existencias_web_new_version/${id}`;
const trabajo = (id) => `${N}/impresiones_web_new_version/${id}`;
const PRECIOS = dato("_preciosMayoreo");
const HASH = "a".repeat(64);

await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  await setDoc(doc(db, articulo("12300010")), {
    id: "12300010", nombre: "Metálico 1", soloMayoreo: true, categoriaId: "llavero",
    subcategoriaId: "metalico", precioVenta: "22", precioMenudeo: "30", cantidad: "0",
    cantidadPorSucursal: { [S2]: "4" }, cantidadBodegaSucursal: { [S2]: "10" },
  });
  await setDoc(doc(db, `${N}/categorias_web_new_version/llavero`), { categoriaId: "llavero", nombre: "Llavero" });
  await setDoc(doc(db, `${N}/subcategorias_web_new_version/metalico`), { subcategoriaId: "metalico", nombre: "Metálico", categoriaId: "llavero" });
  await setDoc(doc(db, `${N}/generos_web_new_version/anime`), { generoId: "anime", nombre: "Anime" });
  await setDoc(doc(db, PRECIOS), { categorias: { llavero: { precio: 22, menudeo: 30 } } });
  await setDoc(doc(db, dato("tallas")), { grupos: [] });
  await setDoc(doc(db, movimiento(S2, "mov_a")), { movimientoId: "mov_a", sucursalId: S2, usuarioId: "e2", piezas: 3 });
  await setDoc(doc(db, movimiento(S1, "mov_b")), { movimientoId: "mov_b", sucursalId: S1, usuarioId: "x", piezas: 1 });
  await setDoc(doc(db, `${N}/sucursales_data_web_new_version/${S2}/usuariosMercancia_web_new_version/e2`), { nombre: "Ana", pinHash: HASH, habilitado: true, acceso: "existencias" });
  await setDoc(doc(db, `${N}/enlaces_lote_web_new_version/I1`), { tipo: "imprimir", activo: true, gen: 0, secretoHash: HASH, creadoPor: "a1" });
  await setDoc(doc(db, `${N}/impresoras_web_new_version/I1`), { nombre: "Taller" });
  await setDoc(doc(db, `${N}/resurtidos_web_new_version/R1`), { resurtidoId: "R1", sucursalDestinoId: S2, estado: "enviado" });
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

// ============ Encargado de tienda: solo lectura del catálogo ============
await check("encargado lee un artículo", "ok", getDoc(doc(encargado, articulo("12300010"))));
await check("encargado lista los artículos", "ok", getDocs(collection(encargado, `${N}/articulos_n_web_new_version`)));
await check("encargado lee categorías", "ok", getDocs(collection(encargado, `${N}/categorias_web_new_version`)));
await check("encargado lee subcategorías", "ok", getDocs(collection(encargado, `${N}/subcategorias_web_new_version`)));
await check("encargado lee géneros", "ok", getDocs(collection(encargado, `${N}/generos_web_new_version`)));
await check("encargado lee su negocio y sus sucursales", "ok", getDoc(doc(encargado, N)));
await check("encargado de OTRO negocio NO lee los artículos", "fail", getDoc(doc(encargadoOtroNegocio, articulo("12300010"))));
await check("anon NO lee los artículos", "fail", getDoc(doc(anon, articulo("12300010"))));

// ============ Encargado de tienda: no escribe NADA ============
await check("encargado NO aumenta la tienda", "fail", updateDoc(doc(encargado, articulo("12300010")), { cantidadPorSucursal: { [S2]: "99" } }));
await check("encargado NO aumenta la bodega", "fail", updateDoc(doc(encargado, articulo("12300010")), { cantidadBodegaSucursal: { [S2]: "99" } }));
await check("encargado NO mueve por su cuenta (ni conservando el total)", "fail", updateDoc(doc(encargado, articulo("12300010")), { cantidadPorSucursal: { [S2]: "5" }, cantidadBodegaSucursal: { [S2]: "9" } }));
await check("encargado NO cambia precios", "fail", updateDoc(doc(encargado, articulo("12300010")), { precioVenta: "1" }));
await check("encargado NO crea artículos", "fail", setDoc(doc(encargado, articulo("12300099")), { id: "12300099", nombre: "X" }));
await check("encargado NO borra artículos", "fail", deleteDoc(doc(encargado, articulo("12300010"))));
await check("encargado NO crea categorías", "fail", setDoc(doc(encargado, `${N}/categorias_web_new_version/x`), { nombre: "X" }));
await check("encargado NO crea subcategorías", "fail", setDoc(doc(encargado, `${N}/subcategorias_web_new_version/x`), { nombre: "X", categoriaId: "llavero" }));
await check("encargado NO escribe datos (tallas)", "fail", setDoc(doc(encargado, dato("tallas")), { grupos: [1] }));
await check("encargado NO escribe el contador de artículos", "fail", setDoc(doc(encargado, dato("_contadorArticulos")), { ultimoId: "1" }));
await check("encargado NO se cambia el acceso", "fail", updateDoc(doc(encargado, `${N}/sucursales_data_web_new_version/${S2}/usuariosMercancia_web_new_version/e2`), { acceso: "completo" }));

// ============ Encargado de tienda: lo que no le toca ver ============
await check("encargado NO lee los usuarios de mercancía", "fail", getDoc(doc(encargado, `${N}/sucursales_data_web_new_version/${S2}/usuariosMercancia_web_new_version/e2`)));
await check("encargado NO lee los precios por categoría", "fail", getDoc(doc(encargado, PRECIOS)));
await check("encargado NO lee las ventas", "fail", getDocs(collection(encargado, `${N}/sucursales_data_web_new_version/${S2}/ventas_n_web_new_version`)));
await check("encargado NO lee resurtidos", "fail", getDoc(doc(encargado, `${N}/resurtidos_web_new_version/R1`)));
await check("encargado NO lee impresoras", "fail", getDoc(doc(encargado, `${N}/impresoras_web_new_version/I1`)));
await check("encargado NO lee la cola de impresión", "fail", getDocs(collection(encargado, `${N}/impresiones_web_new_version`)));
await check("encargado NO lee los accesos por enlace", "fail", getDoc(doc(encargado, `${N}/enlaces_lote_web_new_version/I1`)));

// ============ Movimientos de existencias: solo la CF escribe ============
await check("encargado lee los movimientos de SU tienda", "ok", getDocs(collection(encargado, `${N}/sucursales_data_web_new_version/${S2}/movimientos_existencias_web_new_version`)));
await check("encargado NO lee los de otra tienda", "fail", getDoc(doc(encargado, movimiento(S1, "mov_b"))));
await check("encargado NO crea un movimiento", "fail", setDoc(doc(encargado, movimiento(S2, "mov_x")), { movimientoId: "mov_x", piezas: 1 }));
await check("encargado NO cambia un movimiento", "fail", updateDoc(doc(encargado, movimiento(S2, "mov_a")), { usuarioNombre: "Otro" }));
await check("encargado NO borra un movimiento", "fail", deleteDoc(doc(encargado, movimiento(S2, "mov_a"))));
await check("admin lee los movimientos", "ok", getDoc(doc(admin, movimiento(S2, "mov_a"))));
await check("admin NO escribe movimientos", "fail", setDoc(doc(admin, movimiento(S2, "mov_y")), { movimientoId: "mov_y" }));
await check("admin NO borra movimientos", "fail", deleteDoc(doc(admin, movimiento(S2, "mov_a"))));
await check("mercancía de esa tienda lee sus movimientos", "ok", getDoc(doc(merc2, movimiento(S2, "mov_a"))));
await check("mercancía de otra tienda NO los lee", "fail", getDoc(doc(merc1, movimiento(S2, "mov_a"))));
await check("mercancía NO escribe movimientos", "fail", setDoc(doc(merc2, movimiento(S2, "mov_z")), { movimientoId: "mov_z" }));
await check("la caja NO lee los movimientos", "fail", getDoc(doc(nodo2, movimiento(S2, "mov_a"))));
await check("la caja NO escribe movimientos", "fail", setDoc(doc(nodo2, movimiento(S2, "mov_w")), { movimientoId: "mov_w" }));

// ============ Precios de mayoreo por categoría: solo admin ============
await check("admin escribe los precios por categoría", "ok", setDoc(doc(admin, PRECIOS), { categorias: { llavero: { precio: 25, menudeo: 32 } }, subcategorias: {} }));
await check("mercancía lee los precios por categoría", "ok", getDoc(doc(merc1, PRECIOS)));
await check("la caja lee los precios por categoría", "ok", getDoc(doc(nodo2, PRECIOS)));
await check("mercancía NO escribe los precios por categoría", "fail", setDoc(doc(merc1, PRECIOS), { categorias: { llavero: { precio: 1, menudeo: 2 } } }));
await check("mercancía NO borra los precios por categoría", "fail", deleteDoc(doc(merc1, PRECIOS)));
await check("la caja NO escribe los precios por categoría", "fail", setDoc(doc(nodo2, PRECIOS), { categorias: {} }));
await check("mercancía sigue escribiendo tallas", "ok", setDoc(doc(merc1, dato("tallas")), { grupos: ["a"] }));
await check("la caja sigue escribiendo su huella", "ok", setDoc(doc(nodo2, dato("articulos_ac")), { huella: "h1" }));

// ============ Bodega de tienda desde la caja (lote que entra a bodega) ============
await check("la caja suma a la bodega de tienda", "ok", updateDoc(doc(nodo2, articulo("12300010")), { cantidadBodegaSucursal: { [S2]: "15" } }));
await check("la caja sigue ajustando la tienda", "ok", updateDoc(doc(nodo2, articulo("12300010")), { cantidadPorSucursal: { [S2]: "3" } }));
await check("la caja NO cambia precios junto con la bodega", "fail", updateDoc(doc(nodo2, articulo("12300010")), { cantidadBodegaSucursal: { [S2]: "16" }, precioVenta: "1" }));
await check("la caja NO marca precio propio", "fail", updateDoc(doc(nodo2, articulo("12300010")), { precioPropio: true }));

// ============ Etiquetas de precio desde admin ============
const orden = (extra = {}) => ({
  tipo: "etiquetas_precio", impresoraId: "I1", estado: "pendiente", origen: "admin",
  creadoPor: "a1", quien: "admin", creadoEn: serverTimestamp(),
  renglones: [{ codigo: "12300010", precio: "22", piezas: 2 }],
  ...extra,
});
await check("admin manda etiquetas de precio", "ok", setDoc(doc(admin, trabajo("TA1")), orden()));
await check("admin NO manda más de 20 renglones", "fail", setDoc(doc(admin, trabajo("TA2")), orden({ renglones: Array.from({ length: 21 }, () => ({ codigo: "12300010", precio: "22", piezas: 1 })) })));
await check("admin NO manda etiquetas de precio sin renglones", "fail", setDoc(doc(admin, trabajo("TA3")), orden({ renglones: [] })));
await check("admin NO la manda como si fuera la caja", "fail", setDoc(doc(admin, trabajo("TA4")), orden({ origen: "nodo" })));
await check("admin NO la manda ya impresa", "fail", setDoc(doc(admin, trabajo("TA5")), orden({ estado: "impreso" })));
await check("admin NO la manda a una impresora que no existe", "fail", setDoc(doc(admin, trabajo("TA6")), orden({ impresoraId: "NOPE" })));
await check("encargado NO manda etiquetas", "fail", setDoc(doc(encargado, trabajo("TE1")), orden({ creadoPor: "e2" })));
await check("mercancía NO manda etiquetas de precio", "fail", setDoc(doc(merc1, trabajo("TM1")), orden({ creadoPor: "m1" })));

// ============ Lo de antes sigue igual ============
await check("mercancía sigue editando artículos", "ok", updateDoc(doc(merc1, articulo("12300010")), { nombre: "Metálico 1b" }));
await check("admin sigue editando artículos", "ok", updateDoc(doc(admin, articulo("12300010")), { precioPropio: true, precioVenta: "50", precioMenudeo: "60" }));
await check("la caja NO cambia el nombre", "fail", updateDoc(doc(nodo2, articulo("12300010")), { nombre: "X" }));

let ok = true;
for (const [pass, name] of res) { console.log((pass ? "PASS" : "FALLA") + "  " + name); if (!pass) ok = false; }
await env.cleanup();
console.log(ok ? `\nOK: ${res.length}/${res.length} reglas de mayoreo verificadas` : `\nFALLAS presentes`);
process.exit(ok ? 0 : 1);
