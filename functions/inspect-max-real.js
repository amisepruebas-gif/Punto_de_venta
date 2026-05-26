/**
 * Lista TODOS los doc-ids de articulos_n_web_new_version paginando hasta
 * agotar, y reporta el MAX numérico real.
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
  const coll = `negocios_web_new_version/${NEGOCIO_ID}/articulos_n_web_new_version`;

  const todos = [];
  let pageToken = null;
  let pages = 0;
  do {
    const params = new URLSearchParams({
      pageSize: "1000",
      "mask.fieldPaths": "id",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const url = `${FS}/${coll}?${params.toString()}`;
    const r = await httpsRequest("GET", url, null, {
      Authorization: "Bearer " + token,
    });
    if (r.status >= 400) {
      console.error(`Error page ${pages}: ${r.status} ${JSON.stringify(r.data).slice(0, 200)}`);
      break;
    }
    pages++;
    const docs = r.data.documents || [];
    for (const d of docs) todos.push(d.name.split("/").pop());
    pageToken = r.data.nextPageToken || null;
    console.log(`Página ${pages}: ${docs.length} docs (acum ${todos.length}). nextPageToken=${pageToken ? "sí" : "no"}`);
  } while (pageToken);

  console.log(`\nTotal docs: ${todos.length}`);

  const numericos = todos
    .filter((n) => /^\d+$/.test(n))
    .map((n) => parseInt(n, 10))
    .sort((a, b) => b - a);

  console.log(`Docs con id numérico: ${numericos.length}`);
  console.log(`\nTop-10 IDs numéricos:`);
  for (const n of numericos.slice(0, 10)) console.log(`  - ${n}`);
  console.log(`\n→ MAX REAL: ${numericos[0] ?? "(ninguno)"}`);

  // No-numéricos (si los hay)
  const noNum = todos.filter((n) => !/^\d+$/.test(n));
  if (noNum.length > 0) {
    console.log(`\n${noNum.length} doc-ids no-numéricos (primeros 10):`);
    for (const n of noNum.slice(0, 10)) console.log(`  - ${n}`);
  }
}

run().catch((e) => { console.error("FATAL:", e); process.exit(1); });
