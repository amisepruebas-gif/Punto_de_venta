import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "@/firebase/config";
import { cargarSucursalesIds } from "@/features/sucursal/ubicacionStock";
import { enviarMensajeTexto } from "@/features/chat-grupo/chatGrupoService";
import { enLineaOAvisar, guardadoEnLaTablet } from "@/lib/sinInternet";
import {
  COL_DATOS,
  DOC_ARTICULOS_AC,
  URL_MERCANCIA_PRODUCCION,
  contenidoDePaquete,
  esLote,
  esSucursalDefault,
  generarID,
  generarSecretoEnlace,
  hashSecretoEnlace,
  partirClaveArticulo,
  paths,
  planearRecepcionLote,
  resumenLote,
  textoAvisoRecepcion,
  urlEnlaceLote,
  type Articulo,
  type ConteoLote,
  type LoteSesion,
  type Negocio,
  type Resurtido,
  type ResurtidoEstado,
  type ResumenLote,
  type Sucursal,
  type UbicacionResuelta,
} from "@shared";

// ============================================================
// Recepción de lotes de envío (caja)
// ============================================================
//
// La caja escanea libre y al "Terminar" guarda UNA sesión en
// `recepcion.sesiones.<id>`. El plan (qué entra al inventario, qué sobra,
// estado nuevo) lo calcula `planearRecepcionLote` de `@shared` contra el lote
// LEÍDO EN LA TRANSACCIÓN: dos tablets o un reintento no suman dos veces.
// Las reglas solo dejan a la caja tocar `estado`, `recepcion`,
// `fechaRecibido`, `fechaCerrado` y `responsableRecibe`.

/** Datos de la sesión que quedan fijos al sellarla en la tablet. */
export type MetaSesionLote = {
  /** `YYYY-MM-DD HH:mm:ss` MX del "Terminar" (no de la subida). */
  fecha: string;
  /** Nombre de quien recibe (obligatorio). */
  quien: string;
  nodoId: string;
  /** Vendedor en turno al terminar. */
  vendedor?: string;
  nota?: string;
  /** Sucursal de mayoreo: lo recibido entra a la bodega de la tienda en vez
   *  de a la tienda. Ausente = tienda (lo de siempre). */
  destino?: "bodega";
};

export type ResultadoSubidaLote = {
  /** La sesión guardada (o la que ya estaba). Con `vacia`, la planeada
   *  que NO se escribió. */
  sesion: LoteSesion;
  estado: ResurtidoEstado;
  /** La sesión ya estaba en el servidor (un reintento tras perder la
   *  respuesta): no se escribió nada. */
  yaEstaba: boolean;
  /** El conteo no traía nada nuevo: no se escribió nada. */
  vacia: boolean;
  /** Resumen del lote ya con la sesión. */
  despues: ResumenLote;
};

const SIN_INTERNET_RECEPCION =
  "Sin internet no se puede guardar la recepción: el inventario se suma en el servidor. Queda pendiente y se sube sola al volver la conexión.";

/** Ids de los artículos cuyo inventario puede mover el conteo: lo contado
 *  pieza por pieza y el contenido de los paquetes cerrados. Lo dañado no
 *  entra al inventario, así que no hace falta leerlo. */
function articulosDelConteo(
  conteo: ConteoLote,
  paquetes: Resurtido["paquetes"],
): string[] {
  const ids = new Set<string>();
  for (const clave of Object.keys(conteo.piezas)) {
    ids.add(partirClaveArticulo(clave).articuloId);
  }
  for (const llave of Object.keys(conteo.paquetes)) {
    const p = paquetes?.[llave];
    if (!p) continue;
    for (const clave of contenidoDePaquete(p).keys()) {
      ids.add(partirClaveArticulo(clave).articuloId);
    }
  }
  return [...ids];
}

/**
 * Sube una sesión sellada en la tablet. Es idempotente por `sesionId`: si
 * ya está en el servidor no escribe nada y contesta `yaEstaba`. Lanza
 * `SinConexion` si no hay red o el servidor no contesta (la sesión sigue en
 * la tablet y se reintenta); cualquier otro error (permisos, lote borrado…)
 * es definitivo. Un lote que admin cerró mientras tanto ("no llegó") sí la
 * acepta: lo contado que se había marcado como no llegado entra.
 */
export async function subirSesionLote(args: {
  negocioId: string;
  loteId: string;
  sesionId: string;
  conteo: ConteoLote;
  meta: MetaSesionLote;
}): Promise<ResultadoSubidaLote> {
  const { negocioId, loteId, sesionId, conteo, meta } = args;
  // Cada artículo es una lectura y una escritura en la transacción: un lote
  // grande con red lenta necesita más que el límite normal. Aquí aún no se
  // tiene el lote (qué trae cada paquete): se cuenta un artículo por
  // renglón contado y por paquete (casi siempre traen un solo artículo).
  const nArticulos =
    Object.keys(conteo.piezas).length + Object.keys(conteo.paquetes).length;
  const loteRef = doc(db, paths.resurtido(negocioId, loteId));

  const r = await enLineaOAvisar(
    SIN_INTERNET_RECEPCION,
    async (ctl) => {
      // Fuera de la transacción: las tx del SDK web no leen colecciones.
      const sucursalesIds = await cargarSucursalesIds(negocioId);
      ctl.siAbandonada();
      return runTransaction(db, async (tx) => {
        ctl.siAbandonada();
        const snap = await tx.get(loteRef);
        if (!snap.exists()) throw new Error("El lote ya no existe");
        const lote = snap.data() as Resurtido;
        if (!esLote(lote)) throw new Error("Este resurtido no es un lote");

        // Reintento tras perder la respuesta: ya quedó, no se duplica.
        const previa = lote.recepcion?.sesiones?.[sesionId];
        if (previa) {
          return {
            lote,
            sesion: previa,
            estado: lote.estado,
            yaEstaba: true,
            vacia: false,
            despues: resumenLote(lote),
          };
        }

        const negocioSnap = await tx.get(doc(db, paths.negocio(negocioId)));
        const negocio = negocioSnap.exists() ? (negocioSnap.data() as Negocio) : null;
        // A la bodega de la tienda solo en sucursales de mayoreo (se revisa
        // contra el doc de la sucursal, no contra lo que diga la tablet).
        let aBodega = false;
        if (meta.destino === "bodega") {
          const sucSnap = await tx.get(
            doc(db, paths.sucursal(negocioId, lote.sucursalDestinoId)),
          );
          aBodega = sucSnap.exists() && (sucSnap.data() as Sucursal).modoMayoreo === true;
        }
        const ubicacion: UbicacionResuelta = aBodega
          ? { tipo: "bodegaSucursal", sucursalId: lote.sucursalDestinoId }
          : {
              tipo: "sucursal",
              sucursalId: lote.sucursalDestinoId,
              esDefault: esSucursalDefault(
                lote.sucursalDestinoId,
                negocio?.sucursalDefaultId,
                sucursalesIds[0],
              ),
            };

        const ids = articulosDelConteo(conteo, lote.paquetes);
        const snaps = await Promise.all(
          ids.map((id) => tx.get(doc(db, paths.articulo(negocioId, id)))),
        );
        // Un artículo borrado no se agrega: el plan lo deja en `sinStock`.
        const articulos = new Map<string, Articulo>();
        snaps.forEach((s, i) => {
          if (s.exists()) articulos.set(ids[i]!, s.data() as Articulo);
        });

        const plan = planearRecepcionLote({ lote, conteo, articulos, ubicacion, meta });
        if (plan.vacia) {
          return {
            lote,
            sesion: plan.sesion,
            estado: lote.estado,
            yaEstaba: false,
            vacia: true,
            despues: resumenLote(lote),
          };
        }

        ctl.vaAEscribir();
        for (const [id, parche] of plan.parches) {
          tx.update(doc(db, paths.articulo(negocioId, id)), parche as Record<string, unknown>);
        }
        tx.update(loteRef, {
          estado: plan.estado,
          ["recepcion.sesiones." + sesionId]: plan.sesion,
          responsableRecibe: meta.quien.trim(),
          ...(lote.fechaRecibido ? {} : { fechaRecibido: meta.fecha }),
          // Lo que aparece en un lote ya cerrado no le cambia la fecha de cierre.
          ...(plan.estado === "cerrado" && lote.estado !== "cerrado"
            ? { fechaCerrado: meta.fecha }
            : {}),
        });
        const despues = resumenLote({
          ...lote,
          recepcion: {
            sesiones: { ...(lote.recepcion?.sesiones ?? {}), [sesionId]: plan.sesion },
          },
        });
        return {
          lote,
          sesion: plan.sesion,
          estado: plan.estado as ResurtidoEstado,
          yaEstaba: false,
          vacia: false,
          despues,
        };
      });
    },
    { limiteMs: Math.min(60_000, 15_000 + 300 * nArticulos) },
  );

  if (!r.yaEstaba && !r.vacia) {
    // Huella best-effort y sin esperar (como `cerrarResurtido`): avisa a las
    // demás cajas que cambió el inventario.
    void setDoc(
      doc(db, `${paths.negocio(negocioId)}/${COL_DATOS}/${DOC_ARTICULOS_AC}`),
      { huella: generarID() },
      { merge: true },
    ).catch((e) => console.warn("No se pudo marcar huella:", e));
    avisarRecepcion(negocioId, meta, r.lote, r.sesion, r.despues);
  }

  const { lote: _lote, ...resultado } = r;
  return resultado;
}

/** Aviso al chat del nodo (lo ven los admins). Sin esperar: un fallo del
 *  aviso no toca la recepción, que ya quedó guardada. */
function avisarRecepcion(
  negocioId: string,
  meta: MetaSesionLote,
  lote: Resurtido,
  sesion: LoteSesion,
  despues: ResumenLote,
) {
  let texto: string;
  try {
    // `lote` es como estaba antes de esta sesión.
    texto = textoAvisoRecepcion(lote, sesion, despues, resumenLote(lote));
  } catch (e) {
    console.warn("Aviso de recepción:", e);
    return;
  }
  void enviarMensajeTexto({
    negocioId,
    nodoId: meta.nodoId,
    remitenteId: meta.nodoId,
    remitenteTipo: "nodo",
    remitenteNombre: meta.vendedor?.trim() || "Nodo",
    texto,
  }).catch((e) => console.warn("No se pudo mandar el aviso de recepción:", e));
}

// ============================================================
// Fotos con teléfono (enlace `recibir`)
// ============================================================

/** Origen de mercancia-web (ahí vive la pantalla del teléfono). `||` y no
 *  `??`: una variable vacía en el `.env` dejaría la URL sin dominio. */
const BASE_MERCANCIA =
  (import.meta.env.VITE_URL_MERCANCIA as string | undefined) || URL_MERCANCIA_PRODUCCION;

/**
 * Crea un acceso de fotos para un lote y devuelve la URL para el QR. Solo en
 * línea y esperando al servidor: la URL no se muestra si el acceso no quedó
 * guardado (no serviría). Del secreto solo se guarda su sha256; el secreto
 * viaja únicamente en la URL.
 */
export async function crearEnlaceFotos(
  negocioId: string,
  loteId: string,
  sucursalId: string,
): Promise<{ enlaceId: string; url: string }> {
  return enLineaOAvisar(
    "Sin internet no se puede crear el código para fotos.",
    async (ctl) => {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error("La caja no tiene sesión. Cierra y vuelve a abrir la app.");
      const secreto = generarSecretoEnlace();
      const secretoHash = await hashSecretoEnlace(secreto);
      const ref = doc(collection(db, paths.enlacesLoteCol(negocioId)));
      ctl.siAbandonada();
      // Campos y valores EXACTOS: las reglas rechazan cualquier otro.
      await setDoc(ref, {
        tipo: "recibir",
        activo: true,
        gen: 0,
        secretoHash,
        creadoPor: uid,
        creadoEn: serverTimestamp(),
        sucursalId,
        resurtidoId: loteId,
      });
      return { enlaceId: ref.id, url: urlEnlaceLote(BASE_MERCANCIA, negocioId, ref.id, secreto) };
    },
    // Un límite explícito: tras un fallo reciente el normal es de 2 s.
    { limiteMs: 15_000 },
  );
}

/**
 * Apaga un acceso de fotos (lo único que la caja puede cambiar). Solo espera
 * a que quede en la tablet: sin red el SDK lo sube solo al volver.
 */
export async function apagarEnlaceFotos(negocioId: string, enlaceId: string): Promise<void> {
  const ref = doc(db, paths.enlaceLote(negocioId, enlaceId));
  await guardadoEnLaTablet(updateDoc(ref, { activo: false }), ref, "Cerrar acceso de fotos");
}
