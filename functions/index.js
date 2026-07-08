// ============================================================
// Cloud Functions v2 — amise-web (admin + nodo)
// ============================================================
// Namespace nuevo: _web_new_version
// Rol "nodo" introducido para tablets; claims incluyen sucursalId + nodoId.
// Migrado a Functions v2 (firebase-functions/v2/*) — gen2 ready.
// ============================================================

const {onCall, onRequest, HttpsError} = require("firebase-functions/v2/https");
const {onDocumentCreated} = require("firebase-functions/v2/firestore");
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
const ROLES_PUNTOS = ["nodo", "vendedor", "admin", "superadmin"];
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");

admin.initializeApp();
const db = admin.firestore();

const SUFFIX = "_web_new_version";
const COL_NEGOCIOS = `negocios${SUFFIX}`;
const COL_SUCURSALES = `sucursales${SUFFIX}`;
const COL_NODOS = `nodos${SUFFIX}`;

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

  const ref = db.collection(COL_NEGOCIOS).doc(negocioId)
      .collection(COL_SUCURSALES).doc();
  const sucursalId = ref.id;

  await ref.set({
    sucursalId,
    nombre,
    direccion,
    telefono: telefono || "",
    fechaCreacion: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: request.auth.uid,
    activa: true,
  });

  return {success: true, sucursalId};
});

// ============================================================
// registrarNodo — first-run del nodo (público).
// Crea usuario Anonymous + claims + doc del nodo. Puede crear sucursal.
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

  // Trackeamos lo creado para rollback en caso de error
  let createdSucursalRef = null;
  let createdAuthUid = null;
  let createdNodoRef = null;
  let createdChatGrupoRef = null;

  try {
    // Resolver sucursal
    let sucursalId = sucursalIdExistente;
    if (!sucursalId && nuevaSucursal) {
      const sucRef = negocioRef.collection(COL_SUCURSALES).doc();
      sucursalId = sucRef.id;
      await sucRef.set({
        sucursalId,
        nombre: nuevaSucursal.nombre,
        direccion: nuevaSucursal.direccion,
        telefono: nuevaSucursal.telefono || "",
        fechaCreacion: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: "first-run",
        activa: true,
      });
      createdSucursalRef = sucRef;
    } else {
      const sucSnap = await negocioRef.collection(COL_SUCURSALES)
          .doc(sucursalId).get();
      if (!sucSnap.exists) {
        throw new HttpsError("not-found", "Sucursal no existe");
      }
    }

    // Crear usuario Anonymous + claims
    const authUser = await admin.auth().createUser({});
    createdAuthUid = authUser.uid;
    const nodoId = authUser.uid;
    await admin.auth().setCustomUserClaims(authUser.uid, {
      role: "nodo", negocioId, sucursalId, nodoId,
    });

    // Crear doc del nodo
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
      historial: [{
        tipo: "registro",
        fecha: new Date().toISOString(),
        userAgent: userAgent || "",
        detalle: registradoPor,
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

    return {success: true, nodoId, sucursalId, negocioId, customToken};
  } catch (err) {
    // Rollback en orden inverso. Best-effort.
    console.error("registrarNodo failed, rolling back:", err.message);
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
  const {negocioId, nodoId, userAgent, registradoPor} = request.data;
  if (!negocioId || !nodoId) {
    throw new HttpsError(
        "invalid-argument", "Se requiere negocioId y nodoId");
  }

  const nodoRef = db.collection(COL_NEGOCIOS).doc(negocioId)
      .collection(COL_NODOS).doc(nodoId);
  const nodoSnap = await nodoRef.get();
  if (!nodoSnap.exists) {
    throw new HttpsError("not-found", "Nodo no existe");
  }
  const nodo = nodoSnap.data();
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
  });

  await nodoRef.update({
    authUid: authUser.uid,
    ultimoAcceso: admin.firestore.FieldValue.serverTimestamp(),
    userAgent: userAgent || nodo.userAgent || "",
    historial,
  });

  const customToken = await admin.auth().createCustomToken(authUser.uid, {
    role: "nodo", negocioId, sucursalId, nodoId,
  });

  return {success: true, nodoId, sucursalId, negocioId, customToken};
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
// Si numeroDeVenta empieza con "OFFLINE-", asigna número real via transacción.
// ============================================================
exports.reconciliarVentasOffline = onDocumentCreated(
    {
      document: "negocios_web_new_version/{negocioId}/" +
        "sucursales_data_web_new_version/{sucursalId}/" +
        "ventas_n_web_new_version/{year}/{month}/{day}/items/{ventaId}",
    },
    async (event) => {
      const snap = event.data;
      if (!snap) return;
      const venta = snap.data();
      if (typeof venta.numeroDeVenta !== "string") return;
      if (!venta.numeroDeVenta.startsWith("OFFLINE-")) return;

      const {negocioId, sucursalId, year, month, day} = event.params;
      const ymd = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

      const contadorRef = db
          .collection(COL_NEGOCIOS).doc(negocioId)
          .collection("sucursales_data_web_new_version").doc(sucursalId)
          .collection("contadores_web_new_version").doc(ymd);

      try {
        await db.runTransaction(async (tx) => {
          // Re-verificar dentro de la transacción que el doc todavía es
          // OFFLINE (idempotencia: si dos disparos del trigger corren para
          // el mismo doc, el segundo ve numeroDeVenta ya cambiado y aborta).
          const ventaActual = await tx.get(snap.ref);
          if (!ventaActual.exists) return;
          const numActual = ventaActual.data().numeroDeVenta;
          if (typeof numActual !== "string" ||
              !numActual.startsWith("OFFLINE-")) {
            return;
          }

          const contadorSnap = await tx.get(contadorRef);
          // FASE 2: arrancar contador en 0 (primera venta real = "1") en
          // vez de -1, paralelo al fix client-side en ventaService.ts.
          const prev = contadorSnap.exists ?
            (contadorSnap.data().ultimoNumeroVenta ?? 0) :
            0;
          const numeroReal = String(prev + 1);
          tx.update(snap.ref, {
            numeroDeVenta: numeroReal,
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
        });
        console.log(`Reconciliada venta OFFLINE ${venta.numeroDeVenta} → real para sucursal ${sucursalId}/${ymd}`);
      } catch (err) {
        console.error("Fallo reconciliando venta offline:", err);
      }
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
// listarSucursales — público (requiere negocioId)
// ============================================================
exports.listarSucursales = onCall(async (request) => {
  const {negocioId} = request.data;
  if (!negocioId) {
    throw new HttpsError("invalid-argument", "Se requiere negocioId");
  }
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
// listarNodos — público. Lista nodos activos para re-bind
// ============================================================
exports.listarNodos = onCall(async (request) => {
  const {negocioId, sucursalId} = request.data;
  if (!negocioId || !sucursalId) {
    throw new HttpsError(
        "invalid-argument", "Se requiere negocioId y sucursalId");
  }
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
      if (t.role !== "superadmin" && t.role !== "admin") {
        throw new HttpsError(
            "permission-denied", "Solo admin/superadmin puede usar Gemini");
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
    throw new HttpsError("unavailable", `No se pudo contactar a amise.mx: ${e.message}`);
  }
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new HttpsError(
        resp.status === 409 ? "already-exists" : "internal",
        (data && data.error) || `amise.mx ${resp.status}`);
  }
  return data;
}

// Pre-registro del cliente de puntos (correo + teléfono + nombre + contraseña
// temporal generada en el POS). Input: { email, phone, nombre?, code }.
exports.registrarClientePuntos = onCall(
    {secrets: [LOYALTY_POS_SECRET], timeoutSeconds: 30, memory: "256MiB"},
    async (request) => {
      // POS sin login fijo (Firestore abierto; la callable llega con auth MISSING):
      // auth best-effort — si viene rol se valida, si no, se procede. La seguridad
      // real es LOYALTY_POS_SECRET server-side hacia amise.mx (hardening: App Check).
      const t = (request.auth && request.auth.token) || {};
      if (t.role && !ROLES_PUNTOS.includes(t.role)) {
        throw new HttpsError("permission-denied", "Sin permiso");
      }
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
      // auth best-effort (POS sin login fijo). Seguridad real: secreto server-side.
      const t = (request.auth && request.auth.token) || {};
      if (t.role && !ROLES_PUNTOS.includes(t.role)) {
        throw new HttpsError("permission-denied", "Sin permiso");
      }
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

// Consulta el saldo de cashback del cliente (por teléfono o correo) al cobrar.
// Input: { email?, phone? } → { exists, saldoDinero, saldoUsable, valorPorPeso }.
exports.consultarSaldoPuntos = onCall(
    {secrets: [LOYALTY_POS_SECRET], timeoutSeconds: 30, memory: "256MiB"},
    async (request) => {
      // auth best-effort (POS sin login fijo). Seguridad real: secreto server-side.
      const t = (request.auth && request.auth.token) || {};
      if (t.role && !ROLES_PUNTOS.includes(t.role)) {
        throw new HttpsError("permission-denied", "Sin permiso");
      }
      const {email, phone, codigo} = request.data || {};
      if (!email && !phone && !codigo) {
        throw new HttpsError("invalid-argument", "email, phone o codigo requerido");
      }
      return await llamarAmise("/api/loyalty/balance", {email, phone, codigo});
    },
);

// Canjea (debita) cashback ($) al cobrar. Idempotente por idempotencyKey (= ventaId).
// Input: { email?|phone?, money, idempotencyKey } → { ok, redeemed, balance, money }.
exports.canjearPuntos = onCall(
    {secrets: [LOYALTY_POS_SECRET], timeoutSeconds: 30, memory: "256MiB"},
    async (request) => {
      // auth best-effort (POS sin login fijo). Seguridad real: secreto server-side.
      const t = (request.auth && request.auth.token) || {};
      if (t.role && !ROLES_PUNTOS.includes(t.role)) {
        throw new HttpsError("permission-denied", "Sin permiso");
      }
      const {email, phone, money, idempotencyKey} = request.data || {};
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
      const data = await llamarAmise("/api/loyalty/redeem", {
        email, phone, money: m, idempotencyKey,
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
      const t = (request.auth && request.auth.token) || {};
      if (t.role && !ROLES_PUNTOS.includes(t.role)) {
        throw new HttpsError("permission-denied", "Sin permiso");
      }
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
// Input: { phone?|email? } → { ok, email, code }.
exports.recuperarCodigoPuntos = onCall(
    {secrets: [LOYALTY_POS_SECRET], timeoutSeconds: 30, memory: "256MiB"},
    async (request) => {
      // auth best-effort (POS sin login fijo). Seguridad real: secreto server-side.
      const t = (request.auth && request.auth.token) || {};
      if (t.role && !ROLES_PUNTOS.includes(t.role)) {
        throw new HttpsError("permission-denied", "Sin permiso");
      }
      const {phone, email} = request.data || {};
      if (!phone && !email) {
        throw new HttpsError("invalid-argument", "phone o email requerido");
      }
      const data = await llamarAmise("/api/loyalty/recover-code", {phone, email});
      return {ok: true, email: data.email || "", code: data.code || ""};
    },
);

// ── Tarjeta física (barcode EAN-13) ──────────────────────────
// Vincula/repone/desbloquea; consultar por barcode va en consultarSaldoPuntos.

// Activar (vincular) una tarjeta física al cobrar. Input: { email?|phone?, codigo, ventaId? }.
exports.activarTarjeta = onCall(
    {secrets: [LOYALTY_POS_SECRET], timeoutSeconds: 30, memory: "256MiB"},
    async (request) => {
      const t = (request.auth && request.auth.token) || {};
      if (t.role && !ROLES_PUNTOS.includes(t.role)) {
        throw new HttpsError("permission-denied", "Sin permiso");
      }
      const {email, phone, codigo, ventaId} = request.data || {};
      if (!email && !phone) {
        throw new HttpsError("invalid-argument", "email o phone requerido");
      }
      if (!codigo || typeof codigo !== "string") {
        throw new HttpsError("invalid-argument", "codigo requerido");
      }
      const data = await llamarAmise("/api/loyalty/card/link", {email, phone, codigo, ventaId});
      return {ok: true, already: Boolean(data.already)};
    },
);

// Reposición (deshabilita la anterior, vincula la nueva). También se cobra.
// Input: { email?|phone?|codigoAnterior, codigoNuevo, ventaId? }.
exports.reponerTarjeta = onCall(
    {secrets: [LOYALTY_POS_SECRET], timeoutSeconds: 30, memory: "256MiB"},
    async (request) => {
      const t = (request.auth && request.auth.token) || {};
      if (t.role && !ROLES_PUNTOS.includes(t.role)) {
        throw new HttpsError("permission-denied", "Sin permiso");
      }
      const {email, phone, codigoAnterior, codigoNuevo, ventaId} = request.data || {};
      if (!email && !phone && !codigoAnterior) {
        throw new HttpsError("invalid-argument", "email, phone o codigoAnterior requerido");
      }
      if (!codigoNuevo || typeof codigoNuevo !== "string") {
        throw new HttpsError("invalid-argument", "codigoNuevo requerido");
      }
      const data = await llamarAmise("/api/loyalty/card/replace", {
        email, phone, codigoAnterior, codigoNuevo, ventaId,
      });
      return {ok: true, already: Boolean(data.already)};
    },
);

// Desbloqueo SOLO en sucursal. Input: { email?|phone?|codigo }.
exports.desbloquearTarjeta = onCall(
    {secrets: [LOYALTY_POS_SECRET], timeoutSeconds: 30, memory: "256MiB"},
    async (request) => {
      const t = (request.auth && request.auth.token) || {};
      if (t.role && !ROLES_PUNTOS.includes(t.role)) {
        throw new HttpsError("permission-denied", "Sin permiso");
      }
      const {email, phone, codigo} = request.data || {};
      if (!email && !phone && !codigo) {
        throw new HttpsError("invalid-argument", "email, phone o codigo requerido");
      }
      await llamarAmise("/api/loyalty/card/unblock", {email, phone, codigo});
      return {ok: true};
    },
);

