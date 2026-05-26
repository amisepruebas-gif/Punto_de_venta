/**
 * Script ad-hoc para inspeccionar el estado del negocio amise.
 * Reporta counts de cada colección (nueva + legacy).
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

const PROJECT_ID = "amisetienda-c7eab";
const NEGOCIO_ID = "amise";

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

async function listDocs(coll, token) {
  const r = await httpsRequest("GET", `${FS}/${coll}?pageSize=300`, null, {
    Authorization: "Bearer " + token,
  });
  if (r.status >= 400) return [];
  return (r.data.documents || []).map((d) => ({
    name: d.name.split("/").pop(),
    fullPath: d.name.replace(/^.*\/documents\//, ""),
  }));
}

async function listCollectionIds(docPath, token) {
  const parent = docPath
    ? `projects/${PROJECT_ID}/databases/(default)/documents/${docPath}`
    : `projects/${PROJECT_ID}/databases/(default)/documents`;
  const r = await httpsRequest(
    "POST",
    `https://firestore.googleapis.com/v1/${parent}:listCollectionIds`,
    {},
    { Authorization: "Bearer " + token },
  );
  if (r.status >= 400) return [];
  return r.data.collectionIds || [];
}

async function run() {
  const token = await getAccessToken();
  const negBase = `negocios_web_new_version/${NEGOCIO_ID}`;

  console.log("════════════════════════════════════════════════════════");
  console.log("  NAMESPACE NUEVO (_web_new_version)");
  console.log("════════════════════════════════════════════════════════\n");

  const sucs = await listDocs(`${negBase}/sucursales_web_new_version`, token);
  console.log(`Sucursales: ${sucs.length}`);
  for (const s of sucs) console.log(`  - ${s.name}`);

  const nodos = await listDocs(`${negBase}/nodos_web_new_version`, token);
  console.log(`\nNodos: ${nodos.length}`);
  for (const n of nodos) console.log(`  - ${n.name.slice(0, 16)}…`);

  const articulos = await listDocs(`${negBase}/articulos_n_web_new_version`, token);
  console.log(`\nArticulos migrados: ${articulos.length}`);
  if (articulos.length > 0 && articulos.length <= 5) {
    for (const a of articulos) console.log(`  - ${a.name}`);
  }

  const datos = await listDocs(`${negBase}/datos_web_new_version`, token);
  console.log(`\nDocs en datos/: ${datos.length}`);
  for (const d of datos) console.log(`  - ${d.name}`);

  // Mensajes (por día)
  console.log(`\nMensajes migrados:`);
  const mesYears = await listDocs(`${negBase}/mensajes_n_web_new_version`, token);
  if (mesYears.length === 0) console.log("  (ninguno)");
  for (const y of mesYears) console.log(`  año ${y.name}`);

  // Ventas/Cortes por sucursal
  for (const s of sucs) {
    const sucBase = `${negBase}/sucursales_data_web_new_version/${s.name}`;
    console.log(`\n--- Sucursal ${s.name} ---`);
    const apartados = await listDocs(`${sucBase}/apartados_web_new_version`, token);
    console.log(`  apartados: ${apartados.length}`);
    const ventasYears = await listDocs(`${sucBase}/ventas_n_web_new_version`, token);
    console.log(`  ventas (años con datos): ${ventasYears.length}`);
    const cortesYears = await listDocs(`${sucBase}/corte_1_web_new_version`, token);
    console.log(`  cortes (años con datos): ${cortesYears.length}`);
  }

  console.log("\n════════════════════════════════════════════════════════");
  console.log("  NAMESPACE LEGACY (Android — origen de migración)");
  console.log("════════════════════════════════════════════════════════\n");

  const legacyArt = await listDocs("articulos_n", token);
  console.log(`articulos_n: ${legacyArt.length} documentos`);

  const legacyVentasYears = await listDocs("ventas_n", token);
  console.log(`ventas_n (años): ${legacyVentasYears.length}`);
  for (const y of legacyVentasYears) console.log(`  año ${y.name}`);

  const legacyCorteYears = await listDocs("corte_1", token);
  console.log(`corte_1 (años): ${legacyCorteYears.length}`);
  for (const y of legacyCorteYears) console.log(`  año ${y.name}`);

  const legacyMensajesYears = await listDocs("mensajes_n", token);
  console.log(`mensajes_n (años): ${legacyMensajesYears.length}`);
  for (const y of legacyMensajesYears) console.log(`  año ${y.name}`);
}

run().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
