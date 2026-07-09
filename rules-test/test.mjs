import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore";
import { readFileSync } from "node:fs";

const RULES = readFileSync(
  "C:/Users/jesus/Documents/dispositivo_1/firestore.rules.candidata",
  "utf8",
);
const NID = "amise", S1 = "suc1", S2 = "suc2";

const env = await initializeTestEnvironment({
  projectId: "demo-test",
  firestore: { rules: RULES, host: "127.0.0.1", port: 8155 },
});

// --- TODOS los roles reales, con sus claims EXACTAS ---
const anon = env.unauthenticatedContext().firestore();
const nodo1 = env.authenticatedContext("n1", { role: "nodo", negocioId: NID, sucursalId: S1, nodoId: "n1" }).firestore();
const adminC = env.authenticatedContext("a1", { role: "admin", negocioId: NID }).firestore();
const merc = env.authenticatedContext("m1", { role: "mercancia", negocioId: NID, sucursalId: S1, mercanciaUid: "m1" }).firestore();
// superadmin: SIN negocioId (la causa del incidente 09). Debe ser admin GLOBAL.
const supera = env.authenticatedContext("sa", { role: "superadmin" }).firestore();
// colaborador: entra al chat legacy por la RAIZ (Electron), no al arbol moderno.
const colab = env.authenticatedContext("c1", { role: "colaborador", negocioId: NID, colaboradorId: "c1" }).firestore();
// google-sin-claims: apps nativas Android (rol()=null) — solo tocan RAIZ.
const gnodo = env.authenticatedContext("g1", {}).firestore();
const otroNeg = env.authenticatedContext("x1", { role: "nodo", negocioId: "OTRO", sucursalId: S1, nodoId: "x1" }).firestore();

const N = `negocios_web_new_version/${NID}`;
const P = {
  // --- arbol MODERNO ---
  ventaS1: `${N}/sucursales_data_web_new_version/${S1}/ventas_n_web_new_version/2026/07/08/items/V1`,
  ventaS2: `${N}/sucursales_data_web_new_version/${S2}/ventas_n_web_new_version/2026/07/08/items/V2`,
  articulo: `${N}/articulos_n_web_new_version/ART1`,
  usuMerc: `${N}/sucursales_data_web_new_version/${S1}/usuariosMercancia_web_new_version/M1`,
  negocio: N,
  sucursal: `${N}/sucursales_web_new_version/${S1}`,
  nodoDoc: `${N}/nodos_web_new_version/NODO1`,
  categoria: `${N}/categorias_web_new_version/C1`,
  subcategoria: `${N}/subcategorias_web_new_version/SC1`,
  resurtido: `${N}/resurtidos_web_new_version/R1`,
  colaboradorDoc: `${N}/colaboradores_web_new_version/COL1`,
  chatDirecto: `${N}/chat_directos_web_new_version/PAIR1`,
  chatGrupo: `${N}/chat_grupos_web_new_version/G1`,
  chatWhitelist: `${N}/chat_whitelist_admin_web_new_version/W1`,
  ingreso: `${N}/ingresos_mercancia_web_new_version/ING1`,
  sysDoc: `system/auth_kick_switch`,
  // --- RAIZ legacy (debe quedar ABIERTA como hoy) ---
  raizMensajes: `mensajes_n/2026`,
  raizVentas: `ventas_n/legacyDoc`,
  raizDatos: `datos/dispositivos_electron`,
  raizPermisos: `permisos_electron/algo@correo.com`,
  raizCliente: `cliente/CLI1`,
};
const venta = { negocioId: NID, sucursalId: S1, total: 100 };

await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  await setDoc(doc(db, P.ventaS1), venta);
  await setDoc(doc(db, P.articulo), { nombre: "X", precio: 50, cantidad: 10, subvariaciones: {} });
  await setDoc(doc(db, P.usuMerc), { id: "M1", nombre: "Juan", pinHash: "abc", habilitado: true });
  await setDoc(doc(db, P.negocio), { usaSubvariacionesV2: true });
  await setDoc(doc(db, P.sucursal), { nombre: "Suc 1", direccion: "x" });
  await setDoc(doc(db, P.nodoDoc), { nombre: "Nodo 1" });
  await setDoc(doc(db, P.categoria), { nombre: "Ropa" });
  await setDoc(doc(db, P.colaboradorDoc), { nombre: "Ana" });
  await setDoc(doc(db, P.chatDirecto), { ultimo: "hola" });
  await setDoc(doc(db, P.chatGrupo), { ultimo: "hey" });
  await setDoc(doc(db, P.chatWhitelist), { email: "d@x.com" });
  await setDoc(doc(db, P.sysDoc), { value: "v1" });
  // raiz legacy sembrada
  await setDoc(doc(db, P.raizMensajes), { m: 1 });
  await setDoc(doc(db, P.raizVentas), { total: 9 });
  await setDoc(doc(db, P.raizDatos), { d: 1 });
  await setDoc(doc(db, P.raizCliente), { nombre: "Cli" });
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

// ============ ARBOL MODERNO: anonimo NEGADO (el objetivo del cierre) ============
await check("anon NO escribe venta (moderno)", "fail", setDoc(doc(anon, P.ventaS2), venta));
await check("anon NO lee venta (moderno)", "fail", getDoc(doc(anon, P.ventaS1)));
await check("anon NO lee articulo (moderno)", "fail", getDoc(doc(anon, P.articulo)));
await check("anon NO lee categoria (moderno)", "fail", getDoc(doc(anon, P.categoria)));
await check("anon NO lee nodos (moderno)", "fail", getDoc(doc(anon, P.nodoDoc)));
await check("anon NO lee chat_directo (moderno)", "fail", getDoc(doc(anon, P.chatDirecto)));
await check("anon NO lee colaboradores (moderno)", "fail", getDoc(doc(anon, P.colaboradorDoc)));

// ============ CATCH-ALL raiz NO debe filtrar al arbol moderno ============
// (si el catch-all abriera el moderno, un anon podria escribir aqui)
await check("anon NO escribe negocio (moderno, no filtra catch-all)", "fail", setDoc(doc(anon, P.negocio), { hack: true }));
await check("anon NO escribe categoria (moderno, no filtra catch-all)", "fail", setDoc(doc(anon, P.categoria), { hack: true }));
await check("anon NO escribe articulo (moderno, no filtra catch-all)", "fail", updateDoc(doc(anon, P.articulo), { precio: 1 }));

// ============ NODO (caja) ============
await check("nodo S1 escribe venta en S1", "ok", setDoc(doc(nodo1, P.ventaS1), venta));
await check("nodo S1 NO escribe venta en S2", "fail", setDoc(doc(nodo1, P.ventaS2), { negocioId: NID, sucursalId: S2, total: 1 }));
await check("nodo de OTRO negocio NO escribe venta", "fail", setDoc(doc(otroNeg, P.ventaS1), venta));
await check("nodo S1 lee su venta", "ok", getDoc(doc(nodo1, P.ventaS1)));
await check("nodo actualiza stock (cantidad)", "ok", updateDoc(doc(nodo1, P.articulo), { cantidad: 9 }));
await check("nodo NO cambia precio del articulo", "fail", updateDoc(doc(nodo1, P.articulo), { precio: 1 }));

// ============ MERCANCIA ============
await check("mercancia actualiza articulo", "ok", updateDoc(doc(merc, P.articulo), { precio: 60 }));
await check("nodo NO escribe usuariosMercancia", "fail", updateDoc(doc(nodo1, P.usuMerc), { habilitado: false }));
await check("mercancia lee su usuariosMercancia (AuthWatcher)", "ok", getDoc(doc(merc, P.usuMerc)));

// ============ ADMIN ============
await check("admin escribe usuariosMercancia", "ok", updateDoc(doc(adminC, P.usuMerc), { habilitado: false }));
await check("admin lee venta S1", "ok", getDoc(doc(adminC, P.ventaS1)));
await check("admin lee nodos", "ok", getDoc(doc(adminC, P.nodoDoc)));
await check("admin lee colaboradores", "ok", getDoc(doc(adminC, P.colaboradorDoc)));
await check("admin escribe chat_directo", "ok", setDoc(doc(adminC, P.chatDirecto), { ultimo: "hola2" }));
await check("nodo NO escribe chat_directo", "fail", setDoc(doc(nodo1, P.chatDirecto), { x: 1 }));

// ============ SUPERADMIN (SIN negocioId) — el fix del incidente 09 ============
await check("superadmin lee nodos (fix)", "ok", getDoc(doc(supera, P.nodoDoc)));
await check("superadmin lee colaboradores (fix)", "ok", getDoc(doc(supera, P.colaboradorDoc)));
await check("superadmin lee chat_whitelist (fix)", "ok", getDoc(doc(supera, P.chatWhitelist)));
await check("superadmin lee+escribe chat_directo (fix)", "ok", setDoc(doc(supera, P.chatDirecto), { ultimo: "sa" }));
await check("superadmin lee venta (miembro)", "ok", getDoc(doc(supera, P.ventaS1)));
await check("superadmin escribe usuariosMercancia (admin global)", "ok", updateDoc(doc(supera, P.usuMerc), { habilitado: true }));
await check("superadmin lee categoria", "ok", getDoc(doc(supera, P.categoria)));

// ============ COLABORADOR: NO toca el arbol moderno (usa la RAIZ) ============
await check("colaborador NO lee venta moderna", "fail", getDoc(doc(colab, P.ventaS1)));
await check("colaborador NO lee chat_directo moderno", "fail", getDoc(doc(colab, P.chatDirecto)));

// ============ RAIZ legacy: ABIERTA como hoy (para no romper GOMU/nativas) ============
await check("anon LEE raiz mensajes_n (abierta)", "ok", getDoc(doc(anon, P.raizMensajes)));
await check("anon ESCRIBE raiz mensajes_n (abierta)", "ok", setDoc(doc(anon, `mensajes_n/2027`), { m: 2 }));
await check("anon LEE raiz ventas_n legacy (abierta)", "ok", getDoc(doc(anon, P.raizVentas)));
await check("anon ESCRIBE raiz datos (abierta)", "ok", setDoc(doc(anon, P.raizDatos), { d: 2 }));
await check("anon LEE raiz permisos_electron (abierta, GOMU v2)", "ok", getDoc(doc(anon, P.raizPermisos)));
await check("anon LEE raiz cliente legacy (abierta)", "ok", getDoc(doc(anon, P.raizCliente)));
await check("colaborador ESCRIBE raiz mensajes_n (chat Electron)", "ok", setDoc(doc(colab, `mensajes_n/2028`), { m: 3 }));
await check("google-sin-claims ESCRIBE raiz dispositivos (FCM nativa)", "ok", setDoc(doc(gnodo, `dispositivos/DEV1`), { token: "t" }));

// ============ colecciones del barrido (G1..G9) ============
await check("G5 anon lee negocio (onboarding)", "ok", getDoc(doc(anon, P.negocio)));
await check("G5 anon lee sucursal (onboarding)", "ok", getDoc(doc(anon, P.sucursal)));
await check("G1 mercancia escribe categoria", "ok", setDoc(doc(merc, P.categoria), { nombre: "Ropa2" }));
await check("G1 admin escribe categoria", "ok", setDoc(doc(adminC, P.categoria), { nombre: "Ropa3" }));
await check("G2 mercancia escribe subcategoria", "ok", setDoc(doc(merc, P.subcategoria), { nombre: "Playeras" }));
await check("G3 mercancia crea resurtido", "ok", setDoc(doc(merc, P.resurtido), { estado: "creado" }));
await check("G4 nodo NO escribe chat_directo", "fail", setDoc(doc(nodo1, P.chatDirecto), { x: 1 }));
await check("G7 admin lee colaboradores", "ok", getDoc(doc(adminC, P.colaboradorDoc)));
await check("G9 mercancia crea ingreso_mercancia", "ok", setDoc(doc(merc, P.ingreso), { total: 5 }));
await check("G8 admin lee system", "ok", getDoc(doc(adminC, P.sysDoc)));
await check("G8 anon lee system (kill-switch publico, pre-login)", "ok", getDoc(doc(anon, P.sysDoc)));
await check("G8 anon NO escribe system", "fail", setDoc(doc(anon, P.sysDoc), { value: "hack" }));

let ok = true;
for (const [pass, name] of res) { console.log((pass ? "PASS" : "FALLA") + "  " + name); if (!pass) ok = false; }
await env.cleanup();
console.log(ok ? `\nOK: ${res.length}/${res.length} reglas verificadas` : `\nFALLAS presentes`);
process.exit(ok ? 0 : 1);
