/**
 * Restaura tres artículos sobreescritos accidentalmente.
 * Lee:  /articulos_n/{id}                                       (legacy)
 * Escribe (overwrite full):
 *       /negocios_web_new_version/amise/articulos_n_web_new_version/{id}
 *
 * Ejecuta una sola vez. NO actualiza el contador (eso es aparte).
 *
 * Uso: node restore-ids-12300001-3.js
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

const PROJECT_ID = "amisetienda-c7eab";
const NEGOCIO_ID = "amise";
const IDS = ["12300001", "12300002", "12300003"];

function httpsRequest(method, url, body, headers) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method,
      headers: { "Content-Type": "application/json", ...headers },
    };
    if (data) opts.headers["Content-Length"] = Buffer.byteLength(data);
    const req = https.request(opts, (res) => {
      let buf = "";
      res.on("data", (c) => (buf += c));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(buf) }); }
        catch { resolve({ status: res.statusCode, data: buf }); }
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function getAccessToken() {
  const configPath = path.join(
    process.env.USERPROFILE || process.env.HOME,
    ".config", "configstore", "firebase-tools.json"
  );
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const refreshToken = config.tokens.refresh_token;
  const post =
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
        "Content-Length": Buffer.byteLength(post),
      },
    };
    const r = https.request(opts, (res) => {
      let b = ""; res.on("data", c => b += c);
      res.on("end", () => {
        const j = JSON.parse(b);
        if (j.access_token) resolve(j.access_token);
        else reject(new Error(b));
      });
    });
    r.on("error", reject); r.write(post); r.end();
  });
}

const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

async function getDoc(fullPath, token) {
  return httpsRequest("GET", `${FS}/${fullPath}`, null, {
    Authorization: "Bearer " + token,
  });
}

/**
 * Reemplaza el documento entero. Sin `updateMask` la API reemplaza todos
 * los campos (no merge). El body es `{ fields: { ... } }` con valores ya
 * en formato Firestore (lo que sale tal cual del GET).
 */
async function replaceDoc(fullPath, fields, token) {
  return httpsRequest(
    "PATCH",
    `${FS}/${fullPath}`,
    { fields },
    { Authorization: "Bearer " + token },
  );
}

async function run() {
  const token = await getAccessToken();
  const now = new Date().toISOString();

  console.log("════════════════════════════════════════════════════════");
  console.log(`  RESTAURACIÓN — IDs ${IDS.join(", ")}`);
  console.log("════════════════════════════════════════════════════════\n");

  // Backup en disco de los 3 docs que vamos a sobreescribir — costo nulo,
  // safety neta. Se guarda en functions/backup-pre-restore-{ts}.json.
  const backup = {};
  for (const id of IDS) {
    const newPath = `negocios_web_new_version/${NEGOCIO_ID}/articulos_n_web_new_version/${id}`;
    const r = await getDoc(newPath, token);
    if (r.status === 200) backup[id] = r.data;
  }
  const backupFile = path.join(__dirname, `backup-pre-restore-${Date.now()}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2), "utf8");
  console.log(`Backup de los 3 docs actuales escrito a:`);
  console.log(`  ${backupFile}\n`);

  for (const id of IDS) {
    console.log(`─── ID ${id} ─────────────────────────────`);

    // 1. GET legacy
    const legacyPath = `articulos_n/${id}`;
    const legacy = await getDoc(legacyPath, token);
    if (legacy.status !== 200) {
      console.log(`  ❌ LEGACY ${legacyPath} NO EXISTE (status ${legacy.status}). Skip.\n`);
      continue;
    }
    const fields = { ...(legacy.data.fields || {}) };

    // 2. Marcar _migradoEn con la fecha de esta restauración manual.
    //    Replica el patrón de cleanup.js que escribió {...data, _migradoEn: now}.
    fields._migradoEn = { stringValue: now };

    // 3. PATCH (full overwrite) en namespace nuevo.
    const newPath = `negocios_web_new_version/${NEGOCIO_ID}/articulos_n_web_new_version/${id}`;
    const w = await replaceDoc(newPath, fields, token);
    if (w.status === 200) {
      const decoded = {};
      for (const [k, v] of Object.entries(fields)) {
        if (v.stringValue !== undefined) decoded[k] = v.stringValue;
        else if (v.integerValue !== undefined) decoded[k] = v.integerValue;
        else if (Array.isArray(v.arrayValue?.values)) decoded[k] = `[array ${v.arrayValue.values.length}]`;
      }
      console.log(`  ✓ Restaurado.`);
      console.log(`    nombre="${decoded.nombre ?? "?"}", precioVenta=${decoded.precioVenta ?? "?"}`);
    } else {
      console.log(`  ❌ Fallo write status=${w.status}`);
      console.log(`     ${JSON.stringify(w.data).slice(0, 300)}`);
    }
    console.log();
  }

  console.log("Listo.");
}

run().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
