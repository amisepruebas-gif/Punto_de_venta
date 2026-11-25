// Pruebas de las reglas del REGISTRO DE MAYOREO: el encargado de tienda (rol
// `encargado`, solo lectura), los precios por categoría (`_preciosMayoreo`,
// solo admin), el registro de movimientos de existencias (solo la CF), la
// bodega de tienda que escribe la caja, las etiquetas de precio de admin, lo
// que mercancía puede hacer con un artículo «Solo mayoreo» (solo existencias)
// y la sesión de mercancía revisada en vivo (deshabilitada o pasada a
// encargado deja de escribir al instante)
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
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
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
// Sesiones de mercancía que YA NO deben poder escribir aunque su token diga
// `mercancia` (el token se puso al entrar y se renueva solo):
const sesionMerc = (uid, sid = S2) => ctx(uid, { role: "mercancia", negocioId: NID, sucursalId: sid, mercanciaUid: uid });
const mercDeshabilitada = sesionMerc("m3"); // admin la deshabilitó
const mercPasadaAEncargado = sesionMerc("m4"); // admin la pasó a «encargado de tienda»
const mercSinRegistro = sesionMerc("m5"); // admin la borró
const mercDeOtraTienda = sesionMerc("m2", S1); // su registro está en S2, no en S1

const N = `negocios_web_new_version/${NID}`;
const articulo = (id) => `${N}/articulos_n_web_new_version/${id}`;
const dato = (k) => `${N}/datos_web_new_version/${k}`;
const movimiento = (sid, id) =>
  `${N}/sucursales_data_web_new_version/${sid}/movimientos_existencias_web_new_version/${id}`;
const trabajo = (id) => `${N}/impresiones_web_new_version/${id}`;
const usuarioMerc = (sid, uid) =>
  `${N}/sucursales_data_web_new_version/${sid}/usuariosMercancia_web_new_version/${uid}`;
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
  await setDoc(doc(db, usuarioMerc(S2, "e2")), { nombre: "Ana", pinHash: HASH, habilitado: true, acceso: "existencias" });
  // Registros de las sesiones de mercancía (las reglas los leen en vivo).
  await setDoc(doc(db, usuarioMerc(S1, "m1")), { nombre: "Uno", pinHash: HASH, habilitado: true });
  await setDoc(doc(db, usuarioMerc(S2, "m2")), { nombre: "Dos", pinHash: HASH, habilitado: true, acceso: "completo" });
  await setDoc(doc(db, usuarioMerc(S2, "m3")), { nombre: "Tres", pinHash: HASH, habilitado: false });
  await setDoc(doc(db, usuarioMerc(S2, "m4")), { nombre: "Cuatro", pinHash: HASH, habilitado: true, acceso: "existencias" });
  // Un artículo normal (no de mayoreo) y 30 más para el resurtido grande.
  await setDoc(doc(db, articulo("12300020")), { id: "12300020", nombre: "Normal", precioVenta: "10", cantidad: "1", cantidadBodega: "8" });
  for (let i = 0; i < 30; i++) {
    await setDoc(doc(db, articulo(`124000${String(i).padStart(2, "0")}`)), { nombre: `Lote ${i}`, cantidad: "0", cantidadBodega: "5" });
  }
  await setDoc(doc(db, `${N}/resurtidos_web_new_version/RG`), { resurtidoId: "RG", sucursalDestinoId: S2, estado: "creando" });
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
await check("encargado lee SU registro de usuario", "ok", getDoc(doc(encargado, `${N}/sucursales_data_web_new_version/${S2}/usuariosMercancia_web_new_version/e2`)));
await check("encargado NO lee el registro de otro usuario", "fail", getDoc(doc(encargado, `${N}/sucursales_data_web_new_version/${S2}/usuariosMercancia_web_new_version/m2`)));
await check("encargado NO lista los usuarios de mercancía", "fail", getDocs(collection(encargado, `${N}/sucursales_data_web_new_version/${S2}/usuariosMercancia_web_new_version`)));
await check("encargado NO lee usuarios de otra tienda", "fail", getDoc(doc(encargado, `${N}/sucursales_data_web_new_version/${S1}/usuariosMercancia_web_new_version/e2`)));
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
await check("la caja NO marca que hereda precio", "fail", updateDoc(doc(nodo2, articulo("12300010")), { heredaPrecio: true }));

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

// ============ Mercancía y los artículos «Solo mayoreo»: solo existencias ============
const MAY = articulo("12300010"), NORMAL = articulo("12300020");
await check("mercancía NO cambia el precio de uno de mayoreo", "fail", updateDoc(doc(merc2, MAY), { precioVenta: "1" }));
await check("mercancía NO cambia el menudeo de uno de mayoreo", "fail", updateDoc(doc(merc2, MAY), { precioMenudeo: "1" }));
await check("mercancía NO le pone ni le quita la herencia de precio", "fail", updateDoc(doc(merc2, MAY), { heredaPrecio: true }));
await check("mercancía NO cambia el nombre de uno de mayoreo", "fail", updateDoc(doc(merc2, MAY), { nombre: "Otro" }));
await check("mercancía NO lo cambia de categoría", "fail", updateDoc(doc(merc2, MAY), { categoriaId: "otra", subcategoriaId: "x" }));
await check("mercancía NO lo vuelve artículo normal", "fail", updateDoc(doc(merc2, MAY), { soloMayoreo: false }));
await check("mercancía NO cambia precio junto con un ingreso", "fail", updateDoc(doc(merc2, MAY), { cantidadBodega: "9", precioVenta: "1" }));
await check("mercancía NO borra uno de mayoreo", "fail", deleteDoc(doc(merc2, MAY)));
await check("mercancía NO crea uno de mayoreo", "fail", setDoc(doc(merc2, articulo("12300031")), { id: "12300031", nombre: "X", soloMayoreo: true, precioVenta: "1" }));
await check("mercancía NO vuelve de mayoreo uno normal", "fail", updateDoc(doc(merc2, NORMAL), { soloMayoreo: true, precioVenta: "1" }));
await check("mercancía SÍ ingresa piezas a la bodega general de uno de mayoreo", "ok", updateDoc(doc(merc2, MAY), { cantidadBodega: "9" }));
await check("mercancía SÍ ingresa a la tienda y a su bodega", "ok", updateDoc(doc(merc2, MAY), { cantidadPorSucursal: { [S2]: "6" }, cantidadBodegaSucursal: { [S2]: "12" } }));
await check("mercancía SÍ mueve las piezas de sus variaciones", "ok", updateDoc(doc(merc2, MAY), { subvariaciones: [{ codigo: "v-01-abc", nombre: "m1", cantidad: "2" }] }));
await check("mercancía sigue editando un artículo normal", "ok", updateDoc(doc(merc2, NORMAL), { nombre: "Normal b", precioVenta: "12" }));
await check("mercancía sigue creando artículos normales", "ok", setDoc(doc(merc2, articulo("12300021")), { id: "12300021", nombre: "Nuevo", soloMayoreo: false, precioVenta: "5" }));
await check("mercancía sigue borrando artículos normales", "ok", deleteDoc(doc(merc2, articulo("12300021"))));
await check("admin sigue editando los de mayoreo", "ok", updateDoc(doc(admin, MAY), { heredaPrecio: true, precioVenta: "50", precioMenudeo: "60", nombre: "Metálico 1b" }));
await check("admin sigue creando los de mayoreo", "ok", setDoc(doc(admin, articulo("12300032")), { id: "12300032", nombre: "Y", soloMayoreo: true, heredaPrecio: true }));
await check("admin sigue borrando los de mayoreo", "ok", deleteDoc(doc(admin, articulo("12300032"))));
await check("la caja NO cambia el nombre", "fail", updateDoc(doc(nodo2, MAY), { nombre: "X" }));

// ============ Sesión de mercancía: se revisa en vivo al escribir ============
// Lo que una sesión con token `mercancia` puede escribir; ninguna de las
// sesiones que ya no valen debe lograrlo.
const escrituras = (db, tag) => [
  ["edita un artículo normal", updateDoc(doc(db, NORMAL), { nombre: `N ${tag}` })],
  ["ingresa piezas", updateDoc(doc(db, NORMAL), { cantidadBodega: "99" })],
  ["ingresa piezas a uno de mayoreo", updateDoc(doc(db, MAY), { cantidadBodega: "99" })],
  ["crea un artículo", setDoc(doc(db, articulo(`1230009${tag}`)), { nombre: "Z" })],
  ["borra un artículo", deleteDoc(doc(db, NORMAL))],
  ["crea una categoría", setDoc(doc(db, `${N}/categorias_web_new_version/c${tag}`), { nombre: "C" })],
  ["crea una subcategoría", setDoc(doc(db, `${N}/subcategorias_web_new_version/s${tag}`), { nombre: "S", categoriaId: "llavero" })],
  ["crea un género", setDoc(doc(db, `${N}/generos_web_new_version/g${tag}`), { nombre: "G" })],
  ["escribe tallas", setDoc(doc(db, dato("tallas")), { grupos: [tag] })],
  ["escribe la huella de artículos", setDoc(doc(db, dato("articulos_ac")), { huella: tag })],
  ["crea un resurtido", setDoc(doc(db, `${N}/resurtidos_web_new_version/R${tag}`), { estado: "creando" })],
  ["cambia un resurtido", updateDoc(doc(db, `${N}/resurtidos_web_new_version/RG`), { estado: "en_transito" })],
  ["borra un resurtido", deleteDoc(doc(db, `${N}/resurtidos_web_new_version/RG`))],
  ["anota un ingreso de mercancía", setDoc(doc(db, `${N}/ingresos_mercancia_web_new_version/i${tag}`), { delta: 1 })],
];
for (const [quien, db, tag] of [
  ["deshabilitada", mercDeshabilitada, "3"],
  ["pasada a encargado", mercPasadaAEncargado, "4"],
  ["sin registro (borrada)", mercSinRegistro, "5"],
  ["con registro en otra tienda", mercDeOtraTienda, "6"],
]) {
  for (const [que, p] of escrituras(db, tag)) {
    await check(`mercancía ${quien} NO ${que}`, "fail", p);
  }
}
// Leer sí puede mientras le dure el token: la function `cortarSesionMercancia`
// le revoca la sesión y la app la saca; lo que importa (escribir) ya no pasa.
await check("mercancía deshabilitada todavía lee el catálogo (su sesión se corta aparte)", "ok", getDoc(doc(mercDeshabilitada, NORMAL)));
await check("mercancía pasada a encargado todavía lee con su token viejo (su sesión se corta aparte)", "ok", getDoc(doc(mercPasadaAEncargado, PRECIOS)));

// La sesión vigente hace todo lo de siempre.
await check("mercancía vigente crea una categoría", "ok", setDoc(doc(merc2, `${N}/categorias_web_new_version/cv`), { nombre: "C" }));
await check("mercancía vigente crea una subcategoría", "ok", setDoc(doc(merc2, `${N}/subcategorias_web_new_version/sv`), { nombre: "S", categoriaId: "llavero" }));
await check("mercancía vigente crea un género", "ok", setDoc(doc(merc2, `${N}/generos_web_new_version/gv`), { nombre: "G" }));
await check("mercancía vigente escribe la huella de artículos", "ok", setDoc(doc(merc2, dato("articulos_ac")), { huella: "v" }));
await check("mercancía vigente crea un resurtido", "ok", setDoc(doc(merc2, `${N}/resurtidos_web_new_version/Rv`), { estado: "creando" }));
await check("mercancía vigente borra su resurtido", "ok", deleteDoc(doc(merc2, `${N}/resurtidos_web_new_version/Rv`)));
await check("mercancía vigente anota un ingreso de mercancía", "ok", setDoc(doc(merc2, `${N}/ingresos_mercancia_web_new_version/iv`), { delta: 1 }));

// Un resurtido grande: 30 artículos y el resurtido en UNA transacción. Las
// reglas leen el registro de la persona en cada escritura; es el mismo
// documento, así que cuenta una sola vez y no topa el límite de lecturas.
const GRANDES = Array.from({ length: 30 }, (_, i) => articulo(`124000${String(i).padStart(2, "0")}`));
await check("mercancía despacha un resurtido de 30 artículos en una transacción", "ok", runTransaction(merc2, async (tx) => {
  const refs = GRANDES.map((p) => doc(merc2, p));
  const snaps = await Promise.all(refs.map((r) => tx.get(r)));
  snaps.forEach((s, i) => tx.update(refs[i], { cantidadBodega: String(Number(s.data().cantidadBodega) - 1) }));
  tx.update(doc(merc2, `${N}/resurtidos_web_new_version/RG`), { estado: "en_transito" });
}));
{
  const lote = writeBatch(merc2);
  for (const p of GRANDES) lote.update(doc(merc2, p), { cantidadBodega: "9" });
  await check("mercancía escribe 30 artículos en un solo lote", "ok", lote.commit());
}
{
  const lote = writeBatch(mercDeshabilitada);
  for (const p of GRANDES) lote.update(doc(mercDeshabilitada, p), { cantidadBodega: "99" });
  await check("mercancía deshabilitada NO escribe 30 artículos en un lote", "fail", lote.commit());
}

// El corte es inmediato y de ida y vuelta: admin deshabilita y rehabilita.
await env.withSecurityRulesDisabled(async (c) => {
  await updateDoc(doc(c.firestore(), usuarioMerc(S2, "m2")), { habilitado: false });
});
await check("al deshabilitarla, la sesión abierta deja de escribir", "fail", updateDoc(doc(merc2, NORMAL), { nombre: "ya no" }));
await env.withSecurityRulesDisabled(async (c) => {
  await updateDoc(doc(c.firestore(), usuarioMerc(S2, "m2")), { habilitado: true, acceso: "existencias" });
});
await check("al pasarla a encargado, su sesión vieja tampoco escribe", "fail", updateDoc(doc(merc2, NORMAL), { nombre: "ya no" }));
await env.withSecurityRulesDisabled(async (c) => {
  await updateDoc(doc(c.firestore(), usuarioMerc(S2, "m2")), { acceso: "completo" });
});
await check("al regresarle el acceso completo, vuelve a escribir", "ok", updateDoc(doc(merc2, NORMAL), { nombre: "otra vez" }));

let ok = true;
for (const [pass, name] of res) { console.log((pass ? "PASS" : "FALLA") + "  " + name); if (!pass) ok = false; }
await env.cleanup();
console.log(ok ? `\nOK: ${res.length}/${res.length} reglas de mayoreo verificadas` : `\nFALLAS presentes`);
process.exit(ok ? 0 : 1);
