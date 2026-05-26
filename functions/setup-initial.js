/**
 * Setup inicial — crea el negocio "amise" y asigna rol superadmin a
 * jesuscentenoramirez@gmail.com
 *
 * Uso:
 *   cd functions
 *   npm install
 *   node setup-initial.js
 *
 * Requiere que el usuario ya exista en Firebase Auth del proyecto
 * (crear manualmente en Firebase Console → Authentication si no existe,
 * con el email indicado y una contraseña temporal).
 *
 * Usa el refresh token de firebase-tools (~/.config/configstore/firebase-tools.json)
 * para obtener un OAuth access token y llamar las REST APIs de Firebase.
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

const SUPERADMIN_EMAIL = "jesuscentenoramirez@gmail.com";
const NEGOCIO_ID = "amise";
const NEGOCIO_NOMBRE = "Amise";
const PROJECT_ID = "amisetienda-c7eab";
const API_KEY = "AIzaSyCEOpgxcy7o3Y_46bKLNM7f-N-k7wGc7gg";
const SUFFIX = "_web_new_version";

function httpsRequest(method, url, body, headers) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    };
    if (postData) opts.headers["Content-Length"] = Buffer.byteLength(postData);
    const req = https.request(opts, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on("error", reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function getAccessToken() {
  const configPath = path.join(
    process.env.USERPROFILE || process.env.HOME || "C:/Users/jesus",
    ".config", "configstore", "firebase-tools.json"
  );
  if (!fs.existsSync(configPath)) {
    throw new Error(
      "No se encontró firebase-tools config en " + configPath +
      ". Ejecuta 'firebase login' primero."
    );
  }
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const refreshToken = config.tokens.refresh_token;

  const postData =
    "grant_type=refresh_token" +
    "&refresh_token=" + encodeURIComponent(refreshToken) +
    "&client_id=563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6" +
    ".apps.googleusercontent.com" +
    "&client_secret=j9iVZfS8kkCEFUPaAeJV0sAi";

  return new Promise((resolve, reject) => {
    const opts = {
      hostname: "oauth2.googleapis.com",
      path: "/token",
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(postData),
      },
    };
    const req = https.request(opts, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        const json = JSON.parse(data);
        if (json.access_token) resolve(json.access_token);
        else reject(new Error("Token refresh failed: " + data));
      });
    });
    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

// ============================================================
// Firestore REST helpers
// ============================================================
const FS_BASE = `https://firestore.googleapis.com/v1/projects/` +
  `${PROJECT_ID}/databases/(default)/documents`;

function fsVal(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "number") {
    return Number.isInteger(v)
      ? { integerValue: String(v) }
      : { doubleValue: v };
  }
  if (typeof v === "boolean") return { booleanValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  return { stringValue: String(v) };
}

function fsDoc(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) fields[k] = fsVal(v);
  return { fields };
}

async function fsSet(docPath, data, token) {
  const url = `${FS_BASE}/${docPath}`;
  const r = await httpsRequest("PATCH", url, fsDoc(data), {
    Authorization: "Bearer " + token,
  });
  if (r.status >= 400) {
    throw new Error(`Firestore ${r.status} on ${docPath}: ${JSON.stringify(r.data)}`);
  }
  return r.data;
}

// ============================================================
// Auth helpers
// ============================================================
async function lookupUserByEmail(email, token) {
  // Endpoint admin scoped a project (no el de cliente sin projectId).
  // El endpoint cliente solo acepta `idToken`; el admin acepta lookup por email.
  const r = await httpsRequest(
    "POST",
    `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:lookup`,
    { email: [email] },
    { Authorization: "Bearer " + token }
  );
  if (r.data.users && r.data.users[0]) return r.data.users[0];
  return null;
}

async function setCustomClaims(uid, claims, token) {
  const endpoints = [
    `https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/accounts:update`,
    `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:update`,
  ];
  for (const url of endpoints) {
    const r = await httpsRequest(
      "POST", url,
      { localId: uid, customAttributes: JSON.stringify(claims) },
      { Authorization: "Bearer " + token }
    );
    if (r.status < 400) return true;
  }
  return false;
}

// ============================================================
// Run
// ============================================================
async function run() {
  console.log("Setup inicial de amise — proyecto", PROJECT_ID);
  console.log("Obteniendo access token...");
  const token = await getAccessToken();
  console.log("  OK\n");

  // ---- 1. Lookup super admin ----
  console.log("=== 1. Buscando super admin", SUPERADMIN_EMAIL, "===");
  const user = await lookupUserByEmail(SUPERADMIN_EMAIL, token);
  if (!user) {
    console.error(`ERROR: el usuario ${SUPERADMIN_EMAIL} no existe en Firebase Auth.`);
    console.error("Créalo manualmente en Firebase Console → Authentication → Users");
    console.error("con una contraseña temporal y vuelve a ejecutar este script.");
    process.exit(1);
  }
  const uid = user.localId;
  console.log("  UID:", uid);

  // ---- 2. Asignar rol superadmin ----
  console.log("=== 2. Asignando claim role=superadmin ===");
  const ok = await setCustomClaims(uid, { role: "superadmin" }, token);
  console.log(ok ? "  OK" : "  WARN: no se pudo asignar via REST. Asigna manual.");

  // ---- 3. Crear doc usuarios/{uid} ----
  console.log("=== 3. Creando usuarios/" + uid + " ===");
  await fsSet(`usuarios/${uid}`, {
    email: SUPERADMIN_EMAIL,
    nombre: user.displayName || "Super Admin",
    negocioId: null,
    role: "superadmin",
    estado: "activo",
    createdAt: new Date(),
  }, token);
  console.log("  OK");

  // ---- 4. Plan básico ----
  console.log("=== 4. Creando planes/basico ===");
  await fsSet(`planes/basico`, {
    nombre: "basico",
    precio: 0,
    limiteDispositivos: 10,
    limiteSucursales: 5,
    limiteArticulos: 5000,
  }, token);
  console.log("  OK");

  // ---- 5. Negocio "amise" ----
  console.log(`=== 5. Creando ${`negocios${SUFFIX}`}/${NEGOCIO_ID} ===`);
  await fsSet(`negocios${SUFFIX}/${NEGOCIO_ID}`, {
    negocioId: NEGOCIO_ID,
    nombre: NEGOCIO_NOMBRE,
    email: "",
    telefono: "",
    plan: "basico",
    estado: "activo",
    fechaCreacion: new Date(),
    limiteSucursales: 5,
    limiteDispositivos: 10,
  }, token);
  console.log("  OK");

  // ---- 6. Doc placeholder datos/_init ----
  console.log(`=== 6. Creando datos_web_new_version/_init ===`);
  await fsSet(`negocios${SUFFIX}/${NEGOCIO_ID}/datos${SUFFIX}/_init`, {
    createdAt: new Date(),
  }, token);
  console.log("  OK");

  console.log("\n==============================");
  console.log("  SETUP COMPLETO");
  console.log("==============================");
  console.log("Super admin:", SUPERADMIN_EMAIL);
  console.log("UID:        ", uid);
  console.log("Negocio ID: ", NEGOCIO_ID);
  console.log("\nPróximos pasos:");
  console.log("  1. Deploy rules:      firebase deploy --only firestore:rules,storage");
  console.log("  2. Deploy functions:  firebase deploy --only functions");
  console.log("  3. Login admin-web con", SUPERADMIN_EMAIL);
}

run().catch((err) => {
  console.error("\nFATAL:", err.message || err);
  process.exit(1);
});
