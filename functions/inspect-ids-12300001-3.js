/**
 * Read-only: inspecciona los IDs 12300001/2/3 en namespace legacy y nuevo,
 * más el contador. NO escribe nada — solo reporta.
 *
 * Uso: node inspect-ids-12300001-3.js
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
  const r = await httpsRequest("GET", `${FS}/${fullPath}`, null, {
    Authorization: "Bearer " + token,
  });
  return r;
}

/** Decodifica un Firestore Value en JS primitivo (resumen). */
function decodeValue(v) {
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.timestampValue !== undefined) return `(timestamp ${v.timestampValue})`;
  if (v.nullValue !== undefined) return null;
  if (v.arrayValue !== undefined) {
    return (v.arrayValue.values || []).map(decodeValue);
  }
  if (v.mapValue !== undefined) {
    const o = {};
    for (const [k, vv] of Object.entries(v.mapValue.fields || {})) {
      o[k] = decodeValue(vv);
    }
    return o;
  }
  return "?";
}

function decodeFields(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields || {})) out[k] = decodeValue(v);
  return out;
}

function resumen(fields) {
  if (!fields) return "(sin campos)";
  const d = decodeFields(fields);
  const items = [];
  if (d.nombre !== undefined) items.push(`nombre="${d.nombre}"`);
  if (d.sigla !== undefined) items.push(`sigla="${d.sigla}"`);
  if (d.precioVenta !== undefined) items.push(`precioVenta=${d.precioVenta}`);
  if (d.preciCompra !== undefined) items.push(`preciCompra=${d.preciCompra}`);
  if (d.cantidad !== undefined) items.push(`cantidad=${d.cantidad}`);
  if (d.fecha !== undefined) items.push(`fecha=${d.fecha}`);
  if (d._migradoEn !== undefined) items.push(`_migradoEn=${d._migradoEn}`);
  if (Array.isArray(d.subvariaciones)) items.push(`subvariaciones=${d.subvariaciones.length}`);
  if (d.imagenUrl !== undefined) items.push(`imagenUrl=(${d.imagenUrl.slice(0, 30)}…)`);
  return items.length > 0 ? items.join(", ") : JSON.stringify(d).slice(0, 200);
}

async function run() {
  const token = await getAccessToken();
  const negBase = `negocios_web_new_version/${NEGOCIO_ID}`;

  console.log("════════════════════════════════════════════════════════");
  console.log(`  INSPECCIÓN — IDs ${IDS.join(", ")}`);
  console.log("════════════════════════════════════════════════════════\n");

  // Contador
  const contadorPath = `${negBase}/datos_web_new_version/_contadorArticulos`;
  const contadorR = await getDoc(contadorPath, token);
  console.log("─── CONTADOR ─────────────────────────────");
  if (contadorR.status === 404) {
    console.log(`  ${contadorPath}: NO EXISTE`);
  } else if (contadorR.status >= 400) {
    console.log(`  ${contadorPath}: ERROR ${contadorR.status}`);
  } else {
    console.log(`  ${contadorPath}:`);
    console.log(`    ${resumen(contadorR.data.fields)}`);
  }
  console.log();

  for (const id of IDS) {
    console.log(`─── ID ${id} ─────────────────────────────`);

    const newPath = `${negBase}/articulos_n_web_new_version/${id}`;
    const newR = await getDoc(newPath, token);
    if (newR.status === 404) {
      console.log(`  [NUEVO]   ${newPath}: NO EXISTE`);
    } else if (newR.status >= 400) {
      console.log(`  [NUEVO]   ${newPath}: ERROR ${newR.status}`);
    } else {
      console.log(`  [NUEVO]   ${newPath}:`);
      console.log(`            ${resumen(newR.data.fields)}`);
    }

    const legacyPath = `articulos_n/${id}`;
    const legacyR = await getDoc(legacyPath, token);
    if (legacyR.status === 404) {
      console.log(`  [LEGACY]  ${legacyPath}: NO EXISTE`);
    } else if (legacyR.status >= 400) {
      console.log(`  [LEGACY]  ${legacyPath}: ERROR ${legacyR.status}`);
    } else {
      console.log(`  [LEGACY]  ${legacyPath}:`);
      console.log(`            ${resumen(legacyR.data.fields)}`);
    }
    console.log();
  }

  // Bonus: máximo ID actual en namespace nuevo (para saber dónde DEBERÍA
  // estar el contador).
  console.log("─── MAX ID en namespace nuevo ────────────");
  const colPath = `${negBase}/articulos_n_web_new_version`;
  const listR = await httpsRequest(
    "GET",
    `${FS}/${colPath}?pageSize=300&mask.fieldPaths=id`,
    null,
    { Authorization: "Bearer " + token },
  );
  if (listR.status >= 400) {
    console.log(`  ERROR ${listR.status}: ${JSON.stringify(listR.data).slice(0, 200)}`);
  } else {
    const docs = listR.data.documents || [];
    const ids = docs
      .map((d) => d.name.split("/").pop())
      .filter((n) => /^\d+$/.test(n));
    const sorted = ids
      .map((n) => parseInt(n, 10))
      .sort((a, b) => b - a);
    console.log(`  Total docs en ${colPath}: ${docs.length} (mostrando top-5 numéricos):`);
    for (const n of sorted.slice(0, 5)) console.log(`    - ${n}`);
    console.log(`  → MAX numérico: ${sorted[0] ?? "(ninguno)"}`);
  }
  console.log();
}

run().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
