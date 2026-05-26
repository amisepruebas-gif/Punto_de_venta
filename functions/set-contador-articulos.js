/**
 * Setea _contadorArticulos.ultimoId al MAX numérico real del catálogo.
 * One-shot.
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

async function run() {
  const token = await getAccessToken();

  // 1) Calcular MAX real con paginación
  const coll = `negocios_web_new_version/${NEGOCIO_ID}/articulos_n_web_new_version`;
  let pageToken = null;
  let maxNum = 0;
  let total = 0;
  do {
    const params = new URLSearchParams({
      pageSize: "1000",
      "mask.fieldPaths": "id",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const r = await httpsRequest("GET", `${FS}/${coll}?${params.toString()}`, null, {
      Authorization: "Bearer " + token,
    });
    if (r.status >= 400) throw new Error(`list status=${r.status}`);
    const docs = r.data.documents || [];
    total += docs.length;
    for (const d of docs) {
      const id = d.name.split("/").pop();
      if (/^\d+$/.test(id)) {
        const n = parseInt(id, 10);
        if (n > maxNum) maxNum = n;
      }
    }
    pageToken = r.data.nextPageToken || null;
  } while (pageToken);

  if (maxNum === 0) {
    console.log("No se encontraron ids numéricos. Abortando.");
    return;
  }
  const nuevoValor = String(maxNum);
  console.log(`Total docs: ${total}, MAX numérico: ${maxNum}`);

  // 2) Estado actual del contador (pre-write)
  const contadorPath = `negocios_web_new_version/${NEGOCIO_ID}/datos_web_new_version/_contadorArticulos`;
  const pre = await httpsRequest("GET", `${FS}/${contadorPath}`, null, {
    Authorization: "Bearer " + token,
  });
  console.log(
    `Contador antes: ${pre.status === 200 ? JSON.stringify({ fields: pre.data.fields }).slice(0, 200) : `status=${pre.status}`}`
  );

  // 3) Write merge (solo actualizar ultimoId, conservar otros campos si los hay)
  const updateMask = new URLSearchParams({ "updateMask.fieldPaths": "ultimoId" });
  const w = await httpsRequest(
    "PATCH",
    `${FS}/${contadorPath}?${updateMask.toString()}`,
    { fields: { ultimoId: { stringValue: nuevoValor } } },
    { Authorization: "Bearer " + token },
  );
  if (w.status === 200) {
    console.log(`✓ Contador actualizado: ultimoId="${nuevoValor}"`);
    console.log(`  Próximo crearArticulo asignará: ${maxNum + 1}`);
  } else {
    console.log(`❌ Falla write status=${w.status}: ${JSON.stringify(w.data).slice(0, 300)}`);
  }
}

run().catch((e) => { console.error("FATAL:", e); process.exit(1); });
