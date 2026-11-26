// ============================================================
// Cloud Functions v2 — amise-web (admin + nodo)
// ============================================================
// Namespace nuevo: _web_new_version
// Rol "nodo" introducido para tablets; claims incluyen sucursalId + nodoId.
// Migrado a Functions v2 (firebase-functions/v2/*) — gen2 ready.
// ============================================================

const {onCall, onRequest, HttpsError} = require("firebase-functions/v2/https");
const {onDocumentCreated, onDocumentWritten} =
  require("firebase-functions/v2/firestore");
const {defineSecret} = require("firebase-functions/params");

// Secret para la key de Gemini (Nano Banana). Se setea una sola vez con
// `firebase functions:secrets:set GEMINI_API_KEY` y vive en Secret Manager.
// La function que la usa la declara en `secrets: [GEMINI_API_KEY]` para
// que el runtime se la inyecte como variable de entorno.
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
// Secreto compartido con amise.mx para el monedero de puntos.
// Setear con: firebase functions:secrets:set LOYALTY_POS_SECRET
const LOYALTY_POS_SECRET = defineSecret("LOYALTY_POS_SECRET");
// Dominio CANÓNICO: amise.mx (apex) hace 308 → www y se pierde el header
// Authorization. Hay que llamar directo a www para que el Bearer llegue.
const AMISE_API_BASE = "https://www.amise.mx";
// Clip (terminal de tarjetas, API de PinPad). Las claves solo viven en las
// CF: la caja nunca las ve. Setear con la credencial del Panel de
// Desarrollador de Clip: firebase functions:secrets:set CLIP_API_KEY (y
// CLIP_API_SECRET). Clip no tiene ambiente de pruebas: estas son reales.
const CLIP_API_KEY = defineSecret("CLIP_API_KEY");
const CLIP_API_SECRET = defineSecret("CLIP_API_SECRET");
const CLIP_API_BASE = "https://api.payclip.io";
// Donde Clip avisa que cambió un cobro (ver webhookClip).
const CLIP_WEBHOOK_URL = "https://us-central1-amisetienda-c7eab.cloudfunctions.net/webhookClip";
// Clip: reglas del cobro en la terminal (lib/clip.js).
const clip = require("./lib/clip");
// Lealtad: exige sesión con rol permitido (ver lib/rolesPuntos.js).
const {requireRolPuntos} = require("./lib/rolesPuntos");
// Lealtad: identidad del cliente (tarjeta o correo) y datos hacia la caja.
const puntosSeg = require("./lib/puntosSeguridad");
const logger = require("firebase-functions/logger");
// Alta de cajas: código de un solo uso y llave de la tablet (lib/accesoCaja.js).
const acceso = require("./lib/accesoCaja");
// Cashback de mayoreo (propio, sin amise): lógica pura en lib/cashbackMayoreo.js.
const cm = require("./lib/cashbackMayoreo");
// Pepper del PIN del cashback de mayoreo (HMAC). Con 10,000 PINs posibles,
// sin este secreto un respaldo de la base se rompería al instante. Setear
// una sola vez con: firebase functions:secrets:set CASHBACK_PIN_PEPPER
const CASHBACK_PIN_PEPPER = defineSecret("CASHBACK_PIN_PEPPER");
// Código nuevo: FieldValue/Timestamp modulares. En el emulador de functions
// admin.firestore.FieldValue es undefined (el código viejo aún lo usa).
const {FieldValue, Timestamp} = require("firebase-admin/firestore");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");

admin.initializeApp();
const db = admin.firestore();

const SUFFIX = "_web_new_version";
const COL_NEGOCIOS = `negocios${SUFFIX}`;
const COL_SUCURSALES = `sucursales${SUFFIX}`;
const COL_NODOS = `nodos${SUFFIX}`;
const COL_CODIGOS_CAJA = `codigos_caja${SUFFIX}`;

// ============================================================
// Helpers de autorización (v2 — recibe `auth` del request)
// ============================================================
function requireAuth(auth) {
  if (!auth) {
    throw new HttpsError("unauthenticated", "Debe iniciar sesion");
  }
  return auth.token;
}

function requireSuperAdmin(auth) {
  const t = requireAuth(auth);
  if (t.role !== "superadmin") {
    throw new HttpsError(
        "permission-denied", "Solo superadmin puede ejecutar esta accion");
  }
  return t;
}

function requireAdminOrSuper(auth, negocioId) {
  const t = requireAuth(auth);
  const ok = t.role === "superadmin" ||
    (t.role === "admin" && t.negocioId === negocioId);
  if (!ok) {
    throw new HttpsError(
        "permission-denied", "Solo admin del negocio o superadmin");
  }
  return t;
}

// ============================================================
// Sucursal default — dueña del stock en `Articulo.cantidad`
// ============================================================
// Las demás sucursales usan `cantidadPorSucursal[sid]`. Si
// `Negocio.sucursalDefaultId` está vacío, los clientes caen al primer
// sucursalId alfabético; con ids aleatorios, crear una sucursal nueva
// podría volverla default y "robarle" el stock a la existente. Por eso se
// fija aquí, en la MISMA transacción que crea la sucursal: nadie llega a
// ver dos sucursales sin default.

/**
 * Fija `sucursalDefaultId` si está vacío y, opcionalmente, crea una
 * sucursal en la misma transacción.
 *   - Hay sucursales existentes → la primera alfabética (la que el
 *     fallback de los clientes ya trataba como default; con una sola
 *     sucursal, esa).
 *   - No hay ninguna → la nueva.
 * No toca un `sucursalDefaultId` ya seteado ni crea el doc del negocio si
 * no existe.
 * @param {FirebaseFirestore.DocumentReference} negocioRef
 * @param {{ref: FirebaseFirestore.DocumentReference, data: object}} [nueva]
 * @return {Promise<string|null>} id asignado, o null si no se asignó.
 */
async function asegurarSucursalDefault(negocioRef, nueva) {
  return db.runTransaction(async (tx) => {
    const negocioSnap = await tx.get(negocioRef);
    let asignado = null;
    if (negocioSnap.exists && !negocioSnap.get("sucursalDefaultId")) {
      const existentes = await tx.get(negocioRef.collection(COL_SUCURSALES));
      const ids = existentes.docs.map((d) => d.id).sort();
      asignado = ids[0] || (nueva ? nueva.ref.id : null);
    }
    if (nueva) tx.set(nueva.ref, nueva.data);
    if (asignado) tx.update(negocioRef, {sucursalDefaultId: asignado});
    return asignado;
  });
}

// ============================================================
// enviar — FCM push notification
// ============================================================
const app = express();
app.use(cors({origin: true}));
app.use(express.json());

app.post("/", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send("No aut.: falta el token");
  }
  const idToken = authHeader.split("Bearer ")[1];
  let decodedToken;
  try {
    decodedToken = await admin.auth().verifyIdToken(idToken);
  } catch (error) {
    console.error("Error verificando token:", error);
    return res.status(401).send("Token invalido");
  }

  const {titulo, mensaje} = req.body;
  if (!titulo || !mensaje) {
    return res.status(400).send("Faltan: 'titulo' y 'mensaje'");
  }

  const negocioId = decodedToken.negocioId || null;
  const topic = negocioId ? `negocio_${negocioId}_web` : "all";

  const message = {
    data: {titulo, mensaje},
    topic,
  };

  try {
    const response = await admin.messaging().send(message);
    console.log(`FCM enviado a ${topic}:`, response);
    return res.status(200).send("Notificacion enviada");
  } catch (error) {
    console.error("Error enviando FCM:", error);
    return res.status(500).send("Error al enviar la notificacion");
  }
});

exports.enviar = onRequest(app);

// ============================================================
// setCustomClaims — asignar rol + negocioId (+ sucursalId, nodoId si nodo)
// ============================================================
exports.setCustomClaims = onCall(async (request) => {
  requireSuperAdmin(request.auth);

  const {uid, role, negocioId, sucursalId, nodoId} = request.data;
  if (!uid || !role) {
    throw new HttpsError("invalid-argument", "Se requiere uid y role");
  }

  const validRoles = ["superadmin", "admin", "vendedor", "nodo"];
  if (!validRoles.includes(role)) {
    throw new HttpsError(
        "invalid-argument", "Rol invalido: " + validRoles.join(", "));
  }

  const claims = {role};
  if (negocioId) claims.negocioId = negocioId;
  if (sucursalId) claims.sucursalId = sucursalId;
  if (nodoId) claims.nodoId = nodoId;

  await admin.auth().setCustomUserClaims(uid, claims);

  await db.collection("usuarios").doc(uid).set({
    role,
    negocioId: negocioId || null,
    sucursalId: sucursalId || null,
    nodoId: nodoId || null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, {merge: true});

  return {success: true, message: `Claims asignados a ${uid}`};
});

// ============================================================
// createUser — crea usuario admin/vendedor/superadmin
// ============================================================
exports.createUser = onCall(async (request) => {
  requireSuperAdmin(request.auth);

  const {email, password, nombre, negocioId, role} = request.data;
  if (!email || !password || !nombre) {
    throw new HttpsError(
        "invalid-argument", "Se requiere email, password y nombre");
  }

  const validRoles = ["admin", "vendedor", "superadmin"];
  const userRole = validRoles.includes(role) ? role : "admin";

  const userRecord = await admin.auth().createUser({
    email, password, displayName: nombre,
  });
  const claims = {role: userRole};
  if (negocioId) claims.negocioId = negocioId;
  await admin.auth().setCustomUserClaims(userRecord.uid, claims);

  await db.collection("usuarios").doc(userRecord.uid).set({
    email, nombre,
    negocioId: negocioId || null,
    role: userRole,
    estado: "activo",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {success: true, uid: userRecord.uid, message: `Usuario '${nombre}' creado`};
});

// ============================================================
// createBusiness — crear negocio en el namespace nuevo
// ============================================================
exports.createBusiness = onCall(async (request) => {
  requireSuperAdmin(request.auth);

  const {negocioId, nombre, email, telefono, plan, limiteSucursales, limiteDispositivos} = request.data;
  if (!nombre) {
    throw new HttpsError("invalid-argument", "Se requiere nombre");
  }

  const ref = negocioId ?
    db.collection(COL_NEGOCIOS).doc(negocioId) :
    db.collection(COL_NEGOCIOS).doc();
  const finalId = ref.id;

  await ref.set({
    negocioId: finalId,
    nombre,
    email: email || "",
    telefono: telefono || "",
    plan: plan || "basico",
    estado: "activo",
    fechaCreacion: admin.firestore.FieldValue.serverTimestamp(),
    limiteSucursales: limiteSucursales || 1,
    limiteDispositivos: limiteDispositivos || 2,
  });

  return {success: true, negocioId: finalId, message: `Negocio '${nombre}' creado`};
});

// ============================================================
// crearSucursal — admin crea sucursal nueva
// ============================================================
exports.crearSucursal = onCall(async (request) => {
  const {negocioId, nombre, direccion, telefono} = request.data;
  if (!negocioId || !nombre || !direccion) {
    throw new HttpsError(
        "invalid-argument", "Se requiere negocioId, nombre y direccion");
  }
  requireAdminOrSuper(request.auth, negocioId);

  const negocioRef = db.collection(COL_NEGOCIOS).doc(negocioId);
  const ref = negocioRef.collection(COL_SUCURSALES).doc();
  const sucursalId = ref.id;

  // Crea la sucursal y fija `sucursalDefaultId` (si falta) atómicamente.
  await asegurarSucursalDefault(negocioRef, {
    ref,
    data: {
      sucursalId,
      nombre,
      direccion,
      telefono: telefono || "",
      fechaCreacion: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: request.auth.uid,
      activa: true,
    },
  });

  return {success: true, sucursalId};
});

// ============================================================
// Alta de cajas — admin con sesión o código de un solo uso
// ============================================================

const codigoInvalido = () => new HttpsError(
    "permission-denied", "Código inválido, vencido o ya usado");

/**
 * Autoriza dar de alta o re-vincular una caja: admin del negocio con sesión,
 * o el código de un solo uso que el admin generó en admin-web (Nodos).
 * Con `consumir`, lo marca usado en una transacción y devuelve su ref para
 * liberarlo si el alta falla después.
 */
async function autorizarAltaCaja(request, negocioId, {consumir}) {
  const t = request.auth && request.auth.token;
  if (t && (t.role === "superadmin" ||
      (t.role === "admin" && t.negocioId === negocioId))) {
    return {codigoRef: null};
  }
  const codigo = acceso.normalizarCodigo(request.data && request.data.codigo);
  if (!codigo) {
    throw new HttpsError("permission-denied",
        "Se requiere el código de un administrador (admin → Nodos)");
  }
  const ref = db.collection(COL_NEGOCIOS).doc(negocioId)
      .collection(COL_CODIGOS_CAJA).doc(acceso.hashSecreto(codigo));
  const estado = (snap) => acceso.estadoCodigo(snap.exists ? {
    usado: snap.get("usado"),
    expiraEnMs: snap.get("expiraEn") ? snap.get("expiraEn").toMillis() : 0,
  } : null, Date.now());
  if (!consumir) {
    if (estado(await ref.get()) !== "valido") throw codigoInvalido();
    return {codigoRef: null};
  }
  await db.runTransaction(async (tx) => {
    if (estado(await tx.get(ref)) !== "valido") throw codigoInvalido();
    tx.update(ref, {usado: true, usadoEn: FieldValue.serverTimestamp()});
  });
  return {codigoRef: ref};
}

/** El alta falló después de consumir el código: que se pueda reintentar. */
async function liberarCodigo(ref) {
  if (!ref) return;
  await ref.update({usado: false, usadoEn: FieldValue.delete()})
      .catch((e) => console.warn("liberar código de caja:", e.message));
}

// ============================================================
// generarCodigoCaja — el admin pide un código para dar de alta o
// re-vincular una tablet (lo teclea en el first-run del nodo).
// ============================================================
exports.generarCodigoCaja = onCall(async (request) => {
  const {negocioId} = request.data || {};
  if (!negocioId) {
    throw new HttpsError("invalid-argument", "Se requiere negocioId");
  }
  const t = requireAdminOrSuper(request.auth, negocioId);
  const codigo = acceso.generarCodigo();
  const expiraEn = Timestamp.fromMillis(Date.now() + acceso.VIGENCIA_CODIGO_MS);
  await db.collection(COL_NEGOCIOS).doc(negocioId)
      .collection(COL_CODIGOS_CAJA).doc(acceso.hashSecreto(codigo)).create({
        creadoPor: t.email || request.auth.uid,
        creadoEn: FieldValue.serverTimestamp(),
        expiraEn,
        usado: false,
      });
  return {
    codigo: acceso.formatearCodigo(codigo),
    expiraEn: expiraEn.toDate().toISOString(),
  };
});

// ============================================================
// registrarNodo — first-run del nodo. Requiere admin o código de alta.
// Crea usuario Anonymous + claims + doc del nodo. Puede crear sucursal.
// Devuelve la llave con la que la tablet se re-autentica sola.
//
// FIX: rollback en caso de error. Si alguna op falla a mitad de camino,
// se limpia lo ya creado para no dejar huérfanos en Auth/Firestore.
// ============================================================
exports.registrarNodo = onCall(async (request) => {
  const {
    negocioId,
    sucursalId: sucursalIdExistente,
    nuevaSucursal,
    nombreNodo,
    registradoPor,
    userAgent,
  } = request.data;

  if (!negocioId) {
    throw new HttpsError("invalid-argument", "Se requiere negocioId");
  }
  if (!nombreNodo || !registradoPor) {
    throw new HttpsError(
        "invalid-argument", "Se requiere nombreNodo y registradoPor");
  }
  if (!sucursalIdExistente && !nuevaSucursal) {
    throw new HttpsError(
        "invalid-argument", "Se requiere sucursalId o nuevaSucursal");
  }

  const negocioRef = db.collection(COL_NEGOCIOS).doc(negocioId);
  const negocioSnap = await negocioRef.get();
  if (!negocioSnap.exists) {
    throw new HttpsError("not-found", "Negocio no existe");
  }

  // Antes de crear nada: admin con sesión o código de alta (se consume).
  const {codigoRef} =
    await autorizarAltaCaja(request, negocioId, {consumir: true});

  // Trackeamos lo creado para rollback en caso de error
  let createdSucursalRef = null;
  let createdAuthUid = null;
  let createdNodoRef = null;
  let createdChatGrupoRef = null;
  let defaultAsignado = null;

  try {
    // Resolver sucursal
    let sucursalId = sucursalIdExistente;
    if (!sucursalId && nuevaSucursal) {
      const sucRef = negocioRef.collection(COL_SUCURSALES).doc();
      sucursalId = sucRef.id;
      // Crea la sucursal y fija `sucursalDefaultId` (si falta)
      // atómicamente.
      defaultAsignado = await asegurarSucursalDefault(negocioRef, {
        ref: sucRef,
        data: {
          sucursalId,
          nombre: nuevaSucursal.nombre,
          direccion: nuevaSucursal.direccion,
          telefono: nuevaSucursal.telefono || "",
          fechaCreacion: admin.firestore.FieldValue.serverTimestamp(),
          createdBy: "first-run",
          activa: true,
        },
      });
      createdSucursalRef = sucRef;
    } else {
      const sucSnap = await negocioRef.collection(COL_SUCURSALES)
          .doc(sucursalId).get();
      if (!sucSnap.exists) {
        throw new HttpsError("not-found", "Sucursal no existe");
      }
      // Negocios legacy sin default: fijarlo ya (a la sucursal que el
      // fallback alfabético usa hoy) para que una sucursal futura no lo
      // cambie. No-op si ya está seteado. Best-effort: no tumba el registro.
      await asegurarSucursalDefault(negocioRef)
          .catch((e) => console.warn("registrarNodo: default:", e.message));
    }

    // Crear usuario Anonymous + claims
    const authUser = await admin.auth().createUser({});
    createdAuthUid = authUser.uid;
    const nodoId = authUser.uid;
    await admin.auth().setCustomUserClaims(authUser.uid, {
      role: "nodo", negocioId, sucursalId, nodoId,
    });

    // Crear doc del nodo. De la llave de re-auth solo se guarda el hash.
    const llave = acceso.generarLlave();
    const nodoRef = negocioRef.collection(COL_NODOS).doc(nodoId);
    await nodoRef.set({
      nodoId,
      sucursalId,
      nombre: nombreNodo,
      registradoPor,
      fechaRegistro: admin.firestore.FieldValue.serverTimestamp(),
      userAgent: userAgent || "",
      ultimoAcceso: admin.firestore.FieldValue.serverTimestamp(),
      estado: "activo",
      authUid: authUser.uid,
      llaveHash: acceso.hashSecreto(llave),
      historial: [{
        tipo: "registro",
        fecha: new Date().toISOString(),
        userAgent: userAgent || "",
        detalle: registradoPor,
        via: codigoRef ? "codigo" : "admin",
      }],
    });
    createdNodoRef = nodoRef;

    // Inicializar el chat grupal del nodo. Falla aquí no debe matar el
    // registro — el chat puede recrearse a futuro — pero loggeamos.
    try {
      await inicializarChatGrupoNodo(negocioId, nodoId);
      createdChatGrupoRef = negocioRef
          .collection(COL_CHAT_GRUPOS).doc(nodoId);
    } catch (e) {
      console.warn("registrarNodo: chat grupo init fallo:", e.message);
    }

    // createCustomToken — la op más propensa a fallar (requiere IAM signBlob)
    const customToken = await admin.auth().createCustomToken(authUser.uid, {
      role: "nodo", negocioId, sucursalId, nodoId,
    });

    if (codigoRef) {
      await codigoRef.update({nodoId})
          .catch((e) => console.warn("registrarNodo: código:", e.message));
    }
    return {success: true, nodoId, sucursalId, negocioId, customToken, llave};
  } catch (err) {
    // Rollback en orden inverso. Best-effort.
    console.error("registrarNodo failed, rolling back:", err.message);
    await liberarCodigo(codigoRef);
    if (createdChatGrupoRef) {
      await createdChatGrupoRef.delete()
          .catch((e) => console.warn("rollback chat grupo:", e.message));
    }
    if (createdNodoRef) {
      await createdNodoRef.delete()
          .catch((e) => console.warn("rollback nodo:", e.message));
    }
    if (createdAuthUid) {
      await admin.auth().deleteUser(createdAuthUid)
          .catch((e) => console.warn("rollback auth:", e.message));
    }
    if (createdSucursalRef) {
      if (defaultAsignado === createdSucursalRef.id) {
        // Era la primera sucursal y quedó como default: no dejar el
        // negocio apuntando a una sucursal borrada.
        await negocioRef.update({
          sucursalDefaultId: admin.firestore.FieldValue.delete(),
        }).catch((e) => console.warn("rollback default:", e.message));
      }
      await createdSucursalRef.delete()
          .catch((e) => console.warn("rollback sucursal:", e.message));
    }
    if (err instanceof HttpsError) throw err;
    throw new HttpsError("internal", `registrarNodo: ${err.message}`);
  }
});

// ============================================================
// rebindNodo — re-vincular tablet a nodo existente
// ============================================================
exports.rebindNodo = onCall(async (request) => {
  const {negocioId, nodoId, userAgent, registradoPor, llave} = request.data;
  if (!negocioId || !nodoId) {
    throw new HttpsError(
        "invalid-argument", "Se requiere negocioId y nodoId");
  }

  // Re-auth automático: la tablet trae su llave. Re-vinculación manual
  // (tablet nueva o recuperada): admin con sesión o código de alta, y la
  // tablet recibe llave nueva (la anterior deja de servir).
  const {codigoRef} = llave ? {codigoRef: null} :
    await autorizarAltaCaja(request, negocioId, {consumir: true});
  const llaveNueva = llave ? null : acceso.generarLlave();

  try {
    const nodoRef = db.collection(COL_NEGOCIOS).doc(negocioId)
        .collection(COL_NODOS).doc(nodoId);
    const nodoSnap = await nodoRef.get();
    if (!nodoSnap.exists) {
      throw new HttpsError("not-found", "Nodo no existe");
    }
    const nodo = nodoSnap.data();
    if (llave && !acceso.llaveCoincide(llave, nodo.llaveHash)) {
      throw new HttpsError("permission-denied", "Llave de la caja inválida");
    }
    if (nodo.estado === "revocado") {
      throw new HttpsError(
          "permission-denied", "Nodo revocado — pide al admin uno nuevo");
    }
    const sucursalId = nodo.sucursalId;

    // Crear NUEVO user anonymous
    const authUser = await admin.auth().createUser({});
    await admin.auth().setCustomUserClaims(authUser.uid, {
      role: "nodo", negocioId, sucursalId, nodoId,
    });

    // FIX A4: revoke + delete del authUid antiguo
    if (nodo.authUid && nodo.authUid !== authUser.uid) {
      try {
        await admin.auth().revokeRefreshTokens(nodo.authUid);
        await admin.auth().deleteUser(nodo.authUid);
      } catch (e) {
        console.warn("No se pudo limpiar authUid anterior:", nodo.authUid, e.message);
      }
    }

    const historial = Array.isArray(nodo.historial) ? nodo.historial : [];
    historial.push({
      tipo: "rebind",
      fecha: new Date().toISOString(),
      userAgent: userAgent || "",
      detalle: registradoPor || "",
      via: llave ? "llave" : codigoRef ? "codigo" : "admin",
    });

    await nodoRef.update({
      authUid: authUser.uid,
      ultimoAcceso: admin.firestore.FieldValue.serverTimestamp(),
      userAgent: userAgent || nodo.userAgent || "",
      historial,
      ...(llaveNueva ? {llaveHash: acceso.hashSecreto(llaveNueva)} : {}),
    });

    const customToken = await admin.auth().createCustomToken(authUser.uid, {
      role: "nodo", negocioId, sucursalId, nodoId,
    });

    if (codigoRef) {
      await codigoRef.update({nodoId})
          .catch((e) => console.warn("rebindNodo: código:", e.message));
    }
    return {
      success: true, nodoId, sucursalId, negocioId, customToken,
      llave: llaveNueva,
    };
  } catch (err) {
    await liberarCodigo(codigoRef);
    throw err;
  }
});

// ============================================================
// asegurarLlaveNodo — tablets dadas de alta antes de que existiera la llave
// ============================================================
// Con su sesión de caja vigente piden una, solo si su nodo aún no tiene.
// Las altas nuevas ya la reciben de registrarNodo / rebindNodo.
exports.asegurarLlaveNodo = onCall(async (request) => {
  const t = request.auth && request.auth.token;
  if (!t || t.role !== "nodo" || !t.negocioId || !t.nodoId) {
    throw new HttpsError("permission-denied", "Solo la sesión de una caja");
  }
  const nodoRef = db.collection(COL_NEGOCIOS).doc(t.negocioId)
      .collection(COL_NODOS).doc(t.nodoId);
  const llave = acceso.generarLlave();
  const creada = await db.runTransaction(async (tx) => {
    const snap = await tx.get(nodoRef);
    if (!snap.exists) {
      throw new HttpsError("not-found", "Nodo no existe");
    }
    const nodo = snap.data();
    if (nodo.estado === "revocado") {
      throw new HttpsError("permission-denied", "Nodo revocado");
    }
    // Una sesión vieja (de antes de un rebind) no puede pedir la llave.
    if (nodo.authUid && nodo.authUid !== request.auth.uid) {
      throw new HttpsError("permission-denied", "Sesión de caja reemplazada");
    }
    if (nodo.llaveHash) return false;
    tx.update(nodoRef, {llaveHash: acceso.hashSecreto(llave)});
    return true;
  });
  return {llave: creada ? llave : null};
});

// ============================================================
// revocarNodo — admin invalida un nodo
// ============================================================
exports.revocarNodo = onCall(async (request) => {
  const {negocioId, nodoId} = request.data;
  if (!negocioId || !nodoId) {
    throw new HttpsError(
        "invalid-argument", "Se requiere negocioId y nodoId");
  }
  requireAdminOrSuper(request.auth, negocioId);

  const nodoRef = db.collection(COL_NEGOCIOS).doc(negocioId)
      .collection(COL_NODOS).doc(nodoId);
  const snap = await nodoRef.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Nodo no existe");
  }
  const nodo = snap.data();

  const historial = Array.isArray(nodo.historial) ? nodo.historial : [];
  historial.push({
    tipo: "revocado",
    fecha: new Date().toISOString(),
    userAgent: "",
    detalle: `by ${request.auth.uid}`,
  });

  await nodoRef.update({estado: "revocado", historial});

  if (nodo.authUid) {
    try {
      await admin.auth().revokeRefreshTokens(nodo.authUid);
      await admin.auth().setCustomUserClaims(nodo.authUid, {role: "revocado"});
    } catch (e) {
      console.warn("No se pudo revocar authUid:", nodo.authUid, e.message);
    }
  }

  return {success: true};
});

// ============================================================
// reconciliarVentasOffline — trigger v2 onCreate.
// Si numeroDeVenta empieza con "OFFLINE-", asigna número real via transacción
// y descuenta el stock que el POS no pudo descontar (lib/stockVentaOffline.js).
// Con `retry: true`: si un paso falla, el handler lanza y la plataforma
// reintenta el evento. Los dos pasos son idempotentes, así que el reintento
// solo rehace el que falló (lib/reintento.js).
// ============================================================
const stockVentaOffline = require("./lib/stockVentaOffline");
const reintento = require("./lib/reintento");

// Pasado este tiempo desde que la venta llegó al servidor se deja de pedir
// reintento, y queda en el log qué faltó (renumerar o descontar stock).
const REINTENTO_VENTA_OFFLINE_MAX_MS = 12 * 60 * 60 * 1000;

/**
 * Sucursal de stock de `sucursalId` con la default resuelta (espejo de
 * `cargarUbicacionStock` de nodo-web). Se lee FUERA de la tx, como en el
 * POS; la lista de sucursales solo hace falta si el negocio no fija
 * `sucursalDefaultId`.
 * @param {FirebaseFirestore.DocumentReference} negocioRef
 * @param {string} sucursalId
 * @return {Promise<{sucursalId: string, esDefault: boolean}>}
 */
async function cargarUbicacionStock(negocioRef, sucursalId) {
  const negocioSnap = await negocioRef.get();
  const defaultId = negocioSnap.get("sucursalDefaultId");
  const ids = defaultId ? [] :
    (await negocioRef.collection(COL_SUCURSALES).select().get())
        .docs.map((d) => d.id);
  return stockVentaOffline.resolverUbicacionStock(sucursalId, defaultId, ids);
}

exports.reconciliarVentasOffline = onDocumentCreated(
    {
      document: "negocios_web_new_version/{negocioId}/" +
        "sucursales_data_web_new_version/{sucursalId}/" +
        "ventas_n_web_new_version/{year}/{month}/{day}/items/{ventaId}",
      retry: true,
    },
    async (event) => {
      const snap = event.data;
      if (!snap) return;
      const venta = snap.data();
      if (typeof venta.numeroDeVenta !== "string") return;
      if (!venta.numeroDeVenta.startsWith("OFFLINE-")) return;

      const {negocioId, sucursalId, year, month, day} = event.params;
      const ymd = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

      const negocioRef = db.collection(COL_NEGOCIOS).doc(negocioId);
      const contadorRef = negocioRef
          .collection("sucursales_data_web_new_version").doc(sucursalId)
          .collection("contadores_web_new_version").doc(ymd);

      const renumerar = async () => {
        const numeroReal = await db.runTransaction(async (tx) => {
          // Re-verificar dentro de la transacción que el doc todavía es
          // OFFLINE (idempotencia: si dos disparos del trigger, o un
          // reintento, corren para el mismo doc, el segundo ve numeroDeVenta
          // ya cambiado y aborta).
          const ventaActual = await tx.get(snap.ref);
          if (!ventaActual.exists) return null;
          const numActual = ventaActual.data().numeroDeVenta;
          if (typeof numActual !== "string" ||
              !numActual.startsWith("OFFLINE-")) {
            return null;
          }

          const contadorSnap = await tx.get(contadorRef);
          // FASE 2: arrancar contador en 0 (primera venta real = "1") en
          // vez de -1, paralelo al fix client-side en ventaService.ts.
          const prev = contadorSnap.exists ?
            (contadorSnap.data().ultimoNumeroVenta ?? 0) :
            0;
          const numero = String(prev + 1);
          tx.update(snap.ref, {
            numeroDeVenta: numero,
            numeroDeVentaOffline: venta.numeroDeVenta,
            reconciliadoEn: admin.firestore.FieldValue.serverTimestamp(),
          });
          tx.set(
              contadorRef,
              {
                ultimoNumeroVenta: prev + 1,
                actualizado: admin.firestore.FieldValue.serverTimestamp(),
              },
              {merge: true},
          );
          return numero;
        });
        if (numeroReal) {
          console.log(`Reconciliada venta OFFLINE ${venta.numeroDeVenta} → ${numeroReal} para sucursal ${sucursalId}/${ymd}`);
        }
      };

      // Stock: sin red el POS guardó la venta sin su tx de stock. Va en una tx
      // aparte de la renumeración para no alargar la que compite por el
      // contador. La marca `stockAplicado` (misma tx que el stock) evita
      // descontar dos veces.
      const descontarStock = async () => {
        const ubicacion = await cargarUbicacionStock(negocioRef, sucursalId);
        const r = await db.runTransaction((tx) =>
          stockVentaOffline.aplicarStockVentaEnTx(tx, {
            ventaRef: snap.ref,
            articuloRef: (id) =>
              negocioRef.collection("articulos_n_web_new_version").doc(id),
            ubicacion,
          }));
        if (!r) return;
        console.log(
            `Stock de venta OFFLINE ${venta.numeroDeVenta}: ` +
            `${r.patches.size} artículo(s) en sucursal ${sucursalId}` +
            (ubicacion.esDefault ? " (default)" : "") +
            (r.sobreventa ? ", con sobreventa" : ""));
        if (r.omitidas.length > 0) {
          console.warn(
              `Venta OFFLINE ${venta.numeroDeVenta}: líneas sin descontar`,
              JSON.stringify(r.omitidas));
        }
      };

      // Cada paso corre aunque el otro falle.
      const {fallas, reintentar, edadMs} = await reintento.correrPasos([
        ["renumerar", renumerar],
        ["descontar stock", descontarStock],
      ], {eventTime: event.time, maxMs: REINTENTO_VENTA_OFFLINE_MAX_MS});
      if (fallas.length === 0) return;
      for (const {nombre, err} of fallas) {
        console.error(
            `Fallo al ${nombre} (venta offline ${venta.numeroDeVenta}):`, err);
      }
      const falta = fallas.map((f) => f.nombre).join(" y ");
      if (reintentar) {
        // Lanzar = pedir otro intento a la plataforma (retry: true).
        throw new Error(
            `Venta OFFLINE ${venta.numeroDeVenta}: falta ${falta}; se reintenta`);
      }
      console.error(
          `Venta OFFLINE ${venta.numeroDeVenta} (${sucursalId}/${ymd}): se deja ` +
          `de reintentar tras ${Math.round(edadMs / 60000)} min; falta ${falta}`);
    },
);

// ============================================================
// migrarDataLegacy — migración real (Fase 6)
// ============================================================
exports.migrarDataLegacy = onCall(
    {timeoutSeconds: 540, memory: "1GiB"},
    async (request) => {
      requireSuperAdmin(request.auth);

      const {negocioId, sucursalId, dryRun, solo} = request.data;
      if (!negocioId) {
        throw new HttpsError("invalid-argument", "Se requiere negocioId");
      }
      if (!sucursalId) {
        throw new HttpsError(
            "invalid-argument",
            "Se requiere sucursalId (donde se mapean ventas/cortes/apartados)");
      }

      const summary = {
        dryRun: !!dryRun,
        articulos: 0,
        ventas: 0,
        cortes: 0,
        mensajes: 0,
        apartados: 0,
        datos: 0,
        errores: [],
      };

      const base = db.collection(COL_NEGOCIOS).doc(negocioId);
      const sucBase = base.collection("sucursales_data_web_new_version")
          .doc(sucursalId);

      // datos/* es opt-in explícito; el "todo" no lo incluye porque
      // equipoDeTrabajo / tallas / transferencia_datos se manejan distinto
      // en la nueva arquitectura (se configuran desde admin-web).
      const quiero = (k) => {
        if (k === "datos") return solo === "datos";
        return !solo || solo === k;
      };
      const now = admin.firestore.FieldValue.serverTimestamp();

      /**
       * Deriva un fechaISO confiable para queries del admin-web.
       * Estrategia (en orden):
       *   1. Si el doc legacy ya trae fechaISO (raro en Android), úsalo.
       *   2. Parsear `huella` (formato YYYYMMDDHHmmssSSS desde generarID()).
       *   3. Fallback: midday UTC del path {y}/{m}/{d}.
       * Esto preserva el ORDEN cronológico real (no la hora de migración).
       */
      const deriveFechaISO = (v, y, m, d) => {
        if (typeof v.fechaISO === "string" && v.fechaISO) return v.fechaISO;
        if (typeof v.huella === "string" && /^\d{14}/.test(v.huella)) {
          const s = v.huella;
          const iso = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` +
            `T${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}Z`;
          const t = new Date(iso);
          if (!isNaN(t.getTime())) return t.toISOString();
        }
        const Y = String(y).padStart(4, "0");
        const M = String(m).padStart(2, "0");
        const D = String(d).padStart(2, "0");
        return new Date(`${Y}-${M}-${D}T12:00:00Z`).toISOString();
      };

      // FIX: WriteBatch helper para escribir hasta 500 docs por commit
      // (límite Firestore). 100x más rápido que awaits secuenciales.
      const makeBatcher = () => {
        let batch = db.batch();
        let count = 0;
        return {
          async set(ref, data) {
            batch.set(ref, data, {merge: true});
            count++;
            if (count >= 500) {
              await batch.commit();
              batch = db.batch();
              count = 0;
            }
          },
          async flush() {
            if (count > 0) {
              await batch.commit();
              count = 0;
            }
          },
        };
      };

      // -------- articulos --------
      if (quiero("articulos")) {
        try {
          const batcher = makeBatcher();
          const snap = await db.collection("articulos_n").get();
          for (const doc of snap.docs) {
            summary.articulos++;
            if (dryRun) continue;
            await batcher.set(
                base.collection("articulos_n_web_new_version").doc(doc.id),
                {...doc.data(), _migradoEn: now},
            );
          }
          if (!dryRun) await batcher.flush();
        } catch (e) {
          summary.errores.push(`articulos: ${e.message}`);
        }
      }

      // -------- mensajes --------
      if (quiero("mensajes")) {
        try {
          const batcher = makeBatcher();
          const anios = await db.collection("mensajes_n").listDocuments();
          for (const anioRef of anios) {
            const meses = await anioRef.listCollections();
            for (const mesCol of meses) {
              const dias = await mesCol.listDocuments();
              for (const diaRef of dias) {
                const diaSnap = await diaRef.get();
                if (!diaSnap.exists) continue;
                summary.mensajes++;
                if (dryRun) continue;
                const y = anioRef.id;
                const m = mesCol.id;
                const d = diaRef.id;
                await batcher.set(
                    base
                        .collection("mensajes_n_web_new_version")
                        .doc(y).collection(m).doc(d),
                    {...diaSnap.data(), _migradoEn: now},
                );
              }
            }
          }
          if (!dryRun) await batcher.flush();
        } catch (e) {
          summary.errores.push(`mensajes: ${e.message}`);
        }
      }

      // -------- ventas --------
      if (quiero("ventas")) {
        try {
          const batcher = makeBatcher();
          const anios = await db.collection("ventas_n").listDocuments();
          for (const anioRef of anios) {
            const meses = await anioRef.listCollections();
            for (const mesCol of meses) {
              const dias = await mesCol.listDocuments();
              for (const diaRef of dias) {
                const diaSnap = await diaRef.get();
                if (!diaSnap.exists) continue;
                const dayData = diaSnap.data();
                const registro = Array.isArray(dayData.registro) ?
                  dayData.registro :
                  [];
                for (const v of registro) {
                  summary.ventas++;
                  if (dryRun) continue;
                  const y = anioRef.id;
                  const m = mesCol.id;
                  const d = diaRef.id;
                  const vid = v.huella || v.id_registro || `legacy_${summary.ventas}`;
                  await batcher.set(
                      sucBase
                          .collection("ventas_n_web_new_version")
                          .doc(y).collection(m).doc(d).collection("items").doc(vid),
                      {
                        ...v,
                        ventaId: vid,
                        negocioId,
                        sucursalId,
                        nodoId: v.nodoId || "nodo-legacy",
                        fechaISO: deriveFechaISO(v, y, m, d),
                        _migradoEn: now,
                      },
                  );
                }
              }
            }
          }
          if (!dryRun) await batcher.flush();
        } catch (e) {
          summary.errores.push(`ventas: ${e.message}`);
        }
      }

      // -------- cortes --------
      if (quiero("cortes")) {
        try {
          const batcher = makeBatcher();
          const anios = await db.collection("corte_1").listDocuments();
          for (const anioRef of anios) {
            const meses = await anioRef.listCollections();
            for (const mesCol of meses) {
              const dias = await mesCol.listDocuments();
              for (const diaRef of dias) {
                const diaSnap = await diaRef.get();
                if (!diaSnap.exists) continue;
                const dayData = diaSnap.data();
                const registro = Array.isArray(dayData.registro) ?
                  dayData.registro :
                  [];
                for (const c of registro) {
                  summary.cortes++;
                  if (dryRun) continue;
                  const y = anioRef.id;
                  const m = mesCol.id;
                  const d = diaRef.id;
                  const cid = c.idVenta_corte ||
                    c.huella ||
                    `legacy_corte_${summary.cortes}`;
                  await batcher.set(
                      sucBase
                          .collection("corte_1_web_new_version")
                          .doc(y).collection(m).doc(d).collection("items").doc(cid),
                      {
                        ...c,
                        corteId: cid,
                        negocioId,
                        sucursalId,
                        nodoId: c.nodoId || c.dispositivo || "nodo-legacy",
                        fechaISO: deriveFechaISO(c, y, m, d),
                        _migradoEn: now,
                      },
                  );
                }
              }
            }
          }
          if (!dryRun) await batcher.flush();
        } catch (e) {
          summary.errores.push(`cortes: ${e.message}`);
        }
      }

      // -------- apartados --------
      if (quiero("apartados")) {
        try {
          const batcher = makeBatcher();
          const snap = await db.collection("apartados").get();
          for (const doc of snap.docs) {
            summary.apartados++;
            if (dryRun) continue;
            await batcher.set(
                sucBase
                    .collection("apartados_web_new_version")
                    .doc(doc.id),
                {
                  ...doc.data(),
                  apartadoId: doc.id,
                  negocioId,
                  sucursalId,
                  _migradoEn: now,
                },
            );
          }
          if (!dryRun) await batcher.flush();
        } catch (e) {
          summary.errores.push(`apartados: ${e.message}`);
        }
      }

      // -------- datos (equipoDeTrabajo, tallas, transferencia_datos) --------
      if (quiero("datos")) {
        const keysAMigrar = [
          "equipoDeTrabajo",
          "tallas",
          "transferencia_datos",
        ];
        for (const k of keysAMigrar) {
          try {
            const doc = await db.collection("datos").doc(k).get();
            if (!doc.exists) continue;
            summary.datos++;
            if (dryRun) continue;
            await base.collection("datos_web_new_version").doc(k).set({
              ...doc.data(),
              _migradoEn: now,
            }, {merge: true});
          } catch (e) {
            summary.errores.push(`datos/${k}: ${e.message}`);
          }
        }
      }

      // Log del run
      if (!dryRun) {
        try {
          await base.collection("datos_web_new_version")
              .doc("_migracionesLegacy")
              .set({
                [Date.now()]: {
                  ejecutadoEn: now,
                  ejecutadoPor: request.auth.uid,
                  resumen: summary,
                },
              }, {merge: true});
        } catch (e) {
          console.warn("No se pudo guardar log de migración:", e.message);
        }
      }

      return {success: summary.errores.length === 0, ...summary};
    });

// ============================================================
// listarSucursales — first-run del nodo: admin o código de alta vigente
// (no lo consume; sirve para validar el código antes del formulario).
// ============================================================
exports.listarSucursales = onCall(async (request) => {
  const {negocioId} = request.data;
  if (!negocioId) {
    throw new HttpsError("invalid-argument", "Se requiere negocioId");
  }
  await autorizarAltaCaja(request, negocioId, {consumir: false});
  const snap = await db.collection(COL_NEGOCIOS).doc(negocioId)
      .collection(COL_SUCURSALES).where("activa", "==", true).get();
  const sucursales = [];
  snap.forEach((doc) => {
    const d = doc.data();
    sucursales.push({
      sucursalId: d.sucursalId || doc.id,
      nombre: d.nombre,
      direccion: d.direccion,
    });
  });
  return {sucursales};
});

// ============================================================
// listarNodos — nodos activos para re-bind: admin o código de alta vigente
// ============================================================
exports.listarNodos = onCall(async (request) => {
  const {negocioId, sucursalId} = request.data;
  if (!negocioId || !sucursalId) {
    throw new HttpsError(
        "invalid-argument", "Se requiere negocioId y sucursalId");
  }
  await autorizarAltaCaja(request, negocioId, {consumir: false});
  const snap = await db.collection(COL_NEGOCIOS).doc(negocioId)
      .collection(COL_NODOS)
      .where("sucursalId", "==", sucursalId)
      .where("estado", "==", "activo").get();
  const nodos = [];
  snap.forEach((doc) => {
    const d = doc.data();
    nodos.push({
      nodoId: d.nodoId || doc.id,
      nombre: d.nombre,
      registradoPor: d.registradoPor,
      fechaRegistro: d.fechaRegistro ?
        d.fechaRegistro.toDate().toISOString() : null,
    });
  });
  return {nodos};
});

// ============================================================
// migrarArticulosLegacy — backfill de categorías/subcategorías/etiquetas
// (Fase 3 del plan de Ingreso de Mercancía)
// ============================================================
// Recorre articulos_n_web_new_version del negocio y:
//   - Convierte `genero` → `categoriaId` (creando la Categoria si no existe).
//   - Convierte `subgenero` + `genero` → `subcategoriaId` (con FK a categoría).
//   - Parsea `hashtags` (string) → `etiquetas` (string[]) normalizadas.
// IDEMPOTENTE: no sobreescribe campos ya migrados; re-ejecutarla = no-op.
// NO borra los campos legacy (eso es Fase 6).
// ============================================================

function slugCategoriaCF(nombre) {
  return String(nombre || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // diacríticos sin \p{Diacritic} (Node old)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
}

function parseEtiquetasCF(hashtagsStr) {
  if (!hashtagsStr || typeof hashtagsStr !== "string") return [];
  return [...new Set(
      hashtagsStr
          .split(/[\s,]+/)
          .map((t) => t.replace(/^#/, "").trim().toLowerCase())
          .filter((t) => t.length > 0),
  )];
}

exports.migrarArticulosLegacy = onCall(
    {timeoutSeconds: 540, memory: "512MiB"},
    async (request) => {
      const {negocioId, dryRun} = request.data || {};
      if (!negocioId) {
        throw new HttpsError("invalid-argument", "Se requiere negocioId");
      }
      // Permite superadmin global o admin del propio negocio.
      requireAdminOrSuper(request.auth, negocioId);

      const summary = {
        dryRun: !!dryRun,
        articulosLeidos: 0,
        articulosTocados: 0,
        categoriasCreadas: 0,
        subcategoriasCreadas: 0,
        etiquetasPobladas: 0,
        errores: [],
      };

      const base = db.collection(COL_NEGOCIOS).doc(negocioId);
      const colArticulos = base.collection("articulos_n_web_new_version");
      const colCategorias = base.collection("categorias_web_new_version");
      const colSubcategorias = base.collection("subcategorias_web_new_version");

      // Pre-cargar categorías y subcategorías ya existentes (idempotencia).
      const catSnap = await colCategorias.get();
      const catsExistentes = new Set();
      catSnap.forEach((d) => catsExistentes.add(d.id));

      const subSnap = await colSubcategorias.get();
      const subsExistentes = new Set();
      subSnap.forEach((d) => subsExistentes.add(d.id));

      const ahoraISO = new Date().toISOString();

      // WriteBatch: 500 ops por commit (límite Firestore).
      const batches = [];
      let batch = db.batch();
      let opsEnBatch = 0;
      const flushIfNeeded = () => {
        if (opsEnBatch >= 450) {
          batches.push(batch);
          batch = db.batch();
          opsEnBatch = 0;
        }
      };

      const articulosSnap = await colArticulos.get();
      summary.articulosLeidos = articulosSnap.size;

      for (const doc of articulosSnap.docs) {
        try {
          const a = doc.data();
          const updates = {};

          // Categoría
          if (a.genero && !a.categoriaId) {
            const catSlug = slugCategoriaCF(a.genero);
            if (catSlug) {
              if (!catsExistentes.has(catSlug)) {
                if (!dryRun) {
                  batch.set(colCategorias.doc(catSlug), {
                    categoriaId: catSlug,
                    nombre: String(a.genero).trim(),
                    fechaCreacion: ahoraISO,
                  });
                  opsEnBatch++;
                  flushIfNeeded();
                }
                catsExistentes.add(catSlug);
                summary.categoriasCreadas++;
              }
              updates.categoriaId = catSlug;
            }
          }

          // Subcategoría (requiere categoría asociada — usa la del genero)
          if (a.subgenero && !a.subcategoriaId) {
            const subSlug = slugCategoriaCF(a.subgenero);
            const catSlug = updates.categoriaId ||
                a.categoriaId ||
                slugCategoriaCF(a.genero);
            if (subSlug && catSlug) {
              if (!subsExistentes.has(subSlug)) {
                if (!dryRun) {
                  batch.set(colSubcategorias.doc(subSlug), {
                    subcategoriaId: subSlug,
                    nombre: String(a.subgenero).trim(),
                    categoriaId: catSlug,
                    fechaCreacion: ahoraISO,
                  });
                  opsEnBatch++;
                  flushIfNeeded();
                }
                subsExistentes.add(subSlug);
                summary.subcategoriasCreadas++;
              }
              updates.subcategoriaId = subSlug;
            }
          }

          // Etiquetas
          if (a.hashtags && !a.etiquetas) {
            const tags = parseEtiquetasCF(a.hashtags);
            if (tags.length > 0) {
              updates.etiquetas = tags;
              summary.etiquetasPobladas++;
            }
          }

          if (Object.keys(updates).length > 0) {
            if (!dryRun) {
              batch.update(doc.ref, updates);
              opsEnBatch++;
              flushIfNeeded();
            }
            summary.articulosTocados++;
          }
        } catch (err) {
          summary.errores.push({
            articuloId: doc.id,
            error: String(err && err.message || err),
          });
        }
      }

      // Commit del batch pendiente.
      if (opsEnBatch > 0) batches.push(batch);
      if (!dryRun) {
        for (const b of batches) {
          await b.commit();
        }
      }

      return summary;
    });

// ============================================================
// migrarSubvariacionesLegacy — id:number → codigo:"v-NN-XXX" + Storage move
// (Fase 4 del plan de Ingreso de Mercancía)
// ============================================================
// Por cada artículo con `subvariaciones?.length > 0`:
//   - Asigna `codigo` v-NN-XXX a cada entry sin código (preserva los que ya
//     lo tienen).
//   - Mueve la imagen de Storage `{id}_sv{idx}.webp` → `{id}_v-NN-XXX.webp`
//     (copy + delete; resiste si el destino ya existe o el origen no).
//   - Calcula `articulo.cantidad = sum(subvariaciones.cantidad)` snapshot.
// IDEMPOTENTE.
// ============================================================

function nucleoDesdeIdCF(id) {
  if (!/^\d{8}$/.test(id || "")) return null;
  if (!id.startsWith("123")) return null;
  const sin = id.slice(3).replace(/^0+/, "");
  return sin === "" ? "0" : sin;
}

function randAlphanumericCF(len) {
  const A =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += A[Math.floor(Math.random() * A.length)];
  }
  return out;
}

function generarCodigoVarCF(idPadre, ocupadosSet) {
  const nucleo = nucleoDesdeIdCF(idPadre);
  if (!nucleo) throw new Error("padre invalido " + idPadre);
  for (let i = 0; i < 50; i++) {
    const r = randAlphanumericCF(3);
    const c = `v-${nucleo}-${r}`;
    if (!ocupadosSet.has(c)) {
      ocupadosSet.add(c);
      return c;
    }
  }
  throw new Error("colisiones excesivas para " + idPadre);
}

exports.migrarSubvariacionesLegacy = onCall(
    {timeoutSeconds: 540, memory: "512MiB"},
    async (request) => {
      const {negocioId, dryRun} = request.data || {};
      if (!negocioId) {
        throw new HttpsError("invalid-argument", "Se requiere negocioId");
      }
      requireAdminOrSuper(request.auth, negocioId);

      const summary = {
        dryRun: !!dryRun,
        articulosLeidos: 0,
        articulosTocados: 0,
        codigosAsignados: 0,
        archivosMovidos: 0,
        archivosFallidos: 0,
        errores: [],
      };

      const base = db.collection(COL_NEGOCIOS).doc(negocioId);
      const colArticulos = base.collection("articulos_n_web_new_version");
      const articulosSnap = await colArticulos.get();
      summary.articulosLeidos = articulosSnap.size;

      const bucket = admin.storage().bucket();

      for (const doc of articulosSnap.docs) {
        try {
          const a = doc.data();
          const subs = Array.isArray(a.subvariaciones) ? a.subvariaciones : [];
          if (subs.length === 0) continue;

          // Estado: ya está migrado si TODAS las entries tienen codigo.
          const yaTodos = subs.every((sv) => typeof sv.codigo === "string");

          // Pre-cargar codigos ocupados (para no colisionar al generar nuevos).
          const ocupados = new Set(
              subs.filter((sv) => sv.codigo).map((sv) => sv.codigo),
          );

          const nuevoSubs = [];
          let cambioAlgo = false;
          let sumCantidad = 0;

          for (let idx = 0; idx < subs.length; idx++) {
            const sv = subs[idx];
            const out = {nombre: sv.nombre || ""};
            if (sv.referencia) out.referencia = sv.referencia;
            if (sv.cantidad) out.cantidad = sv.cantidad;
            sumCantidad += Number(sv.cantidad) || 0;

            // 1) codigo
            let codigo = sv.codigo;
            if (!codigo) {
              codigo = generarCodigoVarCF(a.id, ocupados);
              cambioAlgo = true;
              summary.codigosAsignados++;
            }
            out.codigo = codigo;

            // 2) imagen — preservar URL existente; opcionalmente mover archivo
            //    legacy `{id}_sv{idx}.webp` al path nuevo `{id}_{codigo}.webp`.
            if (sv.imagenUrl) out.imagenUrl = sv.imagenUrl;

            const legacyPath = `media_web_new_version/articulos/${a.id}_sv${idx}.webp`;
            const nuevoPath = `media_web_new_version/articulos/${a.id}_${codigo}.webp`;
            try {
              const legacyFile = bucket.file(legacyPath);
              const nuevoFile = bucket.file(nuevoPath);
              const [destExists] = await nuevoFile.exists();
              const [origExists] = await legacyFile.exists();
              if (origExists && !destExists) {
                if (!dryRun) {
                  await legacyFile.copy(nuevoFile);
                  await legacyFile.delete();
                  // Refrescar URL pública del archivo en el doc (best-effort).
                  try {
                    const [meta] = await nuevoFile.getMetadata();
                    if (meta.mediaLink) out.imagenUrl = meta.mediaLink;
                  } catch (_) {
                    // Mantener la URL antigua si falla la lectura de metadata.
                  }
                }
                summary.archivosMovidos++;
                cambioAlgo = true;
              }
            } catch (err) {
              summary.archivosFallidos++;
              summary.errores.push({
                articuloId: a.id,
                error: `mv storage idx=${idx}: ${err && err.message || err}`,
              });
            }

            nuevoSubs.push(out);
          }

          if (cambioAlgo || !yaTodos) {
            const updates = {
              subvariaciones: nuevoSubs,
              cantidad: String(sumCantidad),
            };
            if (!dryRun) {
              await doc.ref.update(updates);
            }
            summary.articulosTocados++;
          }
        } catch (err) {
          summary.errores.push({
            articuloId: doc.id,
            error: String(err && err.message || err),
          });
        }
      }

      return summary;
    });

// ============================================================
// limpiarLegacyArticulos — Fase 6: borrar campos legacy del schema
// ============================================================
// Borra `genero`, `subgenero`, `hashtags` de cada artículo. Operación
// destructiva — exige backup previo. Idempotente (re-ejecutar = no-op
// cuando ya están borrados).
// ============================================================

exports.limpiarLegacyArticulos = onCall(
    {timeoutSeconds: 540, memory: "512MiB"},
    async (request) => {
      const {negocioId, dryRun} = request.data || {};
      if (!negocioId) {
        throw new HttpsError("invalid-argument", "Se requiere negocioId");
      }
      requireAdminOrSuper(request.auth, negocioId);

      const summary = {
        dryRun: !!dryRun,
        articulosLeidos: 0,
        articulosTocados: 0,
        camposGeneroBorrados: 0,
        camposSubgeneroBorrados: 0,
        camposHashtagsBorrados: 0,
        errores: [],
      };

      const base = db.collection(COL_NEGOCIOS).doc(negocioId);
      const colArticulos = base.collection("articulos_n_web_new_version");
      const articulosSnap = await colArticulos.get();
      summary.articulosLeidos = articulosSnap.size;

      let batch = db.batch();
      let opsEnBatch = 0;
      const batches = [];
      const flushIfNeeded = () => {
        if (opsEnBatch >= 450) {
          batches.push(batch);
          batch = db.batch();
          opsEnBatch = 0;
        }
      };

      for (const doc of articulosSnap.docs) {
        try {
          const a = doc.data();
          const updates = {};
          if (a.genero !== undefined) {
            updates.genero = admin.firestore.FieldValue.delete();
            summary.camposGeneroBorrados++;
          }
          if (a.subgenero !== undefined) {
            updates.subgenero = admin.firestore.FieldValue.delete();
            summary.camposSubgeneroBorrados++;
          }
          if (a.hashtags !== undefined) {
            updates.hashtags = admin.firestore.FieldValue.delete();
            summary.camposHashtagsBorrados++;
          }
          if (Object.keys(updates).length > 0) {
            if (!dryRun) {
              batch.update(doc.ref, updates);
              opsEnBatch++;
              flushIfNeeded();
            }
            summary.articulosTocados++;
          }
        } catch (err) {
          summary.errores.push({
            articuloId: doc.id,
            error: String(err && err.message || err),
          });
        }
      }

      if (opsEnBatch > 0) batches.push(batch);
      if (!dryRun) {
        for (const b of batches) {
          await b.commit();
        }
      }

      return summary;
    });

// ============================================================
// getUserProfile
// ============================================================
exports.getUserProfile = onCall(async (request) => {
  requireAuth(request.auth);
  const uid = request.auth.uid;
  const snap = await db.collection("usuarios").doc(uid).get();
  if (!snap.exists) return {exists: false};
  const u = snap.data();
  return {
    exists: true,
    uid,
    email: u.email,
    nombre: u.nombre,
    negocioId: u.negocioId || null,
    sucursalId: u.sucursalId || null,
    nodoId: u.nodoId || null,
    role: u.role,
    estado: u.estado,
  };
});

// ============================================================
// quitarFondoImagen — usa Gemini 2.5 Flash Image (Nano Banana) para
// reemplazar el fondo de una imagen de producto por blanco puro.
//
// La key vive en Secret Manager (GEMINI_API_KEY). El cliente NUNCA
// la ve. Solo admin/superadmin pueden invocar.
//
// Input: { imageBase64: string, mimeType: string }
// Output: { imageBase64: string, mimeType: string }
// ============================================================
exports.quitarFondoImagen = onCall(
    {
      secrets: [GEMINI_API_KEY],
      timeoutSeconds: 90,
      memory: "512MiB",
    },
    async (request) => {
      const t = requireAuth(request.auth);
      // mercancia tambien: gestiona fotos de producto y usa esta funcion desde
      // mercancia-web (quitarFondo.ts). Empezo a dar 403 al cerrar el login de mercancia
      // a rol 'mercancia' (para las reglas). Costo Gemini rastreado en costosNanobanana.
      if (t.role !== "superadmin" && t.role !== "admin" && t.role !== "mercancia") {
        throw new HttpsError(
            "permission-denied", "Solo admin/superadmin/mercancia puede usar Gemini");
      }

      const {imageBase64, mimeType} = request.data || {};
      if (!imageBase64 || typeof imageBase64 !== "string") {
        throw new HttpsError("invalid-argument", "imageBase64 requerido");
      }
      // Whitelist de mime types soportados por Gemini Flash Image.
      // Cualquier otro (svg, gif, etc.) lo rechaza con 400 — mejor abortar
      // antes y dar mensaje claro.
      const SOPORTADOS = [
        "image/png", "image/jpeg", "image/webp", "image/heic", "image/heif",
      ];
      if (!mimeType || !SOPORTADOS.includes(mimeType)) {
        throw new HttpsError(
            "invalid-argument",
            `mimeType no soportado por Gemini: ${mimeType}. ` +
            `Usa: ${SOPORTADOS.join(", ")}.`);
      }
      // Límite de tamaño. Cloud Functions callables tienen tope de ~32 MB
      // para todo el request. Cortamos en 15 MB de bytes raw (~20 MB en
      // base64) para dejar margen.
      const MAX_BYTES = 15 * 1024 * 1024;
      const bytesAprox = Math.ceil(imageBase64.length * 0.75);
      if (bytesAprox > MAX_BYTES) {
        throw new HttpsError(
            "invalid-argument",
            `Imagen demasiado grande (${(bytesAprox / 1024 / 1024).toFixed(1)} MB). ` +
            `Máximo ${MAX_BYTES / 1024 / 1024} MB.`);
      }

      const apiKey = GEMINI_API_KEY.value();
      // Gemini 2.5 Flash Image salió de preview a GA — el modelo se llama
      // ahora `gemini-2.5-flash-image` (sin sufijo `-preview`). Si Google
      // lo renombra otra vez, este es el único punto a actualizar.
      const url =
        "https://generativelanguage.googleapis.com/v1beta/models/" +
        "gemini-2.5-flash-image:generateContent?key=" +
        encodeURIComponent(apiKey);

      const body = {
        contents: [
          {
            parts: [
              {
                text:
                  "Remove the background from this product photo " +
                  "completely and replace it with pure solid white " +
                  "(#FFFFFF). If a human hand, finger, arm or any body " +
                  "part is visible holding or near the product, remove " +
                  "it cleanly as if it were never there — fill the gap " +
                  "naturally so the product looks self-supported on the " +
                  "white background. Keep the product subject perfectly " +
                  "intact with sharp clean edges and no shadow remnants. " +
                  "Output a clean studio-style product photo on a white " +
                  "background. Do not alter the product itself.",
              },
              {inlineData: {mimeType, data: imageBase64}},
            ],
          },
        ],
        generationConfig: {responseModalities: ["IMAGE"]},
      };

      let resp;
      try {
        resp = await fetch(url, {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify(body),
        });
      } catch (e) {
        throw new HttpsError("unavailable", "Gemini API unreachable: " + e.message);
      }

      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        throw new HttpsError(
            "internal", `Gemini ${resp.status}: ${errText.slice(0, 500)}`);
      }

      const data = await resp.json().catch(() => null);
      const parts = data?.candidates?.[0]?.content?.parts || [];
      const imagePart = parts.find((p) => p.inlineData);
      if (!imagePart) {
        // El modelo a veces devuelve solo texto si rechaza la operación.
        const txtPart = parts.find((p) => p.text);
        throw new HttpsError(
            "internal",
            "Gemini no devolvió imagen. " +
            (txtPart ? `Mensaje: ${txtPart.text.slice(0, 300)}` :
              "Respuesta vacía."));
      }

      return {
        imageBase64: imagePart.inlineData.data,
        mimeType: imagePart.inlineData.mimeType || "image/png",
      };
    },
);

// ============================================================
// Chat — colecciones, helpers y CFs
// Ver `docs/14-chat-arquitectura.md` y `docs/15-chat-implementacion.md`.
// ============================================================
const cryptoNode = require("crypto");

const COL_CHAT_GRUPOS = `chat_grupos${SUFFIX}`;
const COL_CHAT_WHITELIST_ADMIN = `chat_whitelist_admin${SUFFIX}`;
const COL_COLABORADORES = `colaboradores${SUFFIX}`;

const COLABORADOR_PASSWORD_SALT = "amise.colaborador.v1";
const COLABORADOR_PASSWORD_MIN_LEN = 8;

/** Debe coincidir EXACTAMENTE con `shared/src/passwordHash.ts`. */
function hashColaboradorPassword(password) {
  return cryptoNode.createHash("sha256")
      .update(`${COLABORADOR_PASSWORD_SALT}:${password}`)
      .digest("hex");
}

/** Debe coincidir EXACTAMENTE con `shared/src/collections.ts:emailKey()`. */
function emailKey(email) {
  return String(email)
      .trim()
      .toLowerCase()
      .replace(/\+/g, "_plus_")
      .replace(/@/g, "_at_")
      .replace(/\./g, "_");
}

function negocioRefOf(negocioId) {
  return db.collection(COL_NEGOCIOS).doc(negocioId);
}

// ------------------------------------------------------------
// Whitelist de admin-delegados — CRUD
// ------------------------------------------------------------

exports.agregarAdminWhitelist = onCall(async (request) => {
  const {negocioId, email} = request.data || {};
  if (!negocioId || !email) {
    throw new HttpsError("invalid-argument", "Se requiere negocioId y email");
  }
  requireAdminOrSuper(request.auth, negocioId);

  const cleanEmail = String(email).trim().toLowerCase();
  if (!cleanEmail.includes("@") || cleanEmail.length < 5) {
    throw new HttpsError("invalid-argument", "Email invalido");
  }

  const ek = emailKey(cleanEmail);
  const ref = negocioRefOf(negocioId)
      .collection(COL_CHAT_WHITELIST_ADMIN).doc(ek);

  const callerLabel = request.auth.token.email || request.auth.uid;
  await ref.set({
    email: cleanEmail,
    fechaAgregado: admin.firestore.FieldValue.serverTimestamp(),
    agregadoPor: callerLabel,
    habilitado: true,
  }, {merge: true});

  return {ok: true, emailKey: ek};
});

exports.quitarAdminWhitelist = onCall(async (request) => {
  const {negocioId, email} = request.data || {};
  if (!negocioId || !email) {
    throw new HttpsError("invalid-argument", "Se requiere negocioId y email");
  }
  requireAdminOrSuper(request.auth, negocioId);

  const ek = emailKey(email);
  const ref = negocioRefOf(negocioId)
      .collection(COL_CHAT_WHITELIST_ADMIN).doc(ek);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Email no esta en whitelist");
  }
  await ref.update({habilitado: false});

  // Si el delegado ya tenia uid asignado de un login previo, revoca
  // tokens y degrada role a "revocado" — mismo patron que revocarNodo.
  const data = snap.data();
  if (data.uid) {
    try {
      await admin.auth().revokeRefreshTokens(data.uid);
      await admin.auth().setCustomUserClaims(data.uid, {role: "revocado"});
    } catch (e) {
      console.warn("quitarAdminWhitelist: revoke fallo", data.uid, e.message);
    }
  }
  return {ok: true};
});

exports.listarAdminWhitelist = onCall(async (request) => {
  const {negocioId} = request.data || {};
  if (!negocioId) {
    throw new HttpsError("invalid-argument", "Se requiere negocioId");
  }
  requireAdminOrSuper(request.auth, negocioId);

  const snap = await negocioRefOf(negocioId)
      .collection(COL_CHAT_WHITELIST_ADMIN).get();
  return {
    items: snap.docs.map((d) => ({id: d.id, ...d.data()})),
  };
});

// ------------------------------------------------------------
// verificarAdminWhitelist — eleva claims tras Google sign-in
// ------------------------------------------------------------

exports.verificarAdminWhitelist = onCall(async (request) => {
  const {negocioId} = request.data || {};
  if (!negocioId) {
    throw new HttpsError("invalid-argument", "Se requiere negocioId");
  }
  // No requireAdmin: el llamante puede ser un user fresh sin claims.
  const auth = requireAuth(request.auth);
  const email = (auth.email || "").trim().toLowerCase();
  if (!email) {
    throw new HttpsError("failed-precondition", "Token sin email");
  }

  const ek = emailKey(email);
  const ref = negocioRefOf(negocioId)
      .collection(COL_CHAT_WHITELIST_ADMIN).doc(ek);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError("permission-denied", "Email no autorizado");
  }
  const data = snap.data();
  if (data.habilitado === false) {
    throw new HttpsError("permission-denied", "Acceso deshabilitado");
  }

  // Si es la primera vez que entra, guardamos el uid para poder revocar
  // luego sin necesitar el email otra vez.
  await ref.update({
    uid: request.auth.uid,
    ultimoLogin: admin.firestore.FieldValue.serverTimestamp(),
  });

  await admin.auth().setCustomUserClaims(request.auth.uid, {
    role: "admin",
    negocioId,
  });

  return {ok: true, role: "admin", negocioId};
});

// ------------------------------------------------------------
// Colaborador — CRUD
// ------------------------------------------------------------

exports.crearColaborador = onCall(async (request) => {
  const {negocioId, username, password, nombre} = request.data || {};
  if (!negocioId || !username || !password) {
    throw new HttpsError(
        "invalid-argument", "Se requiere negocioId, username y password");
  }
  requireAdminOrSuper(request.auth, negocioId);

  const usernameNorm = String(username).trim().toLowerCase();
  if (!usernameNorm || /\s/.test(usernameNorm)) {
    throw new HttpsError(
        "invalid-argument", "Username invalido (sin espacios)");
  }
  if (typeof password !== "string" ||
      password.length < COLABORADOR_PASSWORD_MIN_LEN) {
    throw new HttpsError(
        "invalid-argument",
        `Password requiere al menos ${COLABORADOR_PASSWORD_MIN_LEN} caracteres`);
  }

  // Validar uniqueness de username dentro del negocio.
  const dup = await negocioRefOf(negocioId)
      .collection(COL_COLABORADORES)
      .where("username", "==", usernameNorm)
      .limit(1)
      .get();
  if (!dup.empty) {
    throw new HttpsError("already-exists", "Username ya existe");
  }

  // Crear auth user → uid es el colaboradorId.
  const authUser = await admin.auth().createUser({});
  const colaboradorId = authUser.uid;
  let docRef = null;
  try {
    await admin.auth().setCustomUserClaims(colaboradorId, {
      role: "colaborador",
      negocioId,
      colaboradorId,
    });

    docRef = negocioRefOf(negocioId)
        .collection(COL_COLABORADORES).doc(colaboradorId);
    await docRef.set({
      colaboradorId,
      username: usernameNorm,
      nombre: nombre ? String(nombre).trim() : usernameNorm,
      passwordHash: hashColaboradorPassword(password),
      habilitado: true,
      fechaCreacion: admin.firestore.FieldValue.serverTimestamp(),
      creadoPor: request.auth.token.email || request.auth.uid,
    });

    return {ok: true, colaboradorId};
  } catch (err) {
    // Rollback del auth user si la persistencia fallo.
    console.error("crearColaborador rollback:", err.message);
    if (docRef) {
      await docRef.delete().catch(() => {});
    }
    await admin.auth().deleteUser(colaboradorId).catch(() => {});
    if (err instanceof HttpsError) throw err;
    throw new HttpsError("internal", `crearColaborador: ${err.message}`);
  }
});

exports.actualizarColaborador = onCall(async (request) => {
  const {negocioId, colaboradorId, nombre, habilitado, nuevoPassword} =
    request.data || {};
  if (!negocioId || !colaboradorId) {
    throw new HttpsError(
        "invalid-argument", "Se requiere negocioId y colaboradorId");
  }
  requireAdminOrSuper(request.auth, negocioId);

  const ref = negocioRefOf(negocioId)
      .collection(COL_COLABORADORES).doc(colaboradorId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Colaborador no existe");
  }

  const updates = {
    fechaActualizacion: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (typeof nombre === "string" && nombre.trim().length > 0) {
    updates.nombre = nombre.trim();
  }
  if (typeof habilitado === "boolean") {
    updates.habilitado = habilitado;
  }
  if (typeof nuevoPassword === "string" && nuevoPassword.length > 0) {
    if (nuevoPassword.length < COLABORADOR_PASSWORD_MIN_LEN) {
      throw new HttpsError(
          "invalid-argument",
          `Password requiere al menos ${COLABORADOR_PASSWORD_MIN_LEN} caracteres`);
    }
    updates.passwordHash = hashColaboradorPassword(nuevoPassword);
    // Cambio de password = invalida tokens activos.
    try {
      await admin.auth().revokeRefreshTokens(colaboradorId);
    } catch (e) {
      console.warn("actualizarColaborador: revoke fallo", e.message);
    }
  }

  await ref.update(updates);
  return {ok: true};
});

exports.eliminarColaborador = onCall(async (request) => {
  const {negocioId, colaboradorId} = request.data || {};
  if (!negocioId || !colaboradorId) {
    throw new HttpsError(
        "invalid-argument", "Se requiere negocioId y colaboradorId");
  }
  requireAdminOrSuper(request.auth, negocioId);

  const ref = negocioRefOf(negocioId)
      .collection(COL_COLABORADORES).doc(colaboradorId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Colaborador no existe");
  }

  // Hard delete: borramos el doc, el auth user y limpiamos membresías.
  // Los mensajes históricos preservan el nombre via `remitenteNombre`
  // (snapshot al momento del envío), así que borrar el colaborador no
  // rompe el render de chats viejos.

  // 1. Quitar de todos los grupos donde este habilitado.
  const grupos = await negocioRefOf(negocioId)
      .collection(COL_CHAT_GRUPOS)
      .where("colaboradoresHabilitados", "array-contains", colaboradorId)
      .get();
  if (!grupos.empty) {
    const batch = db.batch();
    grupos.forEach((g) => {
      batch.update(g.ref, {
        colaboradoresHabilitados:
          admin.firestore.FieldValue.arrayRemove(colaboradorId),
        miembros: admin.firestore.FieldValue.arrayRemove(colaboradorId),
      });
    });
    await batch.commit();
  }

  // 2. Borrar el doc.
  await ref.delete();

  // 3. Borrar el auth user.
  try {
    await admin.auth().deleteUser(colaboradorId);
  } catch (e) {
    console.warn("eliminarColaborador: deleteUser fallo", e.message);
  }

  return {ok: true, gruposLimpiados: grupos.size};
});

// ------------------------------------------------------------
// loginColaborador — público, valida password y emite custom token
// ------------------------------------------------------------

exports.loginColaborador = onCall(async (request) => {
  const {negocioId, username, password} = request.data || {};
  if (!negocioId || !username || !password) {
    throw new HttpsError(
        "invalid-argument", "Se requiere negocioId, username y password");
  }
  const usernameNorm = String(username).trim().toLowerCase();
  const dup = await negocioRefOf(negocioId)
      .collection(COL_COLABORADORES)
      .where("username", "==", usernameNorm)
      .limit(1)
      .get();
  if (dup.empty) {
    throw new HttpsError("permission-denied", "Credenciales invalidas");
  }
  const docSnap = dup.docs[0];
  const data = docSnap.data();
  if (!data.habilitado) {
    throw new HttpsError("permission-denied", "Cuenta deshabilitada");
  }
  const expected = data.passwordHash;
  const got = hashColaboradorPassword(password);
  if (expected !== got) {
    throw new HttpsError("permission-denied", "Credenciales invalidas");
  }

  const colaboradorId = docSnap.id;
  // Re-aplica claims por si fueron alterados durante una pausa de cuenta.
  await admin.auth().setCustomUserClaims(colaboradorId, {
    role: "colaborador",
    negocioId,
    colaboradorId,
  });
  const customToken = await admin.auth().createCustomToken(colaboradorId, {
    role: "colaborador",
    negocioId,
    colaboradorId,
  });
  await docSnap.ref.update({
    ultimoLogin: admin.firestore.FieldValue.serverTimestamp(),
  });
  return {ok: true, customToken, colaboradorId};
});

// ------------------------------------------------------------
// Habilitar / quitar colaborador en un grupo de nodo
// ------------------------------------------------------------

exports.habilitarColaboradorEnGrupo = onCall(async (request) => {
  const {negocioId, nodoId, colaboradorId} = request.data || {};
  if (!negocioId || !nodoId || !colaboradorId) {
    throw new HttpsError(
        "invalid-argument", "Se requiere negocioId, nodoId y colaboradorId");
  }
  requireAdminOrSuper(request.auth, negocioId);

  const negocioRef = negocioRefOf(negocioId);
  const colabSnap = await negocioRef
      .collection(COL_COLABORADORES).doc(colaboradorId).get();
  if (!colabSnap.exists || colabSnap.data().habilitado === false) {
    throw new HttpsError("not-found", "Colaborador no disponible");
  }
  const grupoRef = negocioRef.collection(COL_CHAT_GRUPOS).doc(nodoId);
  const grupoSnap = await grupoRef.get();
  if (!grupoSnap.exists) {
    throw new HttpsError("not-found", "Grupo del nodo no existe");
  }

  await grupoRef.update({
    colaboradoresHabilitados:
      admin.firestore.FieldValue.arrayUnion(colaboradorId),
    miembros: admin.firestore.FieldValue.arrayUnion(colaboradorId),
    fechaActividad: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {ok: true};
});

exports.quitarColaboradorDeGrupo = onCall(async (request) => {
  const {negocioId, nodoId, colaboradorId} = request.data || {};
  if (!negocioId || !nodoId || !colaboradorId) {
    throw new HttpsError(
        "invalid-argument", "Se requiere negocioId, nodoId y colaboradorId");
  }
  requireAdminOrSuper(request.auth, negocioId);

  const grupoRef = negocioRefOf(negocioId)
      .collection(COL_CHAT_GRUPOS).doc(nodoId);
  await grupoRef.update({
    colaboradoresHabilitados:
      admin.firestore.FieldValue.arrayRemove(colaboradorId),
    miembros: admin.firestore.FieldValue.arrayRemove(colaboradorId),
    fechaActividad: admin.firestore.FieldValue.serverTimestamp(),
  });
  return {ok: true};
});

// ------------------------------------------------------------
// asegurarChatGrupoNodo — idempotente. Crea el meta del grupo si no
// existe. Pensado para backfill de nodos registrados antes de que se
// integrara la inicializacion en `registrarNodo`. Lo puede llamar:
//   - Admin del negocio (forzar bootstrap).
//   - El propio nodo (auto-create cuando abre el chat por primera vez).
// ------------------------------------------------------------
exports.asegurarChatGrupoNodo = onCall(async (request) => {
  const {negocioId, nodoId} = request.data || {};
  if (!negocioId || !nodoId) {
    throw new HttpsError(
        "invalid-argument", "Se requiere negocioId y nodoId");
  }
  const t = requireAuth(request.auth);
  const esAdmin = t.role === "superadmin" ||
    (t.role === "admin" && t.negocioId === negocioId);
  const esElNodo = t.role === "nodo" &&
    t.negocioId === negocioId &&
    t.nodoId === nodoId;
  if (!esAdmin && !esElNodo) {
    throw new HttpsError("permission-denied", "No autorizado para este grupo");
  }

  const ref = negocioRefOf(negocioId)
      .collection(COL_CHAT_GRUPOS).doc(nodoId);
  const existing = await ref.get();
  if (existing.exists) {
    return {ok: true, creado: false};
  }

  const nodoSnap = await negocioRefOf(negocioId)
      .collection(COL_NODOS).doc(nodoId).get();
  if (!nodoSnap.exists) {
    throw new HttpsError("not-found", "Nodo no existe");
  }

  await inicializarChatGrupoNodo(negocioId, nodoId);
  return {ok: true, creado: true};
});

// ------------------------------------------------------------
// Helper interno: arma el meta inicial del grupo de un nodo.
// Usado por `registrarNodo` después de crear el doc del nodo y por
// `asegurarChatGrupoNodo` al hacer backfill.
// ------------------------------------------------------------
async function inicializarChatGrupoNodo(negocioId, nodoId) {
  const negocioRef = negocioRefOf(negocioId);

  // Miembros iniciales = superadmins del negocio + delegados habilitados
  // con uid resuelto + el propio nodo.
  const miembros = new Set([nodoId]);

  // Superadmin: cualquier user con role "superadmin" Y negocioId === este.
  // No hay collection de "usuarios" garantizada. Solución: leemos los uids
  // de la whitelist con habilitado=true y uid presente; el superadmin
  // (jesús) NO está en whitelist — se incluye si existe el doc /usuarios
  // del schema legacy. Por ahora confiamos en delegados+nodo y aceptamos
  // que el superadmin se agregue al chat la primera vez que lo abra
  // (auto-join al hacer un read del chat con role=superadmin).

  const whitelistSnap = await negocioRef
      .collection(COL_CHAT_WHITELIST_ADMIN)
      .where("habilitado", "==", true)
      .get();
  whitelistSnap.forEach((d) => {
    const uid = d.data().uid;
    if (uid) miembros.add(uid);
  });

  await negocioRef.collection(COL_CHAT_GRUPOS).doc(nodoId).set({
    chatId: nodoId,
    tipo: "grupo",
    nodoId,
    miembros: Array.from(miembros),
    colaboradoresHabilitados: [],
    estadoPorMiembro: {},
    fechaCreacion: admin.firestore.FieldValue.serverTimestamp(),
    fechaActividad: admin.firestore.FieldValue.serverTimestamp(),
  });
}

// ============================================================
// loginMercanciaConPin — login por PIN de mercancia-web (Fase 3B).
// PREREQUISITO para CERRAR las reglas de Firestore: hoy mercancia-web valida el
// PIN solo del lado cliente y escribe SIN auth. Esta CF le da una IDENTIDAD real
// (customToken con claims role:"mercancia") para que las reglas puedan exigirla.
// Verifica el hash del PIN (= sha256("amise.mercancia.v1:"+pin), IDÉNTICO a
// shared/src/pinHash.ts) contra usuariosMercancia de la sucursal + habilitado.
// Rate-limit por sucursal para frenar fuerza bruta (PIN de 5 dígitos).
// NOTA: cuando se active App Check, añadir enforceAppCheck:true aquí también.
// ============================================================
const MERCANCIA_PIN_SALT = "amise.mercancia.v1"; // DEBE coincidir con shared/src/pinHash.ts
const MERCANCIA_MAX_INTENTOS = 10; // intentos fallidos por ventana (tunable)
const MERCANCIA_WINDOW_MS = 60 * 1000; // 1 min

exports.loginMercanciaConPin = onCall(
    {timeoutSeconds: 20, memory: "256MiB"},
    async (request) => {
      const {negocioId, sucursalId, pin} = request.data || {};
      if (!negocioId || !sucursalId) {
        throw new HttpsError("invalid-argument", "negocioId y sucursalId requeridos");
      }
      if (typeof pin !== "string" || !/^\d{5}$/.test(pin)) {
        throw new HttpsError("invalid-argument", "PIN inválido (5 dígitos)");
      }
      const sucDataCol = `sucursales_data${SUFFIX}`;

      // Rate-limit por sucursal (contador con ventana) — frena la fuerza bruta.
      // Cada intento incrementa; un login OK lo resetea (abajo).
      const rlRef = db.collection(COL_NEGOCIOS).doc(negocioId)
          .collection(sucDataCol).doc(sucursalId)
          .collection("mercanciaRateLimit").doc("login");
      const now = Date.now();
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(rlRef);
        const d = snap.exists ? snap.data() : {};
        const winStart = typeof d.winStart === "number" ? d.winStart : 0;
        const within = now - winStart < MERCANCIA_WINDOW_MS;
        const count = within && typeof d.count === "number" ? d.count : 0;
        if (count >= MERCANCIA_MAX_INTENTOS) {
          throw new HttpsError("resource-exhausted", "Demasiados intentos. Espera un minuto.");
        }
        tx.set(rlRef, within ? {count: count + 1} : {winStart: now, count: 1}, {merge: true});
      });

      // Buscar el usuario por hash del PIN en la sucursal.
      const crypto = require("crypto");
      const pinHash = crypto.createHash("sha256")
          .update(`${MERCANCIA_PIN_SALT}:${pin}`).digest("hex");
      const q = await db.collection(COL_NEGOCIOS).doc(negocioId)
          .collection(sucDataCol).doc(sucursalId)
          .collection(`usuariosMercancia${SUFFIX}`)
          .where("pinHash", "==", pinHash).limit(1).get();
      if (q.empty) {
        throw new HttpsError("permission-denied", "PIN no reconocido");
      }
      const docSnap = q.docs[0];
      const data = docSnap.data() || {};
      if (data.habilitado !== true) {
        throw new HttpsError("permission-denied", "Acceso deshabilitado");
      }

      // Éxito: reset del rate-limit + customToken con el rol del usuario.
      // `acceso: "existencias"` es el encargado de tienda: su rol `encargado`
      // solo lee (ver firestore.rules) y mueve piezas con `moverExistencias`.
      // Sin `acceso` es el usuario de siempre, rol `mercancia`.
      await rlRef.set({winStart: now, count: 0}, {merge: true});
      const mercanciaUid = docSnap.id;
      // El id del registro lo elige quien lo crea y es el uid de la sesión:
      // si coincide con el de otra cuenta (admin, superadmin, una caja), no
      // se le da una sesión con ese uid.
      if (await esCuentaAjenaAMercancia(mercanciaUid)) {
        logger.warn("loginMercanciaConPin: el id del usuario es el de otra cuenta",
            {negocioId, sucursalId, mercanciaUid});
        throw new HttpsError("permission-denied",
            "Este usuario no puede entrar. Pide al administrador que lo vuelva a crear.");
      }
      const acceso = data.acceso === "existencias" ? "existencias" : "completo";
      const token = await admin.auth().createCustomToken(mercanciaUid, {
        role: acceso === "existencias" ? "encargado" : "mercancia",
        negocioId,
        sucursalId,
        mercanciaUid,
      });
      return {token, usuarioId: mercanciaUid, nombre: data.nombre || "", acceso};
    },
);

/**
 * ¿El uid es de una cuenta que NO es una sesión de PIN de mercancía? Las de
 * PIN nacen de un custom token: no tienen correo, proveedor de acceso ni
 * permisos guardados en la cuenta. Admin, superadmin y las cajas sí. El id
 * de un usuario de mercancía lo elige quien lo crea, así que podría coincidir
 * con el uid de otra cuenta: a esa nunca se le da una sesión de PIN ni se le
 * cortan las suyas.
 * @param {string} uid
 * @return {Promise<boolean>}
 */
async function esCuentaAjenaAMercancia(uid) {
  let cuenta;
  try {
    cuenta = await admin.auth().getUser(uid);
  } catch (e) {
    if (e && e.code === "auth/user-not-found") return false;
    throw e;
  }
  return (cuenta.providerData || []).length > 0 ||
    Object.keys(cuenta.customClaims || {}).length > 0 ||
    !!cuenta.email || !!cuenta.phoneNumber;
}

// ============================================================
// moverExistencias — piezas entre la bodega y la tienda de una sucursal
// ============================================================
// La llama mercancia-web con la sesión del PIN (rol `encargado` o
// `mercancia`). El encargado no escribe nada en Firestore: esta CF es la
// única forma de cambiar sus existencias, y solo MUEVE (lo que sale de un
// lado entra al otro; nunca más de lo que hay en el origen). Todo o nada, en
// una transacción, junto con su registro (quién, cuándo, antes y después).
// El id del movimiento lo pone la app: repetir la llamada no mueve dos veces.
// Si la app se queda sin respuesta, pregunta con `anular: true`: o el
// movimiento ya está registrado (se lo devuelve), o ese id queda ANULADO para
// siempre y ningún intento tardío lo puede aplicar. Así la app solo deja
// cambiar la lista cuando es seguro, sin suponer cuánto puede tardar.
// Lógica pura en lib/existenciasTienda.js.
const existenciasTienda = require("./lib/existenciasTienda");

exports.moverExistencias = onCall(
    {timeoutSeconds: 30, memory: "256MiB"},
    async (request) => {
      const t = (request.auth && request.auth.token) || {};
      if (!request.auth || !["encargado", "mercancia"].includes(t.role) ||
          !t.negocioId || !t.sucursalId) {
        throw new HttpsError("permission-denied", "Entra con tu PIN para mover existencias");
      }
      let peticion;
      try {
        peticion = existenciasTienda.normalizarPeticion(request.data);
      } catch (e) {
        throw new HttpsError("invalid-argument", e.message);
      }
      const {negocioId, sucursalId} = t;
      const usuarioId = request.auth.uid;
      const negocioRef = db.collection(COL_NEGOCIOS).doc(negocioId);
      const sucDataRef = negocioRef
          .collection(`sucursales_data${SUFFIX}`).doc(sucursalId);
      const movRef = sucDataRef
          .collection(`movimientos_existencias${SUFFIX}`).doc(peticion.movimientoId);
      // Envíos anulados: aparte, para no mezclarlos con los movimientos (las
      // reglas no dejan leer ni escribir esta colección a nadie).
      const anuladoRef = sucDataRef
          .collection(`movimientos_anulados${SUFFIX}`).doc(peticion.movimientoId);

      // La misma llamada repetida (se perdió la respuesta): no mueve otra
      // vez y contesta lo que ya quedó. Si ese id es de otra persona, no es
      // un reintento.
      const yaHecho = (previo) => {
        if (previo.usuarioId !== usuarioId) {
          throw new HttpsError("already-exists", "Ese movimiento ya existe");
        }
        return {
          ok: true, ya: true,
          direccion: previo.direccion,
          piezas: previo.piezas,
          renglones: previo.renglones,
        };
      };
      // Se revisa ANTES que lo demás: un reintento debe enterarse de que su
      // movimiento sí se aplicó aunque después hayan deshabilitado a la
      // persona o cambiado la sucursal. Si no, la app no sabría si se movió.
      const aplicado = await movRef.get();
      if (aplicado.exists) return yaHecho(aplicado.data());

      // Aclarar un envío que quedó sin respuesta. En UNA transacción: si ya
      // hay movimiento, se devuelve; si no, el id queda anulado. El envío
      // original y esta pregunta nunca "ganan" los dos: Firestore los ordena.
      // Va antes de revisar a la persona: debe poder aclararlo aunque después
      // la hayan deshabilitado.
      if (peticion.anular) {
        const previo = await db.runTransaction(async (tx) => {
          const [mov, anulado] = await tx.getAll(movRef, anuladoRef);
          if (mov.exists) return mov.data();
          if (!anulado.exists) {
            tx.create(anuladoRef, {
              movimientoId: peticion.movimientoId,
              sucursalId,
              usuarioId,
              fecha: new Date().toISOString(),
              creadoEn: FieldValue.serverTimestamp(),
            });
          }
          return null;
        });
        if (previo) return yaHecho(previo);
        logger.info("moverExistencias: envío anulado", {
          negocioId, sucursalId, usuarioId, movimientoId: peticion.movimientoId,
        });
        return {ok: true, anulado: true};
      }

      // La persona sigue habilitada (el token dura una hora) y la sucursal
      // maneja bodega y tienda (las de mayoreo).
      const [usuarioSnap, sucursalSnap] = await Promise.all([
        sucDataRef.collection(`usuariosMercancia${SUFFIX}`).doc(usuarioId).get(),
        negocioRef.collection(COL_SUCURSALES).doc(sucursalId).get(),
      ]);
      if (!usuarioSnap.exists || usuarioSnap.get("habilitado") !== true) {
        throw new HttpsError("permission-denied", "Tu acceso está deshabilitado");
      }
      if (!sucursalSnap.exists || sucursalSnap.get("modoMayoreo") !== true) {
        throw new HttpsError("failed-precondition",
            "Esta sucursal no maneja bodega y tienda");
      }
      const usuarioNombre = String(usuarioSnap.get("nombre") || "");
      const ubicacion = await cargarUbicacionStock(negocioRef, sucursalId);
      const artRef = (id) =>
        negocioRef.collection("articulos_n_web_new_version").doc(id);

      const r = await db.runTransaction(async (tx) => {
        const [previo, anulado] = await tx.getAll(movRef, anuladoRef);
        if (previo.exists) return {previo: previo.data()};
        // La app ya preguntó por este envío y quedó anulado: no se aplica.
        if (anulado.exists) return {anulado: true};
        const ids = [...new Set(peticion.renglones.map((x) => x.articuloId))];
        const snaps = await tx.getAll(...ids.map(artRef));
        const articulos = new Map(
            snaps.map((s) => [s.id, s.exists ? s.data() : null]));
        const plan = existenciasTienda.planearMovimiento(
            articulos, peticion.renglones, peticion.direccion, ubicacion);
        if (plan.faltantes.length > 0) return {faltantes: plan.faltantes};
        plan.patches.forEach((patch, id) => tx.update(artRef(id), patch));
        const movimiento = {
          movimientoId: peticion.movimientoId,
          sucursalId,
          direccion: peticion.direccion,
          renglones: plan.renglones,
          piezas: plan.renglones.reduce((acc, x) => acc + x.piezas, 0),
          usuarioId,
          usuarioNombre,
          fecha: new Date().toISOString(),
          creadoEn: FieldValue.serverTimestamp(),
        };
        tx.create(movRef, movimiento);
        return {movimiento};
      });

      if (r.faltantes) {
        throw new HttpsError("failed-precondition",
            existenciasTienda.mensajeFaltantes(r.faltantes, peticion.direccion),
            {faltantes: r.faltantes.map((f) => ({
              articuloId: f.articuloId,
              subvariacionCodigo: f.subvariacionCodigo || null,
              motivo: f.motivo,
              piezas: f.piezas,
              hay: typeof f.hay === "number" ? f.hay : null,
            }))});
      }
      // Dos llamadas iguales a la vez: la segunda encuentra lo que dejó la
      // primera dentro de la transacción.
      if (r.previo) return yaHecho(r.previo);
      if (r.anulado) {
        throw new HttpsError("failed-precondition",
            "No se movió nada. Ese envío se canceló: vuelve a mandarlo.",
            {anulado: true});
      }
      logger.info("moverExistencias", {
        negocioId, sucursalId, usuarioId,
        movimientoId: peticion.movimientoId,
        direccion: peticion.direccion,
        piezas: r.movimiento.piezas,
        renglones: r.movimiento.renglones.length,
      });
      return {
        ok: true, ya: false,
        direccion: r.movimiento.direccion,
        piezas: r.movimiento.piezas,
        renglones: r.movimiento.renglones,
      };
    },
);

// ============================================================
// cortarSesionMercancia — la sesión de mercancía sigue a su usuario
// ============================================================
// El rol (`mercancia` o `encargado`) va en el token desde que la persona
// entra con su PIN, y un token se renueva solo. Si admin la deshabilita, la
// borra o le cambia el tipo de acceso, aquí se revocan sus sesiones: tiene
// que volver a entrar y toma el permiso nuevo. Las reglas además revisan en
// vivo cada escritura de mercancía (`mercanciaVigente`), así que el corte de
// lo que puede escribir es inmediato.
exports.cortarSesionMercancia = onDocumentWritten(
    {
      document: "negocios_web_new_version/{negocioId}/" +
        "sucursales_data_web_new_version/{sucursalId}/" +
        "usuariosMercancia_web_new_version/{uid}",
    },
    async (event) => {
      const antes = event.data && event.data.before.exists ?
        event.data.before.data() : null;
      const despues = event.data && event.data.after.exists ?
        event.data.after.data() : null;
      if (!antes) return; // alta: todavía no hay sesión que cortar
      const acceso = (d) => (d.acceso === "existencias" ? "existencias" : "completo");
      const cortar = !despues ||
        (antes.habilitado === true && despues.habilitado !== true) ||
        acceso(antes) !== acceso(despues);
      if (!cortar) return;
      const {negocioId, sucursalId, uid} = event.params;
      // El id del registro lo elige quien lo crea: si es el uid de otra
      // cuenta (admin, superadmin, una caja), a esa no se le corta nada.
      if (await esCuentaAjenaAMercancia(uid)) {
        logger.warn("cortarSesionMercancia: el id es el de otra cuenta; no se toca",
            {negocioId, sucursalId, uid});
        return;
      }
      try {
        await admin.auth().revokeRefreshTokens(uid);
        logger.info("cortarSesionMercancia", {negocioId, sucursalId, uid});
      } catch (e) {
        // Nunca entró: no hay sesión.
        if (e && e.code === "auth/user-not-found") return;
        throw e;
      }
    },
);

// ============================================================
// canjearEnlaceLote — sesión de un teléfono que entra por una URL
// ============================================================
// Lotes de envío: armar un lote desde un teléfono (enlace `armar`, con
// apagador) o subir fotos de un lote (enlace `recibir`, QR de la caja, 30
// minutos). También la PC de la impresora (`imprimir`) y la página aparte de
// etiquetas de precio (`precio`). No pide sesión: la llave es el secreto de
// la URL. Reglas de
// quién entra en lib/enlaceLote.js; lo que la sesión puede hacer, en
// firestore.rules (`esEnlace`) y storage.rules (`esEnlaceDeFotos`).
const enlaceLote = require("./lib/enlaceLote");

exports.canjearEnlaceLote = onCall(
    {timeoutSeconds: 20, memory: "256MiB", maxInstances: 5},
    async (request) => {
      const data = request.data || {};
      if (!enlaceLote.entradaValida(data)) {
        throw new HttpsError("permission-denied", enlaceLote.mensajeDeMotivo("no_sirve"));
      }
      const {negocioId, enlaceId, secreto} = data;
      const negocioRef = db.collection(COL_NEGOCIOS).doc(negocioId);
      const ref = negocioRef.collection(`enlaces_lote${SUFFIX}`).doc(enlaceId);
      const ahoraMs = Date.now();
      // Un uid por teléfono: admin ve quién entró y las fotos llevan su dueño.
      const uidNuevo = `enl_${enlaceId}_${cryptoNode.randomBytes(6).toString("hex")}`;
      // Del número del dispositivo solo se guarda su huella (como del secreto).
      const dispositivoHash = typeof data.dispositivo === "string" ?
        acceso.hashSecreto(data.dispositivo) : "";
      const headers = (request.rawRequest && request.rawRequest.headers) || {};
      const userAgent = String(headers["user-agent"] || "").slice(0, 200);

      const r = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const d = snap.exists ? snap.data() : null;
        // El secreto va primero: sin él no se revela nada del enlace.
        if (!d || !acceso.llaveCoincide(secreto, d.secretoHash)) {
          return {ok: false, motivo: "no_sirve"};
        }
        const creadoEnMs = d.creadoEn && typeof d.creadoEn.toMillis === "function" ?
          d.creadoEn.toMillis() : 0;
        const decision = enlaceLote.decidirCanje({...d, creadoEnMs}, ahoraMs, dispositivoHash);
        // Con el secreto bien ya se puede decir el mensaje propio de su tipo.
        if (!decision.ok) return {...decision, tipo: d.tipo};
        const uid = decision.uid || uidNuevo;
        let lote = null;
        if (d.tipo === "recibir") {
          const loteSnap = await tx.get(
              negocioRef.collection(`resurtidos${SUFFIX}`).doc(d.resurtidoId));
          if (!loteSnap.exists) return {ok: false, motivo: "sin_lote"};
          const l = loteSnap.data() || {};
          lote = {
            folio: l.folio || loteSnap.id,
            sucursalDestinoNombre: l.sucursalDestinoNombre || "",
          };
        }
        // El mismo teléfono que vuelve a entrar no gasta otra entrada.
        tx.update(ref, decision.uid ?
          {ultimoUsoMs: ahoraMs, [`sesiones.${uid}.ultimoMs`]: ahoraMs} :
          {
            canjes: (Number(d.canjes) || 0) + 1,
            ultimoUsoMs: ahoraMs,
            [`sesiones.${uid}`]: {
              fechaMs: ahoraMs,
              gen: Number(d.gen) || 0,
              venceMs: decision.venceMs,
              ...(dispositivoHash ? {dispositivo: dispositivoHash} : {}),
              ...(userAgent ? {userAgent} : {}),
            },
          });
        return {ok: true, venceMs: decision.venceMs, enlace: d, lote, uid};
      });
      if (!r.ok) {
        throw new HttpsError("permission-denied", enlaceLote.mensajeDeMotivo(r.motivo, r.tipo));
      }

      const uid = r.uid;
      const claims = enlaceLote.claimsDeEnlace(negocioId, enlaceId, r.enlace, r.venceMs);
      const token = await admin.auth().createCustomToken(uid, claims);
      // Lo propio de cada tipo (`r.lote` solo existe en `recibir`).
      let extra;
      if (r.enlace.tipo === "armar") {
        extra = {letra: r.enlace.letra};
      } else if (r.enlace.tipo === "imprimir") {
        extra = r.enlace.sucursalId ? {sucursalId: r.enlace.sucursalId} : {};
      } else if (r.enlace.tipo === "precio") {
        extra = {};
      } else {
        extra = {
          resurtidoId: r.enlace.resurtidoId,
          folio: r.lote.folio,
          sucursalDestinoNombre: r.lote.sucursalDestinoNombre,
        };
      }
      return {
        token,
        uid,
        tipo: r.enlace.tipo,
        nombre: r.enlace.nombre || "",
        // El teléfono cuenta el tiempo con estos dos, no con su reloj.
        ahoraMs,
        venceMs: r.venceMs,
        ...extra,
      };
    },
);

// ============================================================
// PUNTOS / MONEDERO — CF intermediarias hacia amise.mx
// El cliente (nodo-web) NUNCA ve LOYALTY_POS_SECRET; solo lo usa la CF.
// ============================================================

/** Llama a una API de amise.mx con el Bearer secret. Lanza HttpsError útil. */
async function llamarAmise(path, payload) {
  let resp;
  try {
    resp = await fetch(`${AMISE_API_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOYALTY_POS_SECRET.value()}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    throw new HttpsError("unavailable", `No se pudo contactar a amise.mx: ${e.message}`,
        {amiseStatus: 0, retriable: true});
  }
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw errorAmise(resp.status, data);
  return data;
}

/**
 * Error de amise para la caja. 5xx = fallo TRANSITORIO → 'unavailable' (todas
 * las ops de lealtad son idempotentes: earn/card por ventaId, canje por key,
 * gift por ventaId → reintentar no duplica). 409 = idempotencia/conflicto;
 * otro 4xx = terminal → 'internal'. `details.retriable` le dice a la cola de
 * la caja si reintentar: del lado del navegador una red caída TAMBIÉN llega
 * como 'internal' (sin details), así que el código solo no alcanza.
 */
function errorAmise(status, data) {
  const code = status >= 500 ?
      "unavailable" :
      status === 409 ? "already-exists" : "internal";
  return new HttpsError(code, (data && data.error) || `amise.mx ${status}`,
      {amiseStatus: status, retriable: status >= 500});
}

/** /balance de amise sin filtrar: solo para verificar del lado del servidor. */
const consultarBalance = (payload) => llamarAmise("/api/loyalty/balance", payload);

/**
 * Deja rastro de cada verificación de identidad (modo observar: así se ve qué
 * se rechazaría antes de exigir). Sin datos personales: teléfono con 4 dígitos.
 */
function registrarVerificacion(fn, v, t, phone) {
  const datos = {fn, motivo: v.motivo, exigir: puntosSeg.EXIGIR_IDENTIDAD,
    nodoId: t.nodoId || null, sucursalId: t.sucursalId || null,
    tel: puntosSeg.ultimos4(phone)};
  if (v.ok) logger.info("puntos_verificacion", datos);
  else logger.warn("puntos_verificacion", datos);
}

// Pre-registro del cliente de puntos (correo + teléfono + nombre + contraseña
// temporal generada en el POS). Input: { email, phone, nombre?, code }.
exports.registrarClientePuntos = onCall(
    {secrets: [LOYALTY_POS_SECRET], timeoutSeconds: 30, memory: "256MiB"},
    async (request) => {
      // Exige la sesión de la caja (lib/rolesPuntos.js). LOYALTY_POS_SECRET solo
      // autentica a esta function ante amise.mx, no a quien la llama.
      requireRolPuntos(request.auth);
      const {email, phone, nombre, code} = request.data || {};
      if (!email || typeof email !== "string") {
        throw new HttpsError("invalid-argument", "email requerido");
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new HttpsError("invalid-argument", "email inválido");
      }
      if (!code || typeof code !== "string") {
        throw new HttpsError("invalid-argument", "code requerido");
      }
      await llamarAmise("/api/loyalty/register", {email, phone, nombre, code});
      return {ok: true};
    },
);

// Acredita los puntos de una venta. Input: { email?|phone?, amount, ventaId,
// sucursalId, nodoId }. Idempotente por ventaId del lado de amise.mx.
exports.acreditarPuntos = onCall(
    {secrets: [LOYALTY_POS_SECRET], timeoutSeconds: 30, memory: "256MiB"},
    async (request) => {
      const t = requireRolPuntos(request.auth);
      const {email, phone, amount, ventaId} = request.data || {};
      if (!ventaId || typeof ventaId !== "string") {
        throw new HttpsError("invalid-argument", "ventaId requerido");
      }
      if (!email && !phone) {
        throw new HttpsError("invalid-argument", "email o phone requerido");
      }
      const amt = Number(amount);
      if (!isFinite(amt) || amt < 0) {
        throw new HttpsError("invalid-argument", "amount inválido");
      }
      // sucursal/nodo: del TOKEN (confiable), no de lo que mande el cliente.
      const data = await llamarAmise("/api/loyalty/earn", {
        email, phone, amount: amt, ventaId,
        sucursalId: t.sucursalId || request.data.sucursalId || null,
        nodoId: t.nodoId || request.data.nodoId || null,
      });
      return {
        ok: true,
        // Cashback: added/balance vienen en $ desde amise.mx.
        added: Number(data.added) || 0,
        balance: Number(data.balance) || 0,
        valorPorPeso: Number(data.valorPorPeso) || 0,
        already: Boolean(data.already),
      };
    },
);

// Consulta el saldo de cashback del cliente (por teléfono, correo o tarjeta).
// Input: { email?, phone?, codigo? } → { exists, saldoDinero, saldoUsable,
// valorPorPeso, telefono, tarjeta }. Solo lo que la caja usa (sin correo ni
// datos internos); al exigir, si no se consultó escaneando la tarjeta, esta va
// con sus últimos 4 dígitos (el código completo solo lo tiene quien la trae).
exports.consultarSaldoPuntos = onCall(
    {secrets: [LOYALTY_POS_SECRET], timeoutSeconds: 30, memory: "256MiB"},
    async (request) => {
      requireRolPuntos(request.auth);
      const {email, phone, codigo} = request.data || {};
      if (!email && !phone && !codigo) {
        throw new HttpsError("invalid-argument", "email, phone o codigo requerido");
      }
      const data = await llamarAmise("/api/loyalty/balance", {email, phone, codigo});
      return puntosSeg.filtrarSaldo(data,
          {porCodigo: Boolean(codigo) && !email && !phone});
    },
);

// Canjea (debita) cashback ($) al cobrar. Idempotente por idempotencyKey (= ventaId).
// Input: { phone, codigo? | email?, money, idempotencyKey } → { ok, redeemed, balance, money }.
// La tarjeta es opcional (decisión del dueño, 2026-11-02): se usa con la tarjeta
// escaneada o con el correo del cliente; cualquiera debe ser del monedero de ese
// teléfono. Misma regla que el crédito de regalo.
exports.canjearPuntos = onCall(
    {secrets: [LOYALTY_POS_SECRET], timeoutSeconds: 30, memory: "256MiB"},
    async (request) => {
      const t = requireRolPuntos(request.auth);
      const {email, phone, codigo, money, idempotencyKey} = request.data || {};
      if (!idempotencyKey || typeof idempotencyKey !== "string") {
        throw new HttpsError("invalid-argument", "idempotencyKey requerido");
      }
      const m = Number(money);
      if (!isFinite(m) || m <= 0) {
        throw new HttpsError("invalid-argument", "money inválido");
      }
      if (!email && !phone) {
        throw new HttpsError("invalid-argument", "email o phone requerido");
      }
      // Usar cashback pide la tarjeta del cliente o su correo (la tarjeta manda
      // si vienen las dos). Se verifica ANTES de debitar: un rechazo no mueve dinero.
      const v = await puntosSeg.verificarIdentidad({phone, codigo, email}, consultarBalance);
      registrarVerificacion("canjearPuntos", v, t, phone);
      if (puntosSeg.rechazar(v)) {
        throw new HttpsError("permission-denied", v.motivo === "sin_dato" ?
            "Para usar el cashback escanea la tarjeta del cliente o confirma su correo" :
            "La tarjeta o el correo no corresponden al cliente");
      }
      // A amise: el teléfono (la tarjeta o el correo ya se verificaron contra
      // él), igual que redimirCreditoRegalo; el correo solo si no hay teléfono.
      const ident = phone ? {phone} : {email};
      const data = await llamarAmise("/api/loyalty/redeem", {
        ...ident, money: m, idempotencyKey,
        pendingLock: request.data.pendingLock === true,
        sucursalId: t.sucursalId || request.data.sucursalId || null,
        nodoId: t.nodoId || request.data.nodoId || null,
      });
      return {
        ok: true,
        redeemed: Number(data.redeemed) || 0,
        balance: Number(data.balance) || 0,
        money: Number(data.money) || 0,
      };
    },
);

// Fase 5 — cierra el canje pendiente tras crear la venta (libera el candado en el
// servidor). Idempotente. Input: { email?|phone?, cobroId } → { ok, closed }.
exports.cerrarCanje = onCall(
    {secrets: [LOYALTY_POS_SECRET], timeoutSeconds: 30, memory: "256MiB"},
    async (request) => {
      requireRolPuntos(request.auth);
      const {email, phone, cobroId} = request.data || {};
      if (!cobroId || typeof cobroId !== "string") {
        throw new HttpsError("invalid-argument", "cobroId requerido");
      }
      if (!email && !phone) {
        throw new HttpsError("invalid-argument", "email o phone requerido");
      }
      const data = await llamarAmise("/api/loyalty/canje/cerrar", {
        email, phone, cobroId,
      });
      return {ok: true, closed: !!data.closed};
    },
);

// Recupera la contraseña de puntos (re-emite una NUEVA: la vieja se guarda
// hasheada y no se puede leer). Solo para cuentas NO activadas.
// Input: { phone, codigo? | email? } → { ok, email (oculto), code }. Entrega
// una contraseña: pide la tarjeta escaneada o el correo completo del cliente.
exports.recuperarCodigoPuntos = onCall(
    {secrets: [LOYALTY_POS_SECRET], timeoutSeconds: 30, memory: "256MiB"},
    async (request) => {
      const t = requireRolPuntos(request.auth);
      const {phone, email, codigo} = request.data || {};
      if (!phone && !email) {
        throw new HttpsError("invalid-argument", "phone o email requerido");
      }
      const v = await puntosSeg.verificarIdentidad({phone, codigo, email}, consultarBalance);
      registrarVerificacion("recuperarCodigoPuntos", v, t, phone);
      if (puntosSeg.rechazar(v)) {
        throw new HttpsError("permission-denied", v.motivo === "sin_dato" ?
            "Escanea la tarjeta del cliente o confirma su correo" :
            "La tarjeta o el correo no corresponden al cliente");
      }
      // A amise solo el teléfono, como siempre (el correo ya se verificó).
      const data = await llamarAmise("/api/loyalty/recover-code",
          phone ? {phone} : {email});
      return {ok: true, email: puntosSeg.enmascararCorreo(data.email), code: data.code || ""};
    },
);

// ── Tarjeta física (barcode EAN-13) ──────────────────────────
// Vincula/repone/desbloquea; consultar por barcode va en consultarSaldoPuntos.

// Identidad para vincular una tarjeta YA COBRADA: el correo que dio el cliente
// debe ser del monedero de ese teléfono. La caja lo comprueba antes de cobrar;
// aquí solo se rechaza un dato contradictorio, nunca uno que falte (cajas
// viejas e ítems en cola): no se cobra una tarjeta que luego no se liga.
async function identidadTarjeta(fn, t, phone, email) {
  const v = await puntosSeg.verificarIdentidad({phone, email}, consultarBalance);
  registrarVerificacion(fn, v, t, phone);
  if (puntosSeg.rechazar(v, {faltanteOk: true})) {
    throw new HttpsError("permission-denied", "El correo no corresponde al cliente");
  }
}

// Activar (vincular) una tarjeta física al cobrar.
// Input: { phone, email?, codigo, ventaId? }. A amise va solo el teléfono.
exports.activarTarjeta = onCall(
    {secrets: [LOYALTY_POS_SECRET], timeoutSeconds: 30, memory: "256MiB"},
    async (request) => {
      const t = requireRolPuntos(request.auth);
      const {email, phone, codigo, ventaId} = request.data || {};
      if (!email && !phone) {
        throw new HttpsError("invalid-argument", "email o phone requerido");
      }
      if (!codigo || typeof codigo !== "string") {
        throw new HttpsError("invalid-argument", "codigo requerido");
      }
      await identidadTarjeta("activarTarjeta", t, phone, email);
      const data = await llamarAmise("/api/loyalty/card/link",
          {...(phone ? {phone} : {email}), codigo, ventaId});
      return {ok: true, already: Boolean(data.already)};
    },
);

// Reposición (deshabilita la anterior, vincula la nueva). También se cobra.
// Input: { phone, email?, codigoAnterior?, codigoNuevo, ventaId? }. La tarjeta
// anterior la busca el servidor: la caja puede tener solo sus últimos 4.
exports.reponerTarjeta = onCall(
    {secrets: [LOYALTY_POS_SECRET], timeoutSeconds: 30, memory: "256MiB"},
    async (request) => {
      const t = requireRolPuntos(request.auth);
      const {email, phone, codigoAnterior, codigoNuevo, ventaId} = request.data || {};
      if (!email && !phone && !codigoAnterior) {
        throw new HttpsError("invalid-argument", "email, phone o codigoAnterior requerido");
      }
      if (!codigoNuevo || typeof codigoNuevo !== "string") {
        throw new HttpsError("invalid-argument", "codigoNuevo requerido");
      }
      // Identidad y tarjeta actual en paralelo (dos consultas independientes).
      const [, actual] = await Promise.all([
        identidadTarjeta("reponerTarjeta", t, phone, email),
        phone ? consultarBalance({phone}) : null,
      ]);
      let anterior = puntosSeg.esEan13(codigoAnterior) ? codigoAnterior : undefined;
      if (actual && actual.exists && actual.tarjeta &&
          puntosSeg.esEan13(actual.tarjeta.codigo)) {
        anterior = String(actual.tarjeta.codigo);
      }
      const ident = phone ? {phone} : email ? {email} : {};
      const data = await llamarAmise("/api/loyalty/card/replace", {
        ...ident, codigoAnterior: anterior, codigoNuevo, ventaId,
      });
      return {ok: true, already: Boolean(data.already)};
    },
);

// Desbloqueo SOLO en sucursal. Input: { phone, codigo, email }: la tarjeta
// bloqueada escaneada y el correo del cliente, ambos de ese monedero.
exports.desbloquearTarjeta = onCall(
    {secrets: [LOYALTY_POS_SECRET], timeoutSeconds: 30, memory: "256MiB"},
    async (request) => {
      const t = requireRolPuntos(request.auth);
      const {email, phone, codigo} = request.data || {};
      if (!phone || !codigo || !email) {
        throw new HttpsError("invalid-argument",
            "Se requieren el teléfono, la tarjeta y el correo del cliente");
      }
      if (!puntosSeg.esEan13(codigo)) {
        throw new HttpsError("invalid-argument", "Código de tarjeta inválido");
      }
      const actual = await consultarBalance({phone});
      if (!actual || !actual.exists) {
        throw new HttpsError("not-found", "Cliente no encontrado");
      }
      if (!actual.tarjeta || String(actual.tarjeta.codigo) !== String(codigo)) {
        registrarVerificacion("desbloquearTarjeta",
            {ok: false, motivo: "no_coincide"}, t, phone);
        throw new HttpsError("permission-denied", "La tarjeta no corresponde al cliente");
      }
      if (actual.tarjeta.estado !== "bloqueada") {
        throw new HttpsError("failed-precondition", "La tarjeta no está bloqueada");
      }
      const v = await puntosSeg.verificarIdentidad({phone, email}, consultarBalance);
      registrarVerificacion("desbloquearTarjeta", v, t, phone);
      if (!v.ok) {
        throw new HttpsError("permission-denied", "El correo no corresponde al cliente");
      }
      await llamarAmise("/api/loyalty/card/unblock", {phone});
      return {ok: true};
    },
);

// ── Tarjeta de REGALO (Feature 5, Fase 2) ────────────────────
// Proxies a amise.mx /api/loyalty/gift/*. Mismo modelo que la tarjeta física: el
// POS nunca ve LOYALTY_POS_SECRET; idempotencia por ventaId. El crédito de regalo
// es un pozo SEPARADO del cashback (vence a 6m; gastarlo no genera cashback).

/** Como llamarAmise pero GET (para /gift/balance, que es GET en amise). */
async function llamarAmiseGet(path) {
  let resp;
  try {
    resp = await fetch(`${AMISE_API_BASE}${path}`, {
      method: "GET",
      headers: {"Authorization": `Bearer ${LOYALTY_POS_SECRET.value()}`},
    });
  } catch (e) {
    throw new HttpsError("unavailable", `No se pudo contactar a amise.mx: ${e.message}`,
        {amiseStatus: 0, retriable: true});
  }
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw errorAmise(resp.status, data);
  return data;
}

// Vender/activar una tarjeta de regalo al cobrar. Carga el crédito prepago (+6m,
// sin cashback), vincula el barcode físico y emite el código de acceso online.
// Input: { email, denominacion(>0), ventaId, barcode, phone?, nombre? }.
// Idempotente por ventaId (= idempotencyKey del lado amise). accessCode viene en
// claro SOLO la 1ª vez (reintentos: null → ya se entregó, usar recuperación).
exports.emitirTarjetaRegalo = onCall(
    {secrets: [LOYALTY_POS_SECRET], timeoutSeconds: 30, memory: "256MiB"},
    async (request) => {
      const t = requireRolPuntos(request.auth);
      const d = request.data || {};
      const {email, phone, nombre, denominacion, barcode, ventaId} = d;
      if (!email || typeof email !== "string") {
        throw new HttpsError("invalid-argument", "email requerido");
      }
      const monto = Number(denominacion);
      if (!Number.isFinite(monto) || monto <= 0) {
        throw new HttpsError("invalid-argument", "denominacion (>0) requerida");
      }
      if (!ventaId || typeof ventaId !== "string") {
        throw new HttpsError("invalid-argument", "ventaId requerido");
      }
      // D2: la tarjeta de regalo SIEMPRE es física → barcode obligatorio.
      if (!barcode || typeof barcode !== "string") {
        throw new HttpsError("invalid-argument", "barcode requerido");
      }
      const data = await llamarAmise("/api/loyalty/gift/issue", {
        email,
        phone,
        nombre,
        denominacion: monto,
        barcode,
        idempotencyKey: ventaId,
        sucursalId: t.sucursalId || d.sucursalId || null,
        nodoId: t.nodoId || d.nodoId || null,
      });
      return {
        ok: true,
        walletId: data.walletId || "",
        balance: Number(data.balance) || 0,
        expiraAt: Number(data.expiraAt) || 0,
        accessCode: data.accessCode || null,
        accessCodeReason: data.accessCodeReason || "",
        cardLinked: Boolean(data.cardLinked),
        cardReason: data.cardReason || "",
        already: Boolean(data.already),
      };
    },
);

// Recargar una tarjeta de regalo existente (suma crédito + reinicia vigencia +6m).
// Input: { email?|phone?|codigo, amount(>0), ventaId }. Idempotente por ventaId.
exports.recargarTarjetaRegalo = onCall(
    {secrets: [LOYALTY_POS_SECRET], timeoutSeconds: 30, memory: "256MiB"},
    async (request) => {
      const t = requireRolPuntos(request.auth);
      const {email, phone, codigo, amount, ventaId} = request.data || {};
      if (!email && !phone && !codigo) {
        throw new HttpsError("invalid-argument", "email, phone o codigo requerido");
      }
      const monto = Number(amount);
      if (!Number.isFinite(monto) || monto <= 0) {
        throw new HttpsError("invalid-argument", "amount (>0) requerido");
      }
      if (!ventaId || typeof ventaId !== "string") {
        throw new HttpsError("invalid-argument", "ventaId requerido");
      }
      const data = await llamarAmise("/api/loyalty/gift/recharge", {
        email,
        phone,
        codigo,
        amount: monto,
        idempotencyKey: ventaId,
        sucursalId: t.sucursalId || request.data.sucursalId || null,
        nodoId: t.nodoId || request.data.nodoId || null,
      });
      return {
        ok: true,
        walletId: data.walletId || "",
        balance: Number(data.balance) || 0,
        expiraAt: Number(data.expiraAt) || 0,
        already: Boolean(data.already),
      };
    },
);

// Consultar el crédito de regalo (efectivo, 0 si venció). Input: { email?|phone?|codigo }.
exports.consultarSaldoTarjetaRegalo = onCall(
    {secrets: [LOYALTY_POS_SECRET], timeoutSeconds: 30, memory: "256MiB"},
    async (request) => {
      requireRolPuntos(request.auth);
      const {email, phone, codigo} = request.data || {};
      if (!email && !phone && !codigo) {
        throw new HttpsError("invalid-argument", "email, phone o codigo requerido");
      }
      const qs = new URLSearchParams();
      if (email) qs.set("email", email);
      if (phone) qs.set("phone", phone);
      if (codigo) qs.set("codigo", codigo);
      const data = await llamarAmiseGet(`/api/loyalty/gift/balance?${qs.toString()}`);
      return {
        ok: true,
        saldo: Number(data.saldo) || 0,
        expiraAt: data.expiraAt == null ? null : Number(data.expiraAt),
        vencido: Boolean(data.vencido),
      };
    },
);

// Fase 3 — REDIME (debita) crédito de regalo al cobrar (se aplica como DESCUENTO,
// no como ingreso). Idempotente por idempotencyKey (= ventaId). El candado
// (pendingLock) previene el doble-débito si el POS reintenta/reconecta.
// Input: { codigo | phone + email, money, idempotencyKey } →
//   { ok, used, balance, money, cobroId }. Se usa con la tarjeta de regalo, o
//   con teléfono + correo del mismo monedero. Rechazos (vencido/insuficiente/en
//   curso) llegan como error (llamarAmise mapea el 409 a already-exists).
exports.redimirCreditoRegalo = onCall(
    {secrets: [LOYALTY_POS_SECRET], timeoutSeconds: 30, memory: "256MiB"},
    async (request) => {
      const t = requireRolPuntos(request.auth);
      const {email, phone, codigo, money, idempotencyKey} = request.data || {};
      if (!idempotencyKey || typeof idempotencyKey !== "string") {
        throw new HttpsError("invalid-argument", "idempotencyKey requerido");
      }
      const m = Number(money);
      if (!isFinite(m) || m <= 0) {
        throw new HttpsError("invalid-argument", "money inválido");
      }
      if (!email && !phone && !codigo) {
        throw new HttpsError("invalid-argument", "email, phone o codigo requerido");
      }
      // La tarjeta de regalo escaneada identifica sola su crédito; sin ella,
      // el correo debe ser del monedero de ese teléfono. Antes de debitar.
      const v = codigo ?
        {ok: puntosSeg.esEan13(codigo),
          motivo: puntosSeg.esEan13(codigo) ? "ok_tarjeta" : "codigo_invalido"} :
        await puntosSeg.verificarIdentidad({phone, email}, consultarBalance);
      registrarVerificacion("redimirCreditoRegalo", v, t, phone);
      if (puntosSeg.rechazar(v)) {
        throw new HttpsError("permission-denied", v.motivo === "sin_dato" ?
            "Para usar el crédito escanea la tarjeta de regalo o confirma el correo del cliente" :
            "La tarjeta o el correo no corresponden al cliente");
      }
      // A amise: la tarjeta, o el teléfono (el correo ya se verificó).
      const ident = codigo ? {codigo, phone} : phone ? {phone} : {email};
      const data = await llamarAmise("/api/loyalty/gift/redeem", {
        ...ident, money: m, idempotencyKey,
        pendingLock: request.data.pendingLock === true,
        sucursalId: t.sucursalId || request.data.sucursalId || null,
        nodoId: t.nodoId || request.data.nodoId || null,
      });
      return {
        ok: true,
        used: Number(data.used) || 0,
        balance: Number(data.balance) || 0,
        money: Number(data.money) || 0,
        cobroId: typeof data.cobroId === "string" ? data.cobroId : idempotencyKey,
      };
    },
);

// Fase 3 — cierra el uso de crédito de regalo pendiente tras crear la venta
// (libera el candado). Idempotente. Input: { email?|phone?|codigo, cobroId } →
//   { ok, closed }.
exports.cerrarCreditoRegalo = onCall(
    {secrets: [LOYALTY_POS_SECRET], timeoutSeconds: 30, memory: "256MiB"},
    async (request) => {
      requireRolPuntos(request.auth);
      const {email, phone, codigo, cobroId} = request.data || {};
      if (!cobroId || typeof cobroId !== "string") {
        throw new HttpsError("invalid-argument", "cobroId requerido");
      }
      if (!email && !phone && !codigo) {
        throw new HttpsError("invalid-argument", "email, phone o codigo requerido");
      }
      const data = await llamarAmise("/api/loyalty/gift/cerrar", {
        email, phone, codigo, cobroId,
      });
      return {ok: true, closed: !!data.closed};
    },
);


// ============================================================
// Fabricación — zona de precios viva
// ============================================================
// Un artículo con `zonaPrecioId` guarda copia de `precioVenta` y de los
// escalones de su zona (lógica pura en lib/zonaPrecio.js). Dos triggers la
// mantienen al día:
//   - sincronizarZonaPrecio: al cambiar precio o escalones de una zona,
//     reescribe solo los artículos que difieren.
//   - asegurarPrecioZona: red de seguridad por artículo. Si alguien guarda
//     un precio viejo (editor abierto, app sin actualizar), lo corrige. Las
//     ventas solo tocan stock y salen sin leer nada.
const zonaPrecio = require("./lib/zonaPrecio");
const preciosMayoreo = require("./lib/preciosMayoreo");

function generarHuella() {
  const d = new Date();
  const pad = (n, w = 2) => String(n).padStart(w, "0");
  return String(d.getFullYear()) + pad(d.getMonth() + 1) + pad(d.getDate()) +
    pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds()) +
    pad(d.getMilliseconds(), 3) + Math.random().toString(36).slice(2, 5);
}

exports.sincronizarZonaPrecio = onDocumentWritten(
    {
      document: "negocios_web_new_version/{negocioId}/" +
        "zonas_precio_web_new_version/{zonaId}",
    },
    async (event) => {
      const {negocioId, zonaId} = event.params;
      const antes = event.data && event.data.before.exists ?
        event.data.before.data() : null;
      const despues = event.data && event.data.after.exists ?
        event.data.after.data() : null;
      if (despues && !zonaPrecio.zonaCambioPrecios(antes, despues)) return;

      const base = db.collection(COL_NEGOCIOS).doc(negocioId);
      const arts = await base.collection("articulos_n_web_new_version")
          .where("zonaPrecioId", "==", zonaId).get();
      if (arts.empty) return;

      const writer = db.bulkWriter();
      let escritos = 0;
      arts.forEach((d) => {
        // Zona borrada: el artículo se queda con su último precio, sin zona.
        const patch = despues ?
          zonaPrecio.calcularPatchZona(d.data(), despues) :
          {zonaPrecioId: admin.firestore.FieldValue.delete()};
        if (!patch) return;
        writer.update(d.ref, patch);
        escritos++;
      });
      await writer.close();
      if (escritos > 0) {
        await base.collection("datos_web_new_version").doc("articulos_ac")
            .set({huella: generarHuella()}, {merge: true});
      }
      console.log(
          `sincronizarZonaPrecio ${negocioId}/${zonaId}: ` +
          `${escritos}/${arts.size} artículos actualizados`);
    },
);

exports.asegurarPrecioZona = onDocumentWritten(
    {
      document: "negocios_web_new_version/{negocioId}/" +
        "articulos_n_web_new_version/{articuloId}",
    },
    async (event) => {
      const antes = event.data && event.data.before.exists ?
        event.data.before.data() : null;
      const despues = event.data && event.data.after.exists ?
        event.data.after.data() : null;
      const {negocioId, articuloId} = event.params;
      const negocioRef = db.collection(COL_NEGOCIOS).doc(negocioId);

      if (zonaPrecio.requiereVerificarZona(antes, despues)) {
        const zonaSnap = await negocioRef
            .collection("zonas_precio_web_new_version")
            .doc(despues.zonaPrecioId).get();
        if (!zonaSnap.exists) return;
        const patch = zonaPrecio.calcularPatchZona(despues, zonaSnap.data());
        if (!patch) return;
        await event.data.after.ref.update(patch);
        console.log(
            `asegurarPrecioZona ${negocioId}/${articuloId}: precio de zona ` +
            `${despues.zonaPrecioId} restaurado`);
        return;
      }

      // Misma red de seguridad para la escalera de mayoreo (categoría →
      // subcategoría): un artículo «Solo mayoreo» que hereda (`heredaPrecio`)
      // y no tiene zona siempre queda con el precio de su nivel. Con zona
      // manda la zona, así que los dos caminos no se cruzan.
      if (!preciosMayoreo.requiereVerificarPrecio(antes, despues)) return;
      // Con el artículo y los precios RECIÉN leídos, en una transacción: si
      // entre el aviso y este momento admin le puso precio propio o lo
      // cambió de categoría, no se le pisa con un precio viejo.
      const patch = await aplicarPrecioEscalera(negocioRef, event.data.after.ref);
      if (!patch) return;
      console.log(
          `asegurarPrecioZona ${negocioId}/${articuloId}: precio de mayoreo ` +
          `restaurado ($${patch.precioVenta} / $${patch.precioMenudeo})`);
    },
);

// Precios de mayoreo en escalera (lib/preciosMayoreo.js): al cambiar el
// precio de una categoría o subcategoría en `datos/_preciosMayoreo`,
// reescribe solo los artículos «Solo mayoreo» que lo heredan y difieren. Si
// se borra el doc, los artículos conservan su último precio.
/**
 * Deja un artículo con el precio de su nivel de la escalera, si hereda y
 * difiere. Lee el artículo y los precios dentro de una transacción: lo que
 * escribe siempre corresponde a lo que hay en ese momento (dos avisos fuera
 * de orden, o un guardado de admin a la vez, no dejan un precio viejo).
 * @param {FirebaseFirestore.DocumentReference} negocioRef
 * @param {FirebaseFirestore.DocumentReference} articuloRef
 * @return {Promise<object|null>} los campos escritos, o null si no hizo falta
 */
function aplicarPrecioEscalera(negocioRef, articuloRef) {
  const preciosRef = negocioRef
      .collection("datos_web_new_version").doc("_preciosMayoreo");
  return db.runTransaction(async (tx) => {
    const [artSnap, preciosSnap] = await tx.getAll(articuloRef, preciosRef);
    if (!artSnap.exists) return null;
    const patch = preciosMayoreo.calcularPatchPrecio(
        artSnap.data(), preciosSnap.exists ? preciosSnap.data() : null);
    if (!patch) return null;
    tx.update(articuloRef, patch);
    return patch;
  });
}

exports.sincronizarPreciosMayoreo = onDocumentWritten(
    {
      document: "negocios_web_new_version/{negocioId}/" +
        "datos_web_new_version/_preciosMayoreo",
      // Cada artículo se escribe en su propia transacción: con un catálogo
      // grande tarda más que el minuto que se da por omisión.
      timeoutSeconds: 300,
    },
    async (event) => {
      const {negocioId} = event.params;
      const despues = event.data && event.data.after.exists ?
        event.data.after.data() : null;
      if (!despues) return;

      const base = db.collection(COL_NEGOCIOS).doc(negocioId);
      // Solo los que heredan (`heredaPrecio`): los de precio propio y los de
      // antes de la escalera ni se leen.
      const arts = await base.collection("articulos_n_web_new_version")
          .where("heredaPrecio", "==", true).get();
      if (arts.empty) return;

      // Los que con esta foto ya coinciden se saltan; cada uno de los demás
      // se revisa y escribe en su propia transacción (`aplicarPrecioEscalera`).
      const porRevisar = arts.docs.filter(
          (d) => preciosMayoreo.calcularPatchPrecio(d.data(), despues));
      let escritos = 0;
      // Un artículo que falla (dos escrituras encontradas) no detiene a los
      // demás: se apunta y se intenta otra vez al final, de uno en uno.
      const pendientes = [];
      const A_LA_VEZ = 50;
      for (let i = 0; i < porRevisar.length; i += A_LA_VEZ) {
        const lote = porRevisar.slice(i, i + A_LA_VEZ);
        const hechos = await Promise.allSettled(
            lote.map((d) => aplicarPrecioEscalera(base, d.ref)));
        hechos.forEach((h, j) => {
          if (h.status === "rejected") pendientes.push(lote[j].ref);
          else if (h.value) escritos++;
        });
      }
      const fallidos = [];
      for (const ref of pendientes) {
        try {
          if (await aplicarPrecioEscalera(base, ref)) escritos++;
        } catch (e) {
          fallidos.push(ref.id);
        }
      }
      if (escritos > 0) {
        await base.collection("datos_web_new_version").doc("articulos_ac")
            .set({huella: generarHuella()}, {merge: true});
      }
      console.log(
          `sincronizarPreciosMayoreo ${negocioId}: ` +
          `${escritos}/${arts.size} artículos actualizados`);
      if (fallidos.length > 0) {
        // Queda como error en los registros. Se corrige al volver a guardar
        // el precio de la categoría (o el artículo).
        throw new Error(
            `sincronizarPreciosMayoreo ${negocioId}: ${fallidos.length} artículos ` +
            `se quedaron sin actualizar (${fallidos.slice(0, 20).join(", ")})`);
      }
    },
);

// ============================================================
// CLIP — cobro con tarjeta en la terminal (API de PinPad)
// ============================================================
// La caja pide el cobro (cobrarConClip), la terminal lo toma y el cliente
// paga ahí. El resultado llega por el aviso de Clip (webhookClip) o porque
// la caja consulta (consultarCobroClip); en los dos casos manda la consulta
// a Clip, nunca el aviso. Un cobro por venta (cobroId = idempotencyKey de la
// venta) en sucursales_data/{sid}/pagos_clip/{cobroId}, más un candado por
// terminal (clip_terminales/{serie}) para que dos ventas no la usen a la vez.
// Solo estas CF escriben; la caja lee su cobro para seguirlo en vivo.

const COL_PAGOS_CLIP = `pagos_clip${SUFFIX}`;

function pagoClipRef(negocioId, sucursalId, cobroId) {
  return db.collection(COL_NEGOCIOS).doc(negocioId)
      .collection(`sucursales_data${SUFFIX}`).doc(sucursalId)
      .collection(COL_PAGOS_CLIP).doc(cobroId);
}

function candadoClipRef(negocioId, serial) {
  return db.collection(COL_NEGOCIOS).doc(negocioId)
      .collection(`clip_terminales${SUFFIX}`).doc(serial);
}

const rutaPagoClip = (id) =>
  `/f2f/pinpad/v1/payment?pinpadRequestId=${encodeURIComponent(id)}`;

/**
 * Quien cobra: la sesión de una caja (lib/clip.js) con su nodo vigente, como
 * en asegurarLlaveNodo. El token de una caja revocada sirve hasta una hora.
 */
async function requireCaja(auth) {
  const c = clip.claimsCaja(auth);
  const snap = await db.collection(COL_NEGOCIOS).doc(c.negocioId)
      .collection(COL_NODOS).doc(c.nodoId).get();
  const nodo = snap.exists ? snap.data() : null;
  if (!nodo || nodo.estado === "revocado") {
    throw new HttpsError("permission-denied", "Caja revocada o inexistente");
  }
  if (nodo.authUid && nodo.authUid !== auth.uid) {
    throw new HttpsError("permission-denied", "Sesión de caja reemplazada");
  }
  if (nodo.sucursalId && nodo.sucursalId !== c.sucursalId) {
    throw new HttpsError("permission-denied", "La caja es de otra sucursal");
  }
  return {...c, nodo};
}

/** Llama a la API de PinPad con Basic auth y tiempo límite. */
async function llamarClip(method, path, {body, detalle} = {}) {
  const headers = {
    "Authorization": clip.basicAuth(CLIP_API_KEY.value(), CLIP_API_SECRET.value()),
    "Accept": "application/json",
  };
  if (body) headers["Content-Type"] = "application/json";
  if (detalle) headers["Pinpad-Include-Detail"] = "true";
  let resp;
  try {
    resp = await fetch(`${CLIP_API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) {
    throw clip.errorClip(0, null);
  }
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw clip.errorClip(resp.status, data);
  return data;
}

/**
 * Cambia el estado del intento `n` en una transacción. Respeta las
 * transiciones de lib/clip.js (un aprobado nunca se pierde) y, al llegar a
 * un estado final, libera el candado de la terminal si es de este intento.
 */
async function actualizarIntento(ref, n, cambios, {soloDesde} = {}) {
  const ahora = Date.now();
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    const c = snap.data();
    if (soloDesde && !soloDesde.includes(c.estado)) return c;
    const final = clip.ESTADOS_FINALES.includes(cambios.estado);
    const candadoRef = final && c.serial ? candadoClipRef(c.negocioId, c.serial) : null;
    const candSnap = candadoRef ? await tx.get(candadoRef) : null;
    const esActual = c.intento === n;
    if (esActual && !clip.transicionValida(c.estado, cambios.estado)) {
      logger.warn("clip: cambio de estado ignorado",
          {cobroId: c.cobroId, intento: n, de: c.estado, a: cambios.estado});
      return c;
    }
    const resumen = {estado: cambios.estado};
    if (cambios.pinpadRequestId) resumen.pinpadRequestId = cambios.pinpadRequestId;
    if (cambios.error) resumen.error = cambios.error;
    const intentos = (c.intentos || [])
        .map((i) => (i.n === n ? {...i, ...resumen, actualizadoEn: ahora} : i));
    const upd = {intentos, actualizadoEn: ahora};
    if (esActual) Object.assign(upd, cambios);
    tx.update(ref, upd);
    if (candSnap && candSnap.exists) {
      const k = candSnap.data();
      if (k.cobroPath === ref.path && k.intento === n) tx.delete(candadoRef);
    }
    return {...c, ...upd};
  });
}

/**
 * Marca del intento `n` cuya respuesta se perdió: Clip pudo crearlo sin que
 * sepamos su id. Mientras haya intentos así (por 2 h: un cobro en la terminal
 * se resuelve en minutos), el aviso consulta a Clip por ids desconocidos para
 * ligarlos (ver adoptarIntentoClip); si no, no gasta consultas con ids
 * inventados.
 */
const SIN_ID_MS = 2 * 60 * 60_000;
const sinId = (n) => ({sinIdHasta: Date.now() + SIN_ID_MS,
  intentosSinId: FieldValue.arrayUnion(n)});

/** Reintenta una escritura que falló (Firestore no disponible un momento). */
async function reintentarEscritura(fn, veces = 3) {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= veces) throw e;
      await new Promise((r) => setTimeout(r, 400 * i));
    }
  }
}

/**
 * Pregunta a Clip en qué quedó el intento abierto y lo guarda. `minMs` evita
 * consultar a Clip más de una vez cada tanto (la caja consulta seguido).
 */
async function refrescarCobroClip(ref, {minMs = 2000} = {}) {
  const snap = await ref.get();
  if (!snap.exists) return null;
  const c = snap.data();
  const ahora = Date.now();
  if (c.estado === "enviando" &&
      ahora - (Number(c.actualizadoEn) || 0) > clip.ENVIANDO_VENCE_MS) {
    return actualizarIntento(ref, c.intento, {estado: "incierto", ...sinId(c.intento),
      error: {code: "SIN_RESPUESTA", mensaje: "El envío a la terminal no terminó"}});
  }
  if (c.estado !== "pendiente" || !c.pinpadRequestId) return c;
  if (ahora - (Number(c.consultadoEn) || 0) < minMs) return c;
  await ref.update({consultadoEn: ahora});
  const r = await llamarClip("GET", rutaPagoClip(c.pinpadRequestId), {detalle: true});
  const ev = clip.evaluarIntentoClip(r, c.montoCentavos);
  if (ev.estado === "pendiente") return {...c, consultadoEn: ahora};
  return actualizarIntento(ref, c.intento, {estado: ev.estado, tarjeta: ev.tarjeta,
    pagadoCentavos: ev.pagadoCentavos, alerta: ev.alerta});
}

/**
 * Cancela lo que la terminal tenga sin tomar (por su número de serie). Si la
 * terminal ya está cobrando, o no se pudo hablar con Clip, no sigue.
 */
async function limpiarTerminalClip(serial) {
  let err = null;
  try {
    await llamarClip("DELETE",
        `/f2f/pinpad/v1/payment/serial-number/${encodeURIComponent(serial)}`);
  } catch (e) {
    err = e;
  }
  const r = clip.resultadoLimpieza(err);
  if (r === "libre") return {ok: true};
  if (r === "ocupada") {
    return {ok: false, aviso: "La terminal está cobrando el intento anterior. " +
      "Espera a que termine y revisa si se aprobó."};
  }
  return {ok: false, aviso: `No se pudo revisar la terminal (${err.message}). ` +
    "Intenta de nuevo."};
}

// Manda a la terminal de la caja el cobro de una venta. Idempotente por
// cobroId: dos toques o un reintento mientras espera devuelven el mismo
// cobro; un intento nuevo solo sale cuando el anterior terminó sin pago.
// Input: {cobroId, monto, reintentarIncierto?} → el cobro (cobroPublico) y,
// a veces, un `aviso` para el cajero.
exports.cobrarConClip = onCall(
    {secrets: [CLIP_API_KEY, CLIP_API_SECRET], timeoutSeconds: 40, memory: "256MiB"},
    async (request) => {
      const caja = await requireCaja(request.auth);
      const {cobroId, monto, reintentarIncierto} = request.data || {};
      if (!clip.cobroIdValido(cobroId)) {
        throw new HttpsError("invalid-argument", "cobroId inválido");
      }
      const montoTxt = clip.montoClip(monto);
      const montoCentavos = clip.centavos(montoTxt);
      const serial = typeof caja.nodo.clipSerial === "string" ? caja.nodo.clipSerial.trim() : "";
      if (!clip.serieValida(serial)) {
        throw new HttpsError("failed-precondition", "Esta caja no tiene terminal Clip asignada");
      }
      const ref = pagoClipRef(caja.negocioId, caja.sucursalId, cobroId);
      const candadoRef = candadoClipRef(caja.negocioId, serial);

      // Decide (y, si toca, aparta el intento nuevo y la terminal) en una
      // transacción. Un intento "incierto" solo se aparta después de limpiar
      // la terminal (`apartarLimpieza`).
      const decidir = (apartarLimpieza) => db.runTransaction(async (tx) => {
        const ahora = Date.now();
        const snap = await tx.get(ref);
        const candSnap = await tx.get(candadoRef);
        const cobro = snap.exists ? snap.data() : null;
        if (cobro && cobro.nodoId !== caja.nodoId) {
          throw new HttpsError("permission-denied", "El cobro es de otra caja");
        }
        const candado = candSnap.exists ? candSnap.data() : null;
        let cobroDelCandado = null;
        if (candado && candado.cobroPath && candado.cobroPath !== ref.path) {
          const s = await tx.get(db.doc(candado.cobroPath));
          cobroDelCandado = s.exists ? s.data() : null;
        }
        const d = clip.decidirCobro({cobro, candado, cobroDelCandado, cobroPath: ref.path,
          montoCentavos, ahora, reintentarIncierto: reintentarIncierto === true});
        const apartar = d.accion === "nuevo" ||
          (d.accion === "limpiar-y-nuevo" && apartarLimpieza);
        if (apartar) {
          const n = d.intento;
          const refClip = clip.referencia(cobroId, n);
          const intentos = [...((cobro && cobro.intentos) || []),
            {n, referencia: refClip, estado: "enviando", creadoEn: ahora, actualizadoEn: ahora}]
              .slice(-10);
          tx.set(ref, {
            cobroId, negocioId: caja.negocioId, sucursalId: caja.sucursalId,
            nodoId: caja.nodoId, serial, monto: montoTxt, montoCentavos,
            estado: "enviando", intento: n, referencia: refClip, pinpadRequestId: null,
            intentos, tarjeta: null, pagadoCentavos: 0, alerta: null, error: null,
            creadoEn: (cobro && cobro.creadoEn) || ahora, actualizadoEn: ahora, consultadoEn: 0,
            // De los intentos anteriores: sus ids y los envíos sin id siguen
            // valiendo (un pago tardío de ellos se liga a este cobro).
            pinpadIds: (cobro && cobro.pinpadIds) || [],
            intentosSinId: (cobro && cobro.intentosSinId) || [],
            sinIdHasta: (cobro && cobro.sinIdHasta) || 0,
          });
          tx.set(candadoRef, {cobroPath: ref.path, intento: n, nodoId: caja.nodoId, desde: ahora});
        }
        return {...d, apartado: apartar};
      });

      let d = await decidir(false);
      if (d.accion === "limpiar-y-nuevo") {
        // El intento anterior quedó incierto y el cajero ya revisó la
        // terminal: si sigue ahí sin tomar, se cancela antes de mandar otro.
        const limpia = await limpiarTerminalClip(serial);
        if (!limpia.ok) {
          return {...clip.cobroPublico((await ref.get()).data()), aviso: limpia.aviso};
        }
        d = await decidir(true);
      }
      if (d.accion === "error") throw new HttpsError(d.code, d.mensaje);
      if (!d.apartado) return clip.cobroPublico((await ref.get()).data());

      const n = d.intento;
      let r;
      try {
        r = await llamarClip("POST", "/f2f/pinpad/v1/payment", {
          body: clip.cuerpoCobro({monto: montoTxt, referencia: clip.referencia(cobroId, n),
            serial, webhookUrl: CLIP_WEBHOOK_URL}),
        });
      } catch (e) {
        const det = (e && e.details) || {};
        await actualizarIntento(ref, n, clip.envioIncierto(e) ?
          {estado: "incierto", ...sinId(n),
            error: {code: det.clipCode || "SIN_RESPUESTA", mensaje: e.message}} :
          {estado: "fallido", error: {code: det.clipCode || e.code || "ERROR", mensaje: e.message}});
        return clip.cobroPublico((await ref.get()).data());
      }
      // Clip ya tiene el cobro: guardarlo nunca lo vuelve "fallido". Si la
      // escritura falla del todo, el intento sigue "enviando", en un minuto
      // pasa a incierto y el aviso de Clip lo liga por su referencia.
      const id = typeof r.pinpad_request_id === "string" ? r.pinpad_request_id : "";
      await reintentarEscritura(() => actualizarIntento(ref, n, id ?
        {estado: "pendiente", pinpadRequestId: id, pinpadIds: FieldValue.arrayUnion(id)} :
        {estado: "incierto", ...sinId(n),
          error: {code: "SIN_ID", mensaje: "Clip no devolvió el id del cobro"}}));
      return clip.cobroPublico((await ref.get()).data());
    },
);

// La caja pregunta en qué va su cobro (respaldo del aviso de Clip, que se
// manda una sola vez). Consulta a Clip a lo más cada 2 s por cobro.
exports.consultarCobroClip = onCall(
    {secrets: [CLIP_API_KEY, CLIP_API_SECRET], timeoutSeconds: 30, memory: "256MiB"},
    async (request) => {
      const caja = await requireCaja(request.auth);
      const {cobroId} = request.data || {};
      if (!clip.cobroIdValido(cobroId)) {
        throw new HttpsError("invalid-argument", "cobroId inválido");
      }
      const ref = pagoClipRef(caja.negocioId, caja.sucursalId, cobroId);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new HttpsError("not-found", "No hay cobro con terminal para esta venta");
      }
      if (snap.data().nodoId !== caja.nodoId) {
        throw new HttpsError("permission-denied", "El cobro es de otra caja");
      }
      let c = snap.data();
      try {
        c = await refrescarCobroClip(ref);
      } catch (e) {
        logger.warn("consultarCobroClip: no se pudo consultar a Clip",
            {cobroId, error: e.message});
      }
      return clip.cobroPublico(c);
    },
);

// Cancela el cobro de la venta. Clip solo lo permite antes de que la
// terminal lo tome; después hay que cancelarlo en la terminal (se avisa).
// Con `comoPagado` (un envío incierto que el cajero vio aprobado en la
// terminal) el cobro se cierra como "manual" y libera la terminal; si luego
// llega el aviso de Clip, el pago se liga (ver aplicarPagoTardio).
exports.cancelarCobroClip = onCall(
    {secrets: [CLIP_API_KEY, CLIP_API_SECRET], timeoutSeconds: 40, memory: "256MiB"},
    async (request) => {
      const caja = await requireCaja(request.auth);
      const {cobroId, comoPagado} = request.data || {};
      if (!clip.cobroIdValido(cobroId)) {
        throw new HttpsError("invalid-argument", "cobroId inválido");
      }
      const ref = pagoClipRef(caja.negocioId, caja.sucursalId, cobroId);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new HttpsError("not-found", "No hay cobro con terminal para esta venta");
      }
      const c = snap.data();
      if (c.nodoId !== caja.nodoId) {
        throw new HttpsError("permission-denied", "El cobro es de otra caja");
      }
      if (c.estado === "pendiente" && c.pinpadRequestId) {
        // Abierto con su id: confirmarlo a mano no aplica, lo dice Clip.
        if (comoPagado === true) return clip.cobroPublico(c);
        try {
          await llamarClip("DELETE",
              `/f2f/pinpad/v1/payment/${encodeURIComponent(c.pinpadRequestId)}`);
        } catch (e) {
          const det = (e && e.details) || {};
          // Lo que respondió Clip, para saber por qué no canceló.
          logger.warn("cancelarCobroClip: Clip no canceló", {cobroId,
            clipStatus: det.clipStatus, clipCode: det.clipCode, error: e.message});
          let noExiste = false;
          const actual = await refrescarCobroClip(ref, {minMs: 0}).catch((err) => {
            noExiste = clip.noExisteEnClip(err);
            return c;
          });
          if (noExiste && det.clipCode !== "PAYMENT_PENDING") {
            // Clip ya no la tiene: borra sola la intención que nunca llegó a
            // la terminal, y esa ya no se puede cobrar.
            return clip.cobroPublico(await actualizarIntento(ref, c.intento,
                {estado: "cancelado"}, {soloDesde: ["pendiente"]}));
          }
          // Clip cancela por API solo antes de que la terminal muestre el
          // cobro, y la terminal lo muestra casi al instante (probado el
          // 2-nov-2026): entonces se cancela en la terminal.
          return {...clip.cobroPublico(actual),
            ...(actual.estado === "pendiente" ? {aviso: "El cobro ya está en la terminal: " +
              "cancélalo ahí. La caja se actualiza sola."} : {})};
        }
        // Clip lo canceló. Se confirma con la consulta; si aún dice PENDING,
        // se marca aquí (ya no puede cobrarse).
        let actual = await refrescarCobroClip(ref, {minMs: 0}).catch(() => null);
        if (!actual || actual.estado === "pendiente") {
          actual = await actualizarIntento(ref, c.intento, {estado: "cancelado"});
        }
        return clip.cobroPublico(actual);
      }
      const enviandoVivo = c.estado === "enviando" &&
        Date.now() - (Number(c.actualizadoEn) || 0) < clip.ENVIANDO_VENCE_MS;
      if (enviandoVivo) {
        return {...clip.cobroPublico(c),
          aviso: "El cobro se está enviando a la terminal: espera un momento."};
      }
      if (c.estado === "incierto" || c.estado === "enviando") {
        if (comoPagado === true) {
          return clip.cobroPublico(await actualizarIntento(ref, c.intento,
              {estado: "manual"}, {soloDesde: ["incierto", "enviando"]}));
        }
        const limpia = await limpiarTerminalClip(c.serial);
        if (!limpia.ok) return {...clip.cobroPublico(c), aviso: limpia.aviso};
        // Solo si sigue incierto: el aviso de Clip pudo haberlo ligado ya.
        return clip.cobroPublico(await actualizarIntento(ref, c.intento,
            {estado: "cancelado"}, {soloDesde: ["incierto", "enviando"]}));
      }
      return clip.cobroPublico(c);
    },
);

/**
 * Dinero en un intento que ya no es el abierto (el aviso llegó tarde, o se
 * reintentó un incierto que sí se cobró). Nunca se tira (lib/clip.js,
 * decidirPagoTardio): si el cobro no estaba aprobado, queda aprobado con este
 * pago (o en revisión si no cuadra) y se cancela en Clip el intento que siga
 * abierto; si ya lo estaba, es un cobro doble marcado para devolverlo a mano.
 */
async function aplicarPagoTardio(ref, id, r) {
  const ev = clip.evaluarIntentoClip(r, clip.centavos(r.amount));
  if (ev.estado !== "aprobado" && ev.estado !== "revisar") return;
  const ahora = Date.now();
  const res = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    const c = snap.data();
    const accion = clip.decidirPagoTardio(c, id);
    if (accion === "ignorar") return null;
    const pago = {id, pagadoCentavos: ev.pagadoCentavos, en: ahora,
      ...(ev.tarjeta ? {tarjeta: ev.tarjeta} : {})};
    if (accion === "extra") {
      tx.update(ref, {alerta: "varias-aprobaciones", actualizadoEn: ahora,
        aprobacionesExtra: FieldValue.arrayUnion(pago), pinpadIds: FieldValue.arrayUnion(id)});
      return {accion, c};
    }
    const candadoRef = c.serial ? candadoClipRef(c.negocioId, c.serial) : null;
    const candSnap = candadoRef ? await tx.get(candadoRef) : null;
    const cuadra = ev.estado === "aprobado" && ev.pagadoCentavos >= c.montoCentavos;
    tx.update(ref, {
      estado: cuadra ? "aprobado" : "revisar",
      pinpadRequestId: id,
      pinpadIds: FieldValue.arrayUnion(id),
      tarjeta: ev.tarjeta || null,
      pagadoCentavos: ev.pagadoCentavos,
      alerta: cuadra ?
        (ev.alerta || (c.estado === "manual" ? null : "aprobado-tarde")) :
        "pago-de-menos",
      pagoTardio: {id, estadoAntes: c.estado, intentoAbierto: c.intento, en: ahora},
      actualizadoEn: ahora,
    });
    if (candSnap && candSnap.exists && candSnap.data().cobroPath === ref.path) {
      tx.delete(candadoRef);
    }
    return {accion, c};
  });
  if (!res) return;
  logger.error("clip: pago tardío (revisar en Clip)",
      {cobroId: res.c.cobroId, id, accion: res.accion, estadoAntes: res.c.estado});
  // El cobro ya se pagó: si otro intento sigue abierto en la terminal, fuera.
  if (res.accion === "aprobar" && res.c.estado === "pendiente" &&
      res.c.pinpadRequestId && res.c.pinpadRequestId !== id) {
    await llamarClip("DELETE",
        `/f2f/pinpad/v1/payment/${encodeURIComponent(res.c.pinpadRequestId)}`)
        .catch(() => {});
  }
}

/** Un id viejo de nuestros cobros: si trae dinero, aplicarPagoTardio. */
async function revisarIntentoViejoClip(ref, id) {
  let r;
  try {
    r = await llamarClip("GET", rutaPagoClip(id), {detalle: true});
  } catch (e) {
    logger.warn("webhookClip: no se pudo consultar un intento viejo", {id, error: e.message});
    return;
  }
  await aplicarPagoTardio(ref, id, r);
}

/**
 * Aviso de un cobro cuyo id no tenemos: se perdió la respuesta del envío y
 * el intento quedó incierto. La referencia (cobroId-n) lo liga de vuelta.
 */
async function adoptarIntentoClip(id) {
  let r;
  try {
    r = await llamarClip("GET", rutaPagoClip(id), {detalle: true});
  } catch (e) {
    logger.warn("webhookClip: id desconocido", {id, error: e.message});
    return;
  }
  const ref = clip.leerReferencia(r.reference);
  const conPago = ["aprobado", "revisar"]
      .includes(clip.evaluarIntentoClip(r, clip.centavos(r.amount)).estado);
  // Un aviso con dinero que no ligamos a una venta es lo que hay que revisar.
  const reportar = (motivo, extra) => {
    const datos = {id, reference: String(r.reference || "").slice(0, 80),
      status: r.status, ...extra};
    if (conPago) logger.error(`webhookClip: ${motivo}`, datos);
    else logger.info(`webhookClip: ${motivo}`, datos);
  };
  if (!ref) return reportar("referencia ajena");
  const q = await db.collectionGroup(COL_PAGOS_CLIP)
      .where("cobroId", "==", ref.cobroId).limit(1).get();
  if (q.empty) return reportar("cobro no encontrado");
  const doc = q.docs[0];
  const c = doc.data();
  const eraSinId = (c.intentosSinId || []).includes(ref.intento);
  if (eraSinId) await ligarIntentoSinId(doc.ref, ref.intento, id);
  if (c.intento === ref.intento && ["incierto", "enviando"].includes(c.estado)) {
    await actualizarIntento(doc.ref, c.intento,
        {estado: "pendiente", pinpadRequestId: id, pinpadIds: FieldValue.arrayUnion(id)});
    await refrescarCobroClip(doc.ref, {minMs: 0});
    return;
  }
  // El cajero lo dio por pagado a mano y Clip dice que no hubo pago: revisar.
  const ev = clip.evaluarIntentoClip(r, clip.centavos(r.amount));
  if (c.estado === "manual" && c.intento === ref.intento &&
      (ev.estado === "fallido" || ev.estado === "cancelado")) {
    await doc.ref.update({alerta: "manual-sin-pago", actualizadoEn: Date.now()});
    logger.error("clip: confirmado a mano pero Clip no lo cobró", {cobroId: c.cobroId, id});
    return;
  }
  // No es el intento abierto: si trae dinero, no se tira.
  if (!eraSinId) reportar("intento que no está abierto", {intento: c.intento, estado: c.estado});
  await aplicarPagoTardio(doc.ref, id, r);
}

/** El intento `n` ya tiene id: deja de contar como "sin id". */
async function ligarIntentoSinId(ref, n, id) {
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const quedan = (snap.data().intentosSinId || []).filter((x) => x !== n);
    tx.update(ref, {intentosSinId: quedan,
      ...(quedan.length === 0 ? {sinIdHasta: 0} : {}),
      pinpadIds: FieldValue.arrayUnion(id)});
  });
}

// Aviso de Clip: {id, origin, event_type}, sin firma y una sola vez. Nunca
// se cree: solo dispara la consulta a Clip, y solo para ids nuestros (o si
// hay un envío incierto que ligar). Siempre responde 200.
exports.webhookClip = onRequest(
    {secrets: [CLIP_API_KEY, CLIP_API_SECRET], maxInstances: 2, timeoutSeconds: 30,
      memory: "256MiB"},
    async (req, res) => {
      if (req.method !== "POST") {
        res.status(405).end();
        return;
      }
      const id = req.body && typeof req.body.id === "string" ? req.body.id.trim() : "";
      if (!/^pinpad-[A-Za-z0-9-]{8,80}$/.test(id)) {
        res.status(200).json({ok: true});
        return;
      }
      try {
        const q = await db.collectionGroup(COL_PAGOS_CLIP)
            .where("pinpadIds", "array-contains", id).limit(1).get();
        if (!q.empty) {
          const c = q.docs[0].data();
          if (c.pinpadRequestId !== id) {
            await revisarIntentoViejoClip(q.docs[0].ref, id);
          } else if (c.estado === "pendiente") {
            await refrescarCobroClip(q.docs[0].ref, {minMs: 0});
          }
        } else {
          // Un id que no tenemos solo puede ser un envío cuya respuesta se
          // perdió. Si no hay envíos así, no se consulta a Clip: ids
          // inventados no nos hacen gastar consultas con la clave del negocio.
          const sinIdQ = await db.collectionGroup(COL_PAGOS_CLIP)
              .where("sinIdHasta", ">", Date.now()).limit(1).get();
          if (!sinIdQ.empty) await adoptarIntentoClip(id);
        }
      } catch (e) {
        logger.error("webhookClip", {id, error: e.message});
      }
      res.status(200).json({ok: true});
    },
);

// ============================================================
// Cashback de mayoreo — propio de la tienda (sin amise.mx)
// ============================================================
// Solo cajas de sucursales con `modoMayoreo`. Una cuenta por teléfono, con
// PIN de 4 dígitos para la página del cliente y QR o tarjeta para acumular y
// gastar. Todo el estado lo escribe el servidor (reglas cerradas). Lo ganado
// se acredita al subir la venta (`acreditarCashbackMayoreo`), así que también
// funciona con ventas hechas sin internet. Lógica pura: lib/cashbackMayoreo.js.

const COL_CASHBACK_MAYOREO = `cashback_mayoreo${SUFFIX}`;
const COL_CLIENTES_MAYOREO = `clientes_mayoreo${SUFFIX}`;
const COL_TARJETAS_MAYOREO = `tarjetas_mayoreo${SUFFIX}`;
const COL_QR_MAYOREO = `qr_mayoreo${SUFFIX}`;
const COL_CASHBACK_SESIONES = `cashback_sesiones${SUFFIX}`;
const COL_CASHBACK_INTENTOS = `cashback_intentos${SUFFIX}`;
const OPC_CB = {timeoutSeconds: 20, memory: "256MiB"};
const OPC_CB_PIN = {...OPC_CB, secrets: [CASHBACK_PIN_PEPPER]};
// La página del cliente es pública: pocas instancias frenan la fuerza bruta.
const OPC_CB_CLIENTE = {...OPC_CB, maxInstances: 5};
// Con PIN: una petición a la vez por instancia (máximo 5 en paralelo).
const OPC_CB_CLIENTE_PIN = {...OPC_CB_CLIENTE, concurrency: 1, secrets: [CASHBACK_PIN_PEPPER]};
const RE_VENTA_ID = /^[A-Za-z0-9_-]{6,80}$/;

const negRefCb = (nid) => db.collection(COL_NEGOCIOS).doc(nid);
const cuentaRefCb = (nid, tel) => negRefCb(nid).collection(COL_CLIENTES_MAYOREO).doc(tel);
const accesoRefCb = (nid, tel) => cuentaRefCb(nid, tel).collection("privado").doc("acceso");
const movRefCb = (nid, tel, id) => cuentaRefCb(nid, tel).collection("movimientos").doc(id);
const configRefCb = (nid) => negRefCb(nid).collection(COL_CASHBACK_MAYOREO).doc("config");
const isoCb = (ms) => new Date(ms).toISOString();
const pesosCb = (c) => `$${(Math.max(0, c) / 100).toFixed(2).replace(/\.00$/, "")}`;

/** Si el saldo ya venció, lo deja en 0 con su movimiento. Va DENTRO de una
 *  transacción, después de todas sus lecturas. Devuelve la cuenta al día.
 *  `ahoraMs` se calcula fuera de la transacción (estable en sus reintentos). */
function vencerCuentaEnTx(tx, nid, tel, cuenta, ahoraMs) {
  if (!cm.vencioConSaldo(cuenta, ahoraMs)) return cuenta;
  tx.set(movRefCb(nid, tel, `ven_${cuenta.venceISO.replace(/\D/g, "")}_${ahoraMs}`), {
    tipo: "vencido",
    centavos: cuenta.saldoCentavos,
    saldoDespuesCentavos: 0,
    fechaISO: cuenta.venceISO,
  });
  tx.update(cuentaRefCb(nid, tel), {saldoCentavos: 0});
  return {...cuenta, saldoCentavos: 0};
}

// Cada uso de saldo en una venta vive en `movimientos/uso_{ventaId}` con su
// estado: "usado" (descontado, la venta aún no sube), "devuelto" (el cobro no
// se completó) o "confirmado" (la venta subió). Un uso "usado" de hace más de
// 6 h sin venta se devuelve solo al consultar la cuenta (p. ej. la caja no
// pudo devolverlo por falta de red). Si esa venta llega después, el
// disparador vuelve a descontarlo.
const PENDIENTE_CB_MS = 6 * 60 * 60 * 1000;
const usosPendientesCb = (nid, tel) =>
  cuentaRefCb(nid, tel).collection("movimientos").where("estado", "==", "usado");

/** Devuelve (DENTRO de la tx, tras sus lecturas) los usos viejos sin venta.
 *  `pendientes` = resultado de `tx.get(usosPendientesCb(...))`. */
function devolverUsosViejosEnTx(tx, nid, tel, cuenta, pendientes, ahoraMs, exceptoVentaId) {
  let saldo = cuenta.saldoCentavos || 0;
  for (const u of pendientes.docs) {
    const x = u.data();
    if (x.ventaId === exceptoVentaId) continue;
    if (ahoraMs - (Date.parse(x.ultimoUsoISO || x.fechaISO) || 0) < PENDIENTE_CB_MS) continue;
    const ret = x.retenidoCentavos || 0;
    saldo += ret;
    tx.set(movRefCb(nid, tel, `dev_${x.ventaId}_${x.veces || 1}`), {
      tipo: "devuelto", centavos: ret, saldoDespuesCentavos: saldo, ventaId: x.ventaId,
      automatico: true, fechaISO: isoCb(ahoraMs),
    });
    tx.update(u.ref, {estado: "devuelto", retenidoCentavos: 0});
    logger.warn("cashbackMayoreo_uso_devuelto_solo", {ventaId: x.ventaId, centavos: ret});
  }
  if (saldo === (cuenta.saldoCentavos || 0)) return cuenta;
  tx.update(cuentaRefCb(nid, tel), {saldoCentavos: saldo});
  return {...cuenta, saldoCentavos: saldo};
}

/** Vencimiento + usos viejos sin venta: la cuenta al día. */
function cuentaAlDiaEnTx(tx, nid, tel, cuenta, pendientes, ahoraMs, exceptoVentaId) {
  const c = vencerCuentaEnTx(tx, nid, tel, cuenta, ahoraMs);
  return devolverUsosViejosEnTx(tx, nid, tel, c, pendientes, ahoraMs, exceptoVentaId);
}

/** Caja de una sucursal de mayoreo con el programa activo. */
async function cajaCashbackMayoreo(auth) {
  const c = await requireCaja(auth);
  const [suc, cfg] = await Promise.all([
    negRefCb(c.negocioId).collection(COL_SUCURSALES).doc(c.sucursalId).get(),
    configRefCb(c.negocioId).get(),
  ]);
  if (!suc.exists || suc.get("modoMayoreo") !== true) {
    throw new HttpsError("failed-precondition", "Esta caja no es de una sucursal de mayoreo");
  }
  const config = cfg.exists ? cfg.data() : null;
  if (!config || config.activo !== true || cm.validarConfig(config)) {
    throw new HttpsError("failed-precondition",
        "El cashback de mayoreo no está activo: actívalo en admin");
  }
  return {...c, config};
}

/** Teléfono de la cuenta a partir del QR, la tarjeta o (si se permite) el
 *  teléfono tecleado. `via` dice cuál se usó: con teléfono no se gasta. */
async function telDeIdentificadorCb(nid, d, {permitirTelefono}) {
  const qr = cm.leerQr(d.qr);
  if (qr) {
    const s = await negRefCb(nid).collection(COL_QR_MAYOREO).doc(qr).get();
    if (!s.exists) {
      throw new HttpsError("not-found",
          "Ese QR ya no sirve: pide al cliente el de su página (pudo haberlo cambiado)");
    }
    return {tel: s.get("telefono"), via: "qr"};
  }
  if (d.tarjeta) {
    const t = String(d.tarjeta).replace(/\D/g, "");
    if (!puntosSeg.esEan13(t)) {
      throw new HttpsError("invalid-argument", "Código de tarjeta inválido (13 dígitos)");
    }
    const s = await negRefCb(nid).collection(COL_TARJETAS_MAYOREO).doc(t).get();
    if (!s.exists) {
      throw new HttpsError("not-found", "Esa tarjeta no está ligada a ninguna cuenta de cashback");
    }
    return {tel: s.get("telefono"), via: "tarjeta"};
  }
  if (permitirTelefono) {
    const tel = cm.normalizarTelefono(d.telefono);
    if (!tel) throw new HttpsError("invalid-argument", "Teléfono inválido (10 dígitos)");
    return {tel, via: "telefono"};
  }
  throw new HttpsError("invalid-argument", "Escanea el QR o la tarjeta del cliente");
}

function resumenCuentaCb(cuenta, via, ahoraMs) {
  return {
    telefono: cuenta.telefono,
    nombre: cuenta.nombre || "",
    saldoCentavos: cm.saldoVigente(cuenta, ahoraMs),
    venceISO: cuenta.venceISO || null,
    ultimaCompraISO: cuenta.ultimaCompraISO || null,
    tarjetaUltimos4: cuenta.tarjeta ? String(cuenta.tarjeta).slice(-4) : null,
    puedeGastar: via === "qr" || via === "tarjeta",
  };
}

/** Abre la cuenta y devuelve el PIN (una sola vez, para el ticket). */
exports.abrirCuentaCashbackMayoreo = onCall(OPC_CB_PIN, async (request) => {
  const c = await cajaCashbackMayoreo(request.auth);
  const d = request.data || {};
  const tel = cm.normalizarTelefono(d.telefono);
  if (!tel) throw new HttpsError("invalid-argument", "Teléfono inválido (10 dígitos)");
  if (d.leido !== true) {
    throw new HttpsError("failed-precondition", "Primero léele al cliente las condiciones");
  }
  const nombre = typeof d.nombre === "string" ? d.nombre.trim().slice(0, 60) : "";
  const tarjeta = d.tarjeta ? String(d.tarjeta).replace(/\D/g, "") : "";
  if (tarjeta && !puntosSeg.esEan13(tarjeta)) {
    throw new HttpsError("invalid-argument", "Código de tarjeta inválido (13 dígitos)");
  }
  const pin = cm.generarPin(tel);
  const sal = cm.generarSal();
  const qr = cm.generarTokenQr();
  const ahora = isoCb(Date.now());
  const neg = negRefCb(c.negocioId);
  await db.runTransaction(async (tx) => {
    const cuentaRef = cuentaRefCb(c.negocioId, tel);
    const tarjetaRef = tarjeta ? neg.collection(COL_TARJETAS_MAYOREO).doc(tarjeta) : null;
    const [cs, ts] = await Promise.all([
      tx.get(cuentaRef),
      tarjetaRef ? tx.get(tarjetaRef) : Promise.resolve(null),
    ]);
    if (cs.exists) throw new HttpsError("already-exists", "Ese teléfono ya tiene cuenta de cashback");
    if (ts && ts.exists) throw new HttpsError("already-exists", "Esa tarjeta ya está ligada a otra cuenta");
    tx.create(cuentaRef, {
      telefono: tel,
      ...(nombre ? {nombre} : {}),
      saldoCentavos: 0,
      fechaAltaISO: ahora,
      sucursalAlta: c.sucursalId,
      nodoAlta: c.nodoId,
      gen: 1,
      ...(tarjeta ? {tarjeta} : {}),
    });
    tx.create(accesoRefCb(c.negocioId, tel), {
      sal,
      pinHash: cm.hashPin(CASHBACK_PIN_PEPPER.value(), sal, pin),
      qr,
      actualizadoISO: ahora,
    });
    tx.create(neg.collection(COL_QR_MAYOREO).doc(qr), {telefono: tel, creadoISO: ahora});
    if (tarjetaRef) {
      tx.create(tarjetaRef, {telefono: tel, creadoISO: ahora, sucursalId: c.sucursalId});
    }
  });
  logger.info("cashbackMayoreo_alta", {tel4: tel.slice(-4), sucursalId: c.sucursalId});
  return {
    pin,
    cuenta: resumenCuentaCb({telefono: tel, nombre, saldoCentavos: 0, tarjeta}, "telefono", Date.now()),
  };
});

/** Busca la cuenta por QR, tarjeta o teléfono (al día con el vencimiento). */
exports.buscarCuentaCashbackMayoreo = onCall(OPC_CB, async (request) => {
  const c = await cajaCashbackMayoreo(request.auth);
  const {tel, via} = await telDeIdentificadorCb(c.negocioId, request.data || {}, {permitirTelefono: true});
  const ahoraMs = Date.now();
  const cuenta = await db.runTransaction(async (tx) => {
    const [s, pend] = await Promise.all([
      tx.get(cuentaRefCb(c.negocioId, tel)),
      tx.get(usosPendientesCb(c.negocioId, tel)),
    ]);
    if (!s.exists) return null;
    return cuentaAlDiaEnTx(tx, c.negocioId, tel, s.data(), pend, ahoraMs);
  });
  const config = {pct: c.config.pct, vigencia: c.config.vigencia};
  if (!cuenta) {
    if (via === "telefono") return {existe: false, telefono: tel, config};
    throw new HttpsError("not-found", "La cuenta de ese QR o tarjeta ya no existe");
  }
  return {existe: true, ...resumenCuentaCb(cuenta, via, ahoraMs), config};
});

/** Descuenta saldo para una venta (antes de crearla). Idempotente por venta:
 *  si ya está descontado no se repite; si se había devuelto (la terminal
 *  rechazó la tarjeta y se reintenta), se vuelve a descontar. */
exports.usarCashbackMayoreo = onCall(OPC_CB, async (request) => {
  const c = await cajaCashbackMayoreo(request.auth);
  const d = request.data || {};
  const centavos = Number(d.centavos);
  if (!Number.isInteger(centavos) || centavos <= 0 || centavos > 100000000) {
    throw new HttpsError("invalid-argument", "Monto de cashback inválido");
  }
  if (typeof d.ventaId !== "string" || !RE_VENTA_ID.test(d.ventaId)) {
    throw new HttpsError("invalid-argument", "Falta el folio de la venta");
  }
  const ventaId = d.ventaId;
  const {tel} = await telDeIdentificadorCb(c.negocioId, d, {permitirTelefono: false});
  const ahoraMs = Date.now();
  return db.runTransaction(async (tx) => {
    const cuentaRef = cuentaRefCb(c.negocioId, tel);
    const usoRef = movRefCb(c.negocioId, tel, `uso_${ventaId}`);
    const [cs, us, pend] = await Promise.all([
      tx.get(cuentaRef), tx.get(usoRef), tx.get(usosPendientesCb(c.negocioId, tel)),
    ]);
    if (!cs.exists) throw new HttpsError("not-found", "La cuenta ya no existe");
    const estado = us.exists ? us.get("estado") : null;
    if (estado === "usado" || estado === "confirmado") {
      if (us.get("retenidoCentavos") !== centavos) {
        throw new HttpsError("failed-precondition", "Esa venta ya usó otro monto de cashback");
      }
      return {telefono: tel, usadoCentavos: centavos,
        saldoCentavos: cm.saldoVigente(cs.data(), ahoraMs), ya: true};
    }
    const cuenta = cuentaAlDiaEnTx(tx, c.negocioId, tel, cs.data(), pend, ahoraMs, ventaId);
    const saldo = cm.saldoVigente(cuenta, ahoraMs);
    if (centavos > saldo) {
      throw new HttpsError("failed-precondition", `Saldo insuficiente: el cliente tiene ${pesosCb(saldo)}`);
    }
    const despues = saldo - centavos;
    const ahora = isoCb(ahoraMs);
    const mov = {
      tipo: "usado", centavos, saldoDespuesCentavos: despues, ventaId,
      sucursalId: c.sucursalId, nodoId: c.nodoId, fechaISO: ahora,
    };
    const control = {estado: "usado", retenidoCentavos: centavos, ultimoUsoISO: ahora,
      sucursalId: c.sucursalId, nodoId: c.nodoId};
    if (!us.exists) {
      tx.set(usoRef, {...mov, ...control, veces: 1});
    } else {
      // Se había devuelto (rechazo de la tarjeta, etc.) y se reintenta.
      const veces = (us.get("veces") || 1) + 1;
      tx.set(movRefCb(c.negocioId, tel, `uso_${ventaId}_${veces}`), mov);
      tx.update(usoRef, {...control, veces});
    }
    tx.update(cuentaRef, {saldoCentavos: despues});
    return {telefono: tel, usadoCentavos: centavos, saldoCentavos: despues};
  });
});

/** Regresa lo usado si la venta no se completó (p. ej. falló la terminal).
 *  No devuelve si la venta ya subió (uso "confirmado"). Si se vuelve a
 *  usar con el mismo folio, se descuenta otra vez. */
exports.devolverCashbackMayoreo = onCall(OPC_CB, async (request) => {
  const c = await requireCaja(request.auth);
  const d = request.data || {};
  const tel = cm.normalizarTelefono(d.telefono);
  if (!tel || typeof d.ventaId !== "string" || !RE_VENTA_ID.test(d.ventaId)) {
    throw new HttpsError("invalid-argument", "Faltan el teléfono o el folio");
  }
  const ventaId = d.ventaId;
  const ahoraMs = Date.now();
  return db.runTransaction(async (tx) => {
    const cuentaRef = cuentaRefCb(c.negocioId, tel);
    const usoRef = movRefCb(c.negocioId, tel, `uso_${ventaId}`);
    const [cs, us] = await Promise.all([tx.get(cuentaRef), tx.get(usoRef)]);
    if (!cs.exists || !us.exists) return {devueltoCentavos: 0};
    const estado = us.get("estado");
    if (estado === "devuelto") return {devueltoCentavos: 0, ya: true};
    if (estado !== "usado") {
      throw new HttpsError("failed-precondition", "Esa venta ya se registró: no se devuelve el cashback");
    }
    if (us.get("sucursalId") !== c.sucursalId) {
      throw new HttpsError("permission-denied", "Ese cashback se usó en otra sucursal");
    }
    const centavos = us.get("retenidoCentavos") || 0;
    // Si el saldo venció mientras tanto, lo devuelto también vence (1 de enero, etc.).
    const cuenta = vencerCuentaEnTx(tx, c.negocioId, tel, cs.data(), ahoraMs);
    const despues = (cuenta.saldoCentavos || 0) + centavos;
    tx.set(movRefCb(c.negocioId, tel, `dev_${ventaId}_${us.get("veces") || 1}`), {
      tipo: "devuelto", centavos, saldoDespuesCentavos: despues, ventaId,
      sucursalId: c.sucursalId, nodoId: c.nodoId, fechaISO: isoCb(ahoraMs),
    });
    tx.update(usoRef, {estado: "devuelto", retenidoCentavos: 0});
    tx.update(cuentaRef, {saldoCentavos: despues});
    return {devueltoCentavos: centavos, saldoCentavos: despues};
  });
});

/** Liga una tarjeta física (EAN-13) a la cuenta. Con el QR del cliente, o con
 *  el teléfono si el cajero lo verificó en persona. Una por cuenta: la nueva
 *  reemplaza a la anterior. */
exports.vincularTarjetaCashbackMayoreo = onCall(OPC_CB, async (request) => {
  const c = await cajaCashbackMayoreo(request.auth);
  const d = request.data || {};
  const tarjeta = String(d.tarjeta || "").replace(/\D/g, "");
  if (!puntosSeg.esEan13(tarjeta)) {
    throw new HttpsError("invalid-argument", "Código de tarjeta inválido (13 dígitos)");
  }
  if (!cm.leerQr(d.qr) && d.verificado !== true) {
    throw new HttpsError("failed-precondition",
        "Escanea el QR del cliente o confirma que lo verificaste en persona");
  }
  const {tel} = await telDeIdentificadorCb(c.negocioId, {qr: d.qr, telefono: d.telefono},
      {permitirTelefono: true});
  const neg = negRefCb(c.negocioId);
  await db.runTransaction(async (tx) => {
    const cuentaRef = cuentaRefCb(c.negocioId, tel);
    const tarjetaRef = neg.collection(COL_TARJETAS_MAYOREO).doc(tarjeta);
    const [cs, ts] = await Promise.all([tx.get(cuentaRef), tx.get(tarjetaRef)]);
    if (!cs.exists) throw new HttpsError("not-found", "No hay cuenta de cashback con ese teléfono");
    if (ts.exists && ts.get("telefono") !== tel) {
      throw new HttpsError("already-exists", "Esa tarjeta ya está ligada a otra cuenta");
    }
    if (ts.exists) return;
    const anterior = cs.get("tarjeta");
    if (anterior && anterior !== tarjeta) tx.delete(neg.collection(COL_TARJETAS_MAYOREO).doc(anterior));
    const ahoraMs = Date.now();
    tx.create(tarjetaRef, {telefono: tel, creadoISO: isoCb(ahoraMs), sucursalId: c.sucursalId});
    tx.update(cuentaRef, {tarjeta});
    // Queda a la vista de admin: quién ligó qué tarjeta y cómo se verificó.
    tx.set(movRefCb(c.negocioId, tel, `tar_${ahoraMs}`), {
      tipo: "tarjeta_ligada", centavos: 0, tarjetaUltimos4: tarjeta.slice(-4),
      verificadoCon: cm.leerQr(d.qr) ? "qr" : "en persona",
      sucursalId: c.sucursalId, nodoId: c.nodoId, fechaISO: isoCb(ahoraMs),
    });
  });
  return {tarjetaUltimos4: tarjeta.slice(-4)};
});

/** PIN olvidado: el cajero lo repone en la tienda tras verificar al cliente.
 *  Cierra las sesiones abiertas de la página y quita el bloqueo de intentos. */
exports.reponerPinCashbackMayoreo = onCall(OPC_CB_PIN, async (request) => {
  const c = await cajaCashbackMayoreo(request.auth);
  const d = request.data || {};
  const tel = cm.normalizarTelefono(d.telefono);
  if (!tel) throw new HttpsError("invalid-argument", "Teléfono inválido (10 dígitos)");
  if (d.verificado !== true) {
    throw new HttpsError("failed-precondition", "Confirma que verificaste al cliente en persona");
  }
  const pin = cm.generarPin(tel);
  const sal = cm.generarSal();
  const ahora = isoCb(Date.now());
  await db.runTransaction(async (tx) => {
    const cuentaRef = cuentaRefCb(c.negocioId, tel);
    const cs = await tx.get(cuentaRef);
    if (!cs.exists) throw new HttpsError("not-found", "No hay cuenta de cashback con ese teléfono");
    tx.update(accesoRefCb(c.negocioId, tel), {
      sal, pinHash: cm.hashPin(CASHBACK_PIN_PEPPER.value(), sal, pin), actualizadoISO: ahora,
    });
    tx.update(cuentaRef, {gen: (cs.get("gen") || 0) + 1, pinRepuestoISO: ahora, pinRepuestoPor: c.nodoId});
    // Queda a la vista de admin: quién repuso el PIN.
    tx.set(movRefCb(c.negocioId, tel, `pin_${Date.parse(ahora)}`), {
      tipo: "pin_repuesto", centavos: 0, sucursalId: c.sucursalId, nodoId: c.nodoId, fechaISO: ahora,
    });
    tx.delete(negRefCb(c.negocioId).collection(COL_CASHBACK_INTENTOS).doc(`tel_${cm.hashSesion(tel)}`));
  });
  logger.info("cashbackMayoreo_pin_repuesto", {tel4: tel.slice(-4), nodoId: c.nodoId});
  return {pin};
});

/** Acredita lo ganado al subir la venta (también las hechas sin internet).
 *  Idempotente por venta (`gan_{ventaId}`). Gana sobre lo pagado con dinero:
 *  `montoCobro` ya viene sin el cashback usado ni la comisión de tarjeta. */
exports.acreditarCashbackMayoreo = onDocumentCreated(
    {
      document: "negocios_web_new_version/{negocioId}/" +
        "sucursales_data_web_new_version/{sucursalId}/" +
        "ventas_n_web_new_version/{year}/{month}/{day}/items/{ventaId}",
      retry: true,
    },
    async (event) => {
      const snap = event.data;
      if (!snap) return;
      const v = snap.data() || {};
      const cb = v.cashbackMayoreo;
      if (!cb || !cb.telefono) return;
      const {negocioId, sucursalId, ventaId} = event.params;
      const tel = cm.normalizarTelefono(cb.telefono);
      if (!tel) return;
      const usadoVenta = Number.isInteger(cb.usadoCentavos) && cb.usadoCentavos > 0 ? cb.usadoCentavos : 0;
      const [suc, cfgSnap] = await Promise.all([
        negRefCb(negocioId).collection(COL_SUCURSALES).doc(sucursalId).get(),
        configRefCb(negocioId).get(),
      ]);
      const config = cfgSnap.exists ? cfgSnap.data() : null;
      const activo = suc.exists && suc.get("modoMayoreo") === true && !!config &&
        config.activo === true && !cm.validarConfig(config);
      if (!activo) logger.warn("cashbackMayoreo_venta_sin_programa", {ventaId, sucursalId});
      const giftTotal = (Array.isArray(v.articulos) ? v.articulos : [])
          .filter((a) => a && a.giftCard)
          .reduce((s, a) => s + (Number(a.cantidad) || 0) * (Number(a.descuento) || Number(a.precio) || 0), 0);
      const ganado = activo ?
        cm.ganadoCentavos(Math.max(0, (Number(v.montoCobro) || 0) - giftTotal), config.pct) : 0;
      // La fecha la pone la tablet: nunca en el futuro (alargaría la vigencia).
      const compraMs = Math.min(Date.parse(v.fechaISO) || Date.now(), Date.now());
      await db.runTransaction(async (tx) => {
        const cuentaRef = cuentaRefCb(negocioId, tel);
        const ganRef = movRefCb(negocioId, tel, `gan_${ventaId}`);
        const usoRef = movRefCb(negocioId, tel, `uso_${ventaId}`);
        const [cs, gs, us] = await Promise.all([tx.get(cuentaRef), tx.get(ganRef), tx.get(usoRef)]);
        if (!cs.exists) return;
        const estadoUso = us.exists ? us.get("estado") : null;
        const ganar = activo && !gs.exists;
        // Uso de saldo: se confirma; si la caja lo había devuelto (o nunca se
        // descontó) pero la venta sí guardó el descuento, se descuenta otra vez.
        const recobrar = usadoVenta > 0 && estadoUso !== "usado" && estadoUso !== "confirmado";
        // La venta subió SIN el descuento que se había apartado: se regresa.
        const soltar = usadoVenta === 0 && estadoUso === "usado";
        if (!ganar && !recobrar && !soltar && estadoUso !== "usado") return;
        // Si el saldo ya había vencido al momento de esta compra, se pierde antes de sumar.
        const cuenta = vencerCuentaEnTx(tx, negocioId, tel, cs.data(), compraMs);
        let saldo = cuenta.saldoCentavos || 0;
        const ahora = isoCb(Date.now());
        if (recobrar) {
          const cobrar = Math.min(usadoVenta, saldo);
          saldo -= cobrar;
          const veces = us.exists ? (us.get("veces") || 1) + 1 : 1;
          const mov = {
            tipo: "usado", centavos: cobrar, saldoDespuesCentavos: saldo, ventaId,
            sucursalId, nodoId: v.nodoId || null, fechaISO: ahora, automatico: true,
            ...(cobrar < usadoVenta ? {faltanteCentavos: usadoVenta - cobrar} : {}),
          };
          const control = {estado: "confirmado", ventaConfirmada: true, retenidoCentavos: cobrar, veces};
          if (us.exists) {
            tx.set(movRefCb(negocioId, tel, `uso_${ventaId}_${veces}`), mov);
            tx.update(usoRef, control);
          } else {
            tx.set(usoRef, {...mov, ...control, ultimoUsoISO: ahora});
          }
          logger.warn("cashbackMayoreo_uso_recobrado", {ventaId, usadoVenta, cobrar});
        } else if (soltar) {
          const ret = us.get("retenidoCentavos") || 0;
          saldo += ret;
          tx.set(movRefCb(negocioId, tel, `dev_${ventaId}_${us.get("veces") || 1}`), {
            tipo: "devuelto", centavos: ret, saldoDespuesCentavos: saldo, ventaId,
            automatico: true, fechaISO: ahora,
          });
          tx.update(usoRef, {estado: "devuelto", retenidoCentavos: 0});
        } else if (estadoUso === "usado") {
          tx.update(usoRef, {estado: "confirmado", ventaConfirmada: true});
        }
        const upd = {saldoCentavos: saldo};
        if (ganar) {
          const ultimaMs = Math.max(compraMs, Date.parse(cuenta.ultimaCompraISO || "") || 0);
          saldo += ganado;
          upd.saldoCentavos = saldo;
          upd.ultimaCompraISO = isoCb(ultimaMs);
          upd.venceISO = isoCb(cm.calcularVence(ultimaMs, config.vigencia));
          tx.set(ganRef, {
            tipo: "ganado", centavos: ganado, saldoDespuesCentavos: saldo, ventaId,
            sucursalId, nodoId: v.nodoId || null, numeroDeVenta: v.numeroDeVenta || null,
            fechaISO: isoCb(compraMs),
          });
        }
        tx.update(cuentaRef, upd);
      });
    },
);

// ---------- Página del cliente (pública; sesión opaca, sin Firebase Auth) ----------

function negocioPublicoCb(nid) {
  return typeof nid === "string" && /^[a-z0-9-]{1,40}$/.test(nid) ? nid : "amise";
}

/** IP del cliente: la ÚLTIMA de X-Forwarded-For, que agrega el front de
 *  Google. Las de antes las pone quien llama (se pueden inventar). */
function ipDeCb(request) {
  const raw = request.rawRequest || {};
  const xff = raw.headers && raw.headers["x-forwarded-for"];
  const partes = typeof xff === "string" ? xff.split(",").map((s) => s.trim()).filter(Boolean) : [];
  return partes[partes.length - 1] || raw.ip || "?";
}

/** Sesión vigente de la página (y la cuenta no cambió de PIN desde entonces). */
async function sesionClienteCb(d) {
  const nid = negocioPublicoCb(d && d.negocioId);
  const token = d && d.sesion;
  if (typeof token !== "string" || token.length < 20 || token.length > 100) {
    throw new HttpsError("unauthenticated", "Tu sesión terminó. Vuelve a entrar.");
  }
  const ref = negRefCb(nid).collection(COL_CASHBACK_SESIONES).doc(cm.hashSesion(token));
  const s = await ref.get();
  const ses = s.exists ? s.data() : null;
  let vale = !!ses && Date.now() < ses.venceMs;
  if (vale) {
    const cs = await cuentaRefCb(nid, ses.telefono).get();
    vale = cs.exists && (cs.get("gen") || 0) === ses.gen;
  }
  if (!vale) {
    if (s.exists) await ref.delete().catch(() => {});
    throw new HttpsError("unauthenticated", "Tu sesión terminó. Vuelve a entrar.");
  }
  return {nid, ref, tel: ses.telefono};
}

/** Revisa el PIN. El intento se cuenta ANTES de revisarlo y en una sola
 *  transacción con el bloqueo (por teléfono y por IP): muchas peticiones en
 *  paralelo no pueden pasar del límite. Si acierta, se borra el conteo. */
async function revisarPinCb(request, nid, tel, pin) {
  const ahoraMs = Date.now();
  const intentos = negRefCb(nid).collection(COL_CASHBACK_INTENTOS);
  const ipRef = intentos.doc(`ip_${cm.hashSesion(ipDeCb(request))}`);
  const telRef = intentos.doc(`tel_${cm.hashSesion(tel || "sin-telefono")}`);
  const bloqueado = await db.runTransaction(async (tx) => {
    const [i, t] = await Promise.all([tx.get(ipRef), tx.get(telRef)]);
    const ip = i.exists ? i.data() : null;
    const te = t.exists ? t.data() : null;
    if (cm.ipBloqueada(ip, ahoraMs) || cm.bloqueado(te, ahoraMs)) return true;
    tx.set(ipRef, cm.ipTrasFallo(ip, ahoraMs));
    tx.set(telRef, cm.trasFallo(te, ahoraMs));
    return false;
  });
  if (bloqueado) {
    logger.warn("cashbackMayoreo_pin_bloqueado", {tel4: tel ? tel.slice(-4) : null});
    throw new HttpsError("resource-exhausted",
        "Demasiados intentos. Espera un rato y vuelve a intentar, o acude a la tienda.");
  }
  const pepper = CASHBACK_PIN_PEPPER.value();
  let ok = false;
  if (tel && /^\d{4}$/.test(String(pin))) {
    const acc = await accesoRefCb(nid, tel).get();
    if (acc.exists) ok = cm.pinCoincide(pepper, acc.get("sal"), String(pin), acc.get("pinHash"));
    else cm.hashPin(pepper, "0".repeat(32), String(pin)); // el mismo trabajo, exista o no
  }
  if (!ok) return false;
  await telRef.delete();
  // El acierto no cuenta como fallo de esa IP.
  await db.runTransaction(async (tx) => {
    const i = await tx.get(ipRef);
    if (i.exists && (i.get("fallos") || 0) > 0) tx.update(ipRef, {fallos: i.get("fallos") - 1});
  }).catch(() => {});
  return true;
}

async function nuevaSesionCb(nid, tel, gen) {
  const token = cm.generarSesion();
  const venceMs = Date.now() + cm.SESION_MS;
  await negRefCb(nid).collection(COL_CASHBACK_SESIONES).doc(cm.hashSesion(token)).set({
    telefono: tel, gen, venceMs, creadoISO: isoCb(Date.now()),
  });
  return {sesion: token, venceMs};
}

/** Entrar con teléfono y PIN. El error no dice si el teléfono existe. */
exports.entrarCashbackCliente = onCall(OPC_CB_CLIENTE_PIN, async (request) => {
  const d = request.data || {};
  const nid = negocioPublicoCb(d.negocioId);
  const tel = cm.normalizarTelefono(d.telefono);
  const ok = await revisarPinCb(request, nid, tel, d.pin);
  if (!ok) throw new HttpsError("permission-denied", "Teléfono o PIN incorrectos");
  const cs = await cuentaRefCb(nid, tel).get();
  if (!cs.exists) throw new HttpsError("permission-denied", "Teléfono o PIN incorrectos");
  return nuevaSesionCb(nid, tel, cs.get("gen") || 0);
});

/** Saldo, vencimiento e ingresos (solo lo ganado) de la cuenta. */
exports.estadoCashbackCliente = onCall(OPC_CB_CLIENTE, async (request) => {
  const {nid, tel} = await sesionClienteCb(request.data);
  const ahoraMs = Date.now();
  const cuenta = await db.runTransaction(async (tx) => {
    const [s, pend] = await Promise.all([tx.get(cuentaRefCb(nid, tel)), tx.get(usosPendientesCb(nid, tel))]);
    if (!s.exists) return null;
    return cuentaAlDiaEnTx(tx, nid, tel, s.data(), pend, ahoraMs);
  });
  if (!cuenta) throw new HttpsError("unauthenticated", "Tu sesión terminó. Vuelve a entrar.");
  const [cfgS, movs] = await Promise.all([
    configRefCb(nid).get(),
    cuentaRefCb(nid, tel).collection("movimientos").orderBy("fechaISO", "desc").limit(60).get(),
  ]);
  const ingresos = movs.docs.map((m) => m.data())
      .filter((m) => m.tipo === "ganado" && m.centavos > 0)
      .slice(0, 30)
      .map((m) => ({fechaISO: m.fechaISO, centavos: m.centavos}));
  const cfg = cfgS.exists ? cfgS.data() : null;
  return {
    nombre: cuenta.nombre || "",
    telefono4: tel.slice(-4),
    saldoCentavos: cm.saldoVigente(cuenta, ahoraMs),
    venceISO: cuenta.venceISO || null,
    ultimaCompraISO: cuenta.ultimaCompraISO || null,
    tarjetaUltimos4: cuenta.tarjeta ? String(cuenta.tarjeta).slice(-4) : null,
    ingresos,
    config: cfg ? {pct: cfg.pct, vigencia: cfg.vigencia, activo: cfg.activo === true} : null,
  };
});

/** Cambiar el PIN (pide el actual). Cierra las demás sesiones. */
exports.cambiarPinCashbackCliente = onCall(OPC_CB_CLIENTE_PIN, async (request) => {
  const d = request.data || {};
  const {nid, ref, tel} = await sesionClienteCb(d);
  const nuevo = String(d.pinNuevo || "");
  if (cm.pinTrivial(nuevo, tel)) {
    throw new HttpsError("invalid-argument",
        "Elige 4 dígitos difíciles de adivinar: nada de 1234, 0000, años ni los últimos 4 de tu teléfono");
  }
  const ok = await revisarPinCb(request, nid, tel, d.pinActual);
  if (!ok) throw new HttpsError("permission-denied", "El PIN actual no es correcto");
  const sal = cm.generarSal();
  const ahora = isoCb(Date.now());
  const gen = await db.runTransaction(async (tx) => {
    const cuentaRef = cuentaRefCb(nid, tel);
    const cs = await tx.get(cuentaRef);
    const g = (cs.get("gen") || 0) + 1;
    tx.update(accesoRefCb(nid, tel), {
      sal, pinHash: cm.hashPin(CASHBACK_PIN_PEPPER.value(), sal, nuevo), actualizadoISO: ahora,
    });
    tx.update(cuentaRef, {gen: g, pinCambiadoISO: ahora});
    tx.delete(ref);
    return g;
  });
  return nuevaSesionCb(nid, tel, gen);
});

/** El QR de la cuenta; con `nuevo: true` lo cambia y el anterior deja de servir. */
exports.qrCashbackCliente = onCall(OPC_CB_CLIENTE, async (request) => {
  const d = request.data || {};
  const {nid, tel} = await sesionClienteCb(d);
  const qrCol = negRefCb(nid).collection(COL_QR_MAYOREO);
  if (d.nuevo !== true) {
    const a = await accesoRefCb(nid, tel).get();
    return {qr: a.get("qr") || null};
  }
  const nuevo = cm.generarTokenQr();
  await db.runTransaction(async (tx) => {
    const accRef = accesoRefCb(nid, tel);
    const a = await tx.get(accRef);
    const viejo = a.get("qr");
    if (viejo) tx.delete(qrCol.doc(viejo));
    tx.create(qrCol.doc(nuevo), {telefono: tel, creadoISO: isoCb(Date.now())});
    tx.update(accRef, {qr: nuevo, qrCambiadoISO: isoCb(Date.now())});
  });
  return {qr: nuevo};
});

exports.salirCashbackCliente = onCall(OPC_CB_CLIENTE, async (request) => {
  const d = request.data || {};
  const nid = negocioPublicoCb(d.negocioId);
  if (typeof d.sesion === "string" && d.sesion.length >= 20 && d.sesion.length <= 100) {
    await negRefCb(nid).collection(COL_CASHBACK_SESIONES).doc(cm.hashSesion(d.sesion)).delete();
  }
  return {ok: true};
});

// ---------- Admin ----------

/** Ajuste manual del saldo (con motivo). El saldo nunca baja de 0. */
exports.ajustarCashbackMayoreo = onCall(OPC_CB, async (request) => {
  const d = request.data || {};
  const t = requireAdminOrSuper(request.auth, d.negocioId);
  const nid = d.negocioId;
  const tel = cm.normalizarTelefono(d.telefono);
  const centavos = Number(d.centavos);
  const motivo = typeof d.motivo === "string" ? d.motivo.trim().slice(0, 200) : "";
  if (!tel) throw new HttpsError("invalid-argument", "Teléfono inválido");
  if (!Number.isInteger(centavos) || centavos === 0 || Math.abs(centavos) > 100000000) {
    throw new HttpsError("invalid-argument", "Monto inválido");
  }
  if (motivo.length < 3) throw new HttpsError("invalid-argument", "Escribe el motivo del ajuste");
  const ahoraMs = Date.now();
  return db.runTransaction(async (tx) => {
    const cuentaRef = cuentaRefCb(nid, tel);
    const [cs, cfgS] = await Promise.all([tx.get(cuentaRef), tx.get(configRefCb(nid))]);
    if (!cs.exists) throw new HttpsError("not-found", "No hay cuenta con ese teléfono");
    const cuenta = vencerCuentaEnTx(tx, nid, tel, cs.data(), ahoraMs);
    const saldo = cm.saldoVigente(cuenta, ahoraMs);
    const despues = Math.max(0, saldo + centavos);
    const cambio = despues - saldo;
    tx.set(movRefCb(nid, tel, `aju_${ahoraMs}_${cm.generarSal().slice(0, 6)}`), {
      tipo: "ajuste", centavos: cambio, saldoDespuesCentavos: despues, motivo,
      por: t.email || request.auth.uid, fechaISO: isoCb(ahoraMs),
    });
    const upd = {saldoCentavos: despues};
    // Un saldo agregado a mano también vence (vigencia actual, y el 1 de enero).
    if (cambio > 0) {
      const cfg = cfgS.exists ? cfgS.data() : null;
      const vence = cfg && !cm.validarConfig(cfg) ?
        cm.calcularVence(ahoraMs, cfg.vigencia) : cm.inicioAnioSiguienteMX(ahoraMs);
      upd.venceISO = isoCb(Math.max(vence, Date.parse(cuenta.venceISO || "") || 0));
    }
    tx.update(cuentaRef, upd);
    return {saldoCentavos: despues, cambioCentavos: cambio};
  });
});

/** Quita la tarjeta ligada a la cuenta (p. ej. si se perdió). */
exports.quitarTarjetaCashbackMayoreo = onCall(OPC_CB, async (request) => {
  const d = request.data || {};
  requireAdminOrSuper(request.auth, d.negocioId);
  const nid = d.negocioId;
  const tel = cm.normalizarTelefono(d.telefono);
  if (!tel) throw new HttpsError("invalid-argument", "Teléfono inválido");
  await db.runTransaction(async (tx) => {
    const cuentaRef = cuentaRefCb(nid, tel);
    const cs = await tx.get(cuentaRef);
    if (!cs.exists) throw new HttpsError("not-found", "No hay cuenta con ese teléfono");
    const tarjeta = cs.get("tarjeta");
    if (!tarjeta) return;
    tx.delete(negRefCb(nid).collection(COL_TARJETAS_MAYOREO).doc(tarjeta));
    tx.update(cuentaRef, {tarjeta: FieldValue.delete()});
  });
  return {ok: true};
});
