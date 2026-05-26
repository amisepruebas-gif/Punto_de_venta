/**
 * Cleanup script — borra TODOS los huérfanos restantes y deja el negocio
 * amise limpio. Usar antes de re-registrar el primer nodo desde cero.
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
  const r = await httpsRequest("GET", `${FS}/${coll}?pageSize=100`, null, {
    Authorization: "Bearer " + token,
  });
  if (r.status >= 400) return [];
  return (r.data.documents || []).map((d) => ({
    name: d.name.split("/").pop(),
    fullPath: d.name.replace(/^.*\/documents\//, ""),
  }));
}

async function deleteDoc(docPath, token) {
  return httpsRequest("DELETE", `${FS}/${docPath}`, null, {
    Authorization: "Bearer " + token,
  });
}

async function deleteAuthUser(uid, token) {
  const url = `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:delete`;
  return httpsRequest("POST", url, { localId: uid }, {
    Authorization: "Bearer " + token,
  });
}

async function run() {
  const token = await getAccessToken();

  console.log("=== Borrando todos los nodos del negocio amise ===");
  const nodos = await listDocs(
    `negocios_web_new_version/${NEGOCIO_ID}/nodos_web_new_version`,
    token,
  );
  for (const n of nodos) {
    console.log(`  nodo ${n.name}`);
    const r = await deleteDoc(n.fullPath, token);
    console.log(`    firestore: ${r.status}`);
    const a = await deleteAuthUser(n.name, token);
    console.log(`    auth: ${a.status}`);
  }
  console.log(`Total: ${nodos.length} nodos`);

  console.log("");
  console.log("=== Borrando todas las sucursales del negocio amise ===");
  const sucs = await listDocs(
    `negocios_web_new_version/${NEGOCIO_ID}/sucursales_web_new_version`,
    token,
  );
  for (const s of sucs) {
    console.log(`  sucursal ${s.name}`);
    const r = await deleteDoc(s.fullPath, token);
    console.log(`    firestore: ${r.status}`);
  }
  console.log(`Total: ${sucs.length} sucursales`);

  console.log("\n✓ DONE — negocio amise limpio.");
}

run().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
