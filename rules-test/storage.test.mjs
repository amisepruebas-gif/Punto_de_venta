// Pruebas de ../storage.rules contra el emulador de Storage.
//
// Correr (desde la RAÍZ del repo; usa el firebase.json de la raíz):
//   npx firebase emulators:exec --project demo-test --only storage "node rules-test/storage.test.mjs"
// emulators:exec le pasa al proceso dónde quedó el emulador; no hay puerto fijo.
//
// REGLAS=<archivo> prueba otra versión de las reglas (p. ej. la de main).
// Los casos esperan lo que hacen las reglas de ESTA rama, así que con otras
// reglas los casos que fallan son justo lo que cambia entre las dos.
// DETALLE=1 muestra el error de cada caso que falla.
//
// Qué cubre: cada rol real (con sus claims) contra cada ruta del bucket y
// cada operación del SDK: leer (metadatos), listar, subir, reemplazar (subir
// encima), cambiar metadatos y borrar. Más el tipo y el tamaño de lo que se
// sube, y el flujo real de cada app (subir y luego pedir la URL).
//
// Los casos van uno por uno: con varios a la vez el emulador pierde
// respuestas y la prueba se queda colgada.
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  ref,
  uploadBytes,
  getMetadata,
  getDownloadURL,
  updateMetadata,
  list,
  deleteObject,
} from "firebase/storage";
import { readFileSync } from "node:fs";

const ARCHIVO_REGLAS = process.env.REGLAS || new URL("../storage.rules", import.meta.url);
const RULES = readFileSync(ARCHIVO_REGLAS, "utf8");
const NID = "amise";
const OTRO = "otro";

const env = await initializeTestEnvironment({
  projectId: "demo-test",
  storage: { rules: RULES },
});

// Roles reales con sus claims (los que ponen las Cloud Functions).
const CLAIMS = {
  anon: null, // sin sesión: chat de escritorio GOMU v1.6.2, la tienda, internet
  sinRol: {}, // cuenta de Google sin claims (p. ej. GOMU web)
  revocado: { role: "revocado" },
  vendedor: { role: "vendedor", negocioId: NID },
  nodo: { role: "nodo", negocioId: NID, sucursalId: "suc1", nodoId: "n1" },
  nodoOtro: { role: "nodo", negocioId: OTRO, sucursalId: "s9", nodoId: "n9" },
  colaborador: { role: "colaborador", negocioId: NID, colaboradorId: "c1" },
  mercancia: { role: "mercancia", negocioId: NID, sucursalId: "suc1", mercanciaUid: "m1" },
  admin: { role: "admin", negocioId: NID },
  adminOtro: { role: "admin", negocioId: OTRO },
  superadmin: { role: "superadmin" }, // sin negocioId
};
const ROLES = Object.keys(CLAIMS);

// Un Storage por rol. El SDK reintenta hasta 10 min si el servidor responde
// con error; aquí un error debe salir rápido.
const STORAGE = Object.fromEntries(
  ROLES.map((r) => {
    const c = CLAIMS[r] === null
      ? env.unauthenticatedContext()
      : env.authenticatedContext(`uid-${r}`, CLAIMS[r]);
    const s = c.storage(); // versión compat: los tiempos se cambian con setters
    s.setMaxUploadRetryTime(3000);
    s.setMaxOperationRetryTime(3000);
    return [r, s];
  }),
);
const en = (r, path) => ref(STORAGE[r], path);

const TODOS = ROLES;
const NADIE = [];
const STAFF = ["mercancia", "admin", "adminOtro", "superadmin"];
const CHAT_AMISE = ["nodo", "colaborador", "admin", "superadmin"];
const ADMIN_AMISE = ["admin", "superadmin"];
const CHAT_OTRO = ["nodoOtro", "adminOtro", "superadmin"];
const ADMIN_OTRO = ["adminOtro", "superadmin"];
const ADMINS = ["admin", "adminOtro", "superadmin"];

const BYTES = new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]);
const WEBP = { contentType: "image/webp" };
const MB = 1024 * 1024;

// get = leer · list = listar · create = subir · encima = subir sobre uno que
// ya existe (en Storage también es create) · update = cambiar metadatos ·
// delete = borrar.
const soloLeer = { get: TODOS, list: NADIE, create: NADIE, encima: NADIE, update: NADIE, delete: NADIE };
const cerrado = { get: NADIE, list: NADIE, create: NADIE, encima: NADIE, update: NADIE, delete: NADIE };
const deArticulos = { get: TODOS, list: STAFF, create: STAFF, encima: STAFF, update: STAFF, delete: STAFF };
const deChat = (miembros, admins) => ({
  get: miembros, list: miembros, create: miembros, encima: miembros, update: miembros, delete: admins,
});

// Quién puede qué, por ruta. Así deben quedar las reglas de esta rama.
const ZONAS = [
  { nombre: "imágenes de artículos", base: "media_web_new_version/articulos", ...deArticulos },
  { nombre: "imágenes de artículos (subcarpeta)", base: "media_web_new_version/articulos/sub", ...deArticulos },
  { nombre: "media/articulos (GOMU web)", base: "media/articulos", ...deArticulos },
  { nombre: "chat nuevo de amise (grupo del nodo)", base: `chat_media_web_new_version/${NID}/n1`, ...deChat(CHAT_AMISE, ADMIN_AMISE) },
  { nombre: "chat nuevo de amise (chat directo)", base: `chat_media_web_new_version/${NID}/a1__c1`, ...deChat(CHAT_AMISE, ADMIN_AMISE) },
  { nombre: "chat nuevo de otro negocio", base: `chat_media_web_new_version/${OTRO}/n9`, ...deChat(CHAT_OTRO, ADMIN_OTRO) },
  { nombre: "chat nuevo con subcarpeta de más", base: `chat_media_web_new_version/${NID}/n1/sub`, ...cerrado },
  {
    nombre: "chat_media (escritorio GOMU v1.6.2)",
    base: "chat_media/chat1",
    get: TODOS, list: NADIE, create: TODOS, encima: NADIE, update: NADIE, delete: ADMINS,
  },
  { nombre: "mensajes_media (chat viejo)", base: `mensajes_media/${NID}`, ...cerrado },
  { nombre: "carpeta vieja con ID", base: "4Zv-EZe", ...soloLeer },
  { nombre: "fotos_articulos (vieja)", base: "fotos_articulos", ...soloLeer },
  { nombre: "media/mensajes (Android viejo)", base: "media/mensajes/2026", ...soloLeer },
  { nombre: "otra carpeta en media_web_new_version", base: "media_web_new_version/otra-carpeta", ...soloLeer },
  { nombre: "uploads (nadie la usa)", base: "uploads", ...soloLeer },
  { nombre: "raíz del bucket", base: "", ...soloLeer },
];

let n = 0;
const nuevo = (base, ext = "webp") => {
  const archivo = `${String(++n).padStart(4, "0")}.${ext}`;
  return base ? `${base}/${archivo}` : archivo;
};

async function sembrar(path, bytes = BYTES, meta = WEBP) {
  await env.withSecurityRulesDisabled(async (c) => {
    await uploadBytes(ref(c.storage(), path), bytes, meta);
  });
}

const OPERACIONES = {
  get: { verbo: "lee", hacer: async (r, base) => {
    const p = nuevo(base);
    await sembrar(p);
    return getMetadata(en(r, p));
  } },
  list: { verbo: "lista", hacer: async (r, base) => {
    await sembrar(nuevo(base));
    return list(en(r, base), { maxResults: 5 });
  } },
  create: { verbo: "sube", hacer: (r, base) => uploadBytes(en(r, nuevo(base)), BYTES, WEBP) },
  encima: { verbo: "reemplaza (sube encima)", hacer: async (r, base) => {
    const p = nuevo(base);
    await sembrar(p);
    return uploadBytes(en(r, p), BYTES, WEBP);
  } },
  update: { verbo: "cambia metadatos", hacer: async (r, base) => {
    const p = nuevo(base);
    await sembrar(p);
    return updateMetadata(en(r, p), { customMetadata: { prueba: "1" } });
  } },
  delete: { verbo: "borra", hacer: async (r, base) => {
    const p = nuevo(base);
    await sembrar(p);
    return deleteObject(en(r, p));
  } },
};

let ok = 0;
const fallas = [];
const LIMITE_MS = 30000;
async function caso(nombre, fn) {
  let reloj;
  const tope = new Promise((_, rechazar) => {
    reloj = setTimeout(() => rechazar(new Error(`tardó más de ${LIMITE_MS / 1000} s`)), LIMITE_MS);
  });
  try {
    await Promise.race([fn(), tope]);
    ok++;
  } catch (e) {
    fallas.push(nombre);
    if (process.env.DETALLE) console.error(`  ${nombre}: ${e && e.message}`);
  } finally {
    clearTimeout(reloj);
  }
}
const debe = (puede, fn) => (puede ? assertSucceeds(fn()) : assertFails(fn()));
const inicio = Date.now();
const avance = (que) => console.error(`[${((Date.now() - inicio) / 1000).toFixed(1)} s] ${que}`);

// --- 1. La matriz: cada rol × cada ruta × cada operación ---
for (const z of ZONAS) {
  avance(z.nombre);
  for (const [op, { verbo, hacer }] of Object.entries(OPERACIONES)) {
    for (const r of ROLES) {
      const puede = z[op].includes(r);
      await caso(`${r} ${puede ? "SÍ" : "NO"} ${verbo} en ${z.nombre}`, () =>
        debe(puede, () => hacer(r, z.base)),
      );
    }
  }
}

// --- 2. Qué se sube: tipo y tamaño ---
avance("tipo y tamaño");
const ART = "media_web_new_version/articulos";
const CHAT = `chat_media_web_new_version/${NID}/n1`;
for (const r of ["admin", "mercancia", "superadmin"]) {
  await caso(`${r} SÍ sube JPEG y PNG a artículos`, async () => {
    await assertSucceeds(uploadBytes(en(r, nuevo(ART, "jpg")), BYTES, { contentType: "image/jpeg" }));
    await assertSucceeds(uploadBytes(en(r, nuevo(ART, "png")), BYTES, { contentType: "image/png" }));
  });
  await caso(`${r} NO sube algo que no es imagen a artículos`, () =>
    assertFails(uploadBytes(en(r, nuevo(ART, "txt")), BYTES, { contentType: "text/plain" })),
  );
  await caso(`${r} NO sube imagen de 5 MB o más a artículos`, () =>
    assertFails(uploadBytes(en(r, nuevo(ART)), new Uint8Array(5 * MB), WEBP)),
  );
  await caso(`${r} NO reemplaza una imagen de artículo con algo que no es imagen`, async () => {
    const p = nuevo(ART);
    await sembrar(p);
    await assertFails(uploadBytes(en(r, p), BYTES, { contentType: "application/pdf" }));
  });
}
await caso("admin SÍ sube a media/articulos (GOMU web) en JPEG", () =>
  assertSucceeds(uploadBytes(en("admin", nuevo("media/articulos", "jpg")), BYTES, { contentType: "image/jpeg" })),
);
for (const r of ["nodo", "admin", "colaborador"]) {
  await caso(`${r} NO sube algo que no es imagen al chat nuevo`, () =>
    assertFails(uploadBytes(en(r, nuevo(CHAT, "pdf")), BYTES, { contentType: "application/pdf" })),
  );
  await caso(`${r} NO sube imagen de 5 MB o más al chat nuevo`, () =>
    assertFails(uploadBytes(en(r, nuevo(CHAT)), new Uint8Array(5 * MB), WEBP)),
  );
}
await caso("nodo SÍ sube imagen de casi 5 MB al chat nuevo", () =>
  assertSucceeds(uploadBytes(en("nodo", nuevo(CHAT)), new Uint8Array(5 * MB - 1), WEBP)),
);
for (const [ext, tipo] of [
  ["pdf", "application/pdf"],
  ["rar", "application/x-rar-compressed"],
  ["bin", "application/octet-stream"],
  ["png", "image/png"],
]) {
  await caso(`anon SÍ sube ${ext} al chat de escritorio`, () =>
    assertSucceeds(uploadBytes(en("anon", nuevo("chat_media/chat1", ext)), BYTES, { contentType: tipo })),
  );
}
avance("100 MB al chat de escritorio");
await caso("anon NO sube 100 MB o más al chat de escritorio", () =>
  assertFails(uploadBytes(en("anon", nuevo("chat_media/chat1", "bin")), new Uint8Array(100 * MB), { contentType: "application/octet-stream" })),
);
await caso("anon NO sube al chat de escritorio fuera de una carpeta de chat", () =>
  assertFails(uploadBytes(en("anon", nuevo("chat_media", "png")), BYTES, { contentType: "image/png" })),
);

// --- 3. El flujo real de cada app: subir y luego pedir la URL ---
avance("flujos de cada app");
const flujos = [
  ["admin", "admin-web: imagen de artículo", `${ART}/12300001.webp`, true],
  ["superadmin", "admin-web: imagen de subvariación", `${ART}/12300001_v-01-XYZ.webp`, true],
  ["mercancia", "mercancia-web: imagen de artículo", `${ART}/12300002.webp`, true],
  ["nodo", "nodo-web: imagen al chat de su nodo", `${CHAT}/huella1.webp`, true],
  ["admin", "admin-web: imagen al chat de un nodo", `${CHAT}/huella2.webp`, true],
  ["admin", "admin-web: imagen a un chat directo", `chat_media_web_new_version/${NID}/a1__c1/huella3.webp`, true],
  ["superadmin", "admin-web (superadmin): imagen al chat", `${CHAT}/huella4.webp`, true],
  ["colaborador", "GOMU escritorio v2 (en desarrollo): imagen al chat", `${CHAT}/huella5.webp`, true],
  ["anon", "GOMU escritorio v1.6.2 (sin sesión): archivo al chat", "chat_media/chat1/1771972083028_wjtx.png", true],
  ["admin", "GOMU web con cuenta de admin: imagen de artículo", "media/articulos/123.webp", true],
  ["sinRol", "GOMU web con cuenta sin claims: imagen de artículo", "media/articulos/124.webp", false],
  ["anon", "GOMU escritorio v1.6.2 (sin sesión): imagen de artículo", "media/articulos/125.webp", false],
  ["nodoOtro", "nodo de otro negocio: imagen al chat de amise", `${CHAT}/huella6.webp`, false],
];
for (const [r, nombre, p, puede] of flujos) {
  await caso(`${puede ? "SÍ" : "NO"}: ${nombre}`, () =>
    debe(puede, async () => {
      await uploadBytes(en(r, p), BYTES, WEBP);
      return getDownloadURL(en(r, p));
    }),
  );
}

// --- 4. Lo ya publicado (4-nov): nadie de fuera borra imágenes de artículos ---
for (const r of ["anon", "sinRol", "nodo", "colaborador", "revocado"]) {
  await caso(`${r} NO borra imágenes de artículos aunque tenga la URL`, async () => {
    const p = nuevo(ART);
    await sembrar(p);
    await assertFails(deleteObject(en(r, p)));
  });
}

await env.cleanup();
avance("fin");
const total = ok + fallas.length;
console.log(`Reglas: ${ARCHIVO_REGLAS}`);
if (fallas.length === 0) {
  console.log(`OK: ${ok}/${total} casos`);
} else {
  console.log(`FALLARON ${fallas.length} de ${total} casos (lo que esperan las reglas de esta rama y estas no cumplen):`);
  for (const f of fallas) console.log(`  - ${f}`);
}
process.exit(fallas.length === 0 ? 0 : 1);
