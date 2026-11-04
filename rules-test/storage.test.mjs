// Pruebas de ../storage.rules contra el emulador de Storage.
//
// Correr (desde la RAÍZ del repo; usa el firebase.json de la raíz):
//   npx firebase emulators:exec --project demo-test --only storage "node rules-test/storage.test.mjs"
// emulators:exec le pasa al proceso dónde quedó el emulador; no hay puerto fijo.
//
// Qué cubre: solo el staff de la caja (admin, superadmin, mercancía) puede
// BORRAR imágenes de artículos. Leer, subir y reemplazar sigue abierto, y el
// resto del bucket queda igual que antes.
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import { ref, uploadBytes, getBytes, deleteObject } from "firebase/storage";
import { readFileSync } from "node:fs";

// REGLAS=<archivo> prueba otra versión (p. ej. la de main, para ver qué cambia).
const RULES = readFileSync(
  process.env.REGLAS || new URL("../storage.rules", import.meta.url),
  "utf8",
);
const NID = "amise";

const env = await initializeTestEnvironment({
  projectId: "demo-test",
  storage: { rules: RULES },
});

// Roles reales con sus claims (mismas que rules-test/test.mjs).
const ctx = {
  anon: env.unauthenticatedContext(),
  sinRol: env.authenticatedContext("g1", {}),
  nodo: env.authenticatedContext("n1", { role: "nodo", negocioId: NID, sucursalId: "suc1", nodoId: "n1" }),
  colaborador: env.authenticatedContext("c1", { role: "colaborador", negocioId: NID, colaboradorId: "c1" }),
  revocado: env.authenticatedContext("r1", { role: "revocado" }),
  admin: env.authenticatedContext("a1", { role: "admin", negocioId: NID }),
  superadmin: env.authenticatedContext("sa", { role: "superadmin" }),
  mercancia: env.authenticatedContext("m1", { role: "mercancia", negocioId: NID, sucursalId: "suc1", mercanciaUid: "m1" }),
};

const BYTES = new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]);
const META = { contentType: "image/webp" };

async function sembrar(path) {
  await env.withSecurityRulesDisabled(async (c) => {
    await uploadBytes(ref(c.storage(), path), BYTES, META);
  });
}

let ok = 0;
let fallas = 0;
async function caso(nombre, fn) {
  try {
    await fn();
    ok++;
  } catch (e) {
    fallas++;
    console.error(`FALLA: ${nombre}\n  ${e && e.message}`);
  }
}

const ART = "media_web_new_version/articulos";
let n = 0;
const nuevo = (base) => `${base}/${String(++n).padStart(4, "0")}.webp`;

// --- Imágenes de artículos: borrar ---
const noPuedenBorrar = ["anon", "sinRol", "nodo", "colaborador", "revocado"];
for (const quien of noPuedenBorrar) {
  await caso(`${quien} NO borra imagen de artículo`, async () => {
    const p = nuevo(ART);
    await sembrar(p);
    await assertFails(deleteObject(ref(ctx[quien].storage(), p)));
  });
  await caso(`${quien} NO borra imagen de variación en subcarpeta`, async () => {
    const p = nuevo(`${ART}/sub`);
    await sembrar(p);
    await assertFails(deleteObject(ref(ctx[quien].storage(), p)));
  });
}
for (const quien of ["admin", "superadmin", "mercancia"]) {
  await caso(`${quien} SÍ borra imagen de artículo`, async () => {
    const p = nuevo(ART);
    await sembrar(p);
    await assertSucceeds(deleteObject(ref(ctx[quien].storage(), p)));
  });
  await caso(`${quien} SÍ borra imagen en subcarpeta de artículos`, async () => {
    const p = nuevo(`${ART}/sub`);
    await sembrar(p);
    await assertSucceeds(deleteObject(ref(ctx[quien].storage(), p)));
  });
}

// --- Imágenes de artículos: leer, subir y reemplazar siguen abiertos ---
for (const quien of ["anon", "nodo", "admin", "mercancia"]) {
  await caso(`${quien} lee imagen de artículo`, async () => {
    const p = nuevo(ART);
    await sembrar(p);
    await assertSucceeds(getBytes(ref(ctx[quien].storage(), p)));
  });
  await caso(`${quien} sube imagen nueva de artículo`, async () => {
    await assertSucceeds(uploadBytes(ref(ctx[quien].storage(), nuevo(ART)), BYTES, META));
  });
  await caso(`${quien} reemplaza imagen de artículo`, async () => {
    const p = nuevo(ART);
    await sembrar(p);
    await assertSucceeds(uploadBytes(ref(ctx[quien].storage(), p), BYTES, META));
  });
}

// --- El resto del bucket queda como antes (borrar abierto) ---
const otras = [
  `chat_media_web_new_version/${NID}/n1`,
  `mensajes_media/${NID}`,
  "media_web_new_version/otra-carpeta",
  "articulos/legacy",
  "uploads",
];
for (const base of otras) {
  await caso(`anon borra en ${base} (igual que antes)`, async () => {
    const p = nuevo(base);
    await sembrar(p);
    await assertSucceeds(deleteObject(ref(ctx.anon.storage(), p)));
  });
  await caso(`anon sube y lee en ${base} (igual que antes)`, async () => {
    const p = nuevo(base);
    await assertSucceeds(uploadBytes(ref(ctx.anon.storage(), p), BYTES, META));
    await assertSucceeds(getBytes(ref(ctx.anon.storage(), p)));
  });
}

await env.cleanup();
console.log(fallas === 0 ? `OK: ${ok}/${ok} casos` : `FALLARON ${fallas} de ${ok + fallas} casos`);
process.exit(fallas === 0 ? 0 : 1);
