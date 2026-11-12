import {
  collection,
  doc,
  getDocs,
  getDocsFromServer,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import {
  SinConexion,
  conLimite,
  esFallaDeRed,
  guardadoEnLaTablet,
  hayRed,
} from "@/lib/sinInternet";
import {
  paths,
  COL_NEGOCIOS,
  COL_DATOS,
  DOC_VENTAS_AC,
  fechaISO_MX,
  parseFechaFlexible,
  ymdMX,
  ymdPaddedMX,
  generarID,
  type Corte,
  type Venta,
} from "@shared";

/**
 * Los totales del corte salen de las ventas del SERVIDOR: sin internet la
 * tablet puede no tener todas las ventas del día (las que se guardaron con
 * red no siempre quedan en su caché) y el corte saldría con totales de menos.
 */
const SIN_INTERNET_FINALIZAR =
  "Sin internet no se puede cerrar el corte: los totales salen de las ventas del servidor. Inténtalo cuando vuelva la conexión.";

export type IniciarCorteInput = {
  negocioId: string;
  sucursalId: string;
  nodoId: string;
  usuarioCreador: string;
  nombre_corte: string;
  /** Fondo inicial de caja (efectivo). Default "0". Se reporta APARTE de
   *  los totales de ventas; NO se incluye en totalEfectivo ni totalGeneral. */
  fondoInicial?: string;
};

export async function iniciarCorte(input: IniciarCorteInput): Promise<Corte> {
  const {
    negocioId,
    sucursalId,
    nodoId,
    usuarioCreador,
    nombre_corte,
    fondoInicial,
  } = input;
  // Sanitizar fondo: vacío o no-numérico o negativo → "0".
  const fondoSan = (() => {
    const raw = (fondoInicial ?? "").trim();
    if (!raw) return "0";
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? String(n) : "0";
  })();
  const now = new Date();
  const { y, m, d } = ymdMX(now);
  const ymd = ymdPaddedMX(now);
  const corteId = "c_" + generarID();

  const contadorRef = doc(db, paths.contadorDia(negocioId, sucursalId, ymd));
  const corteRef = doc(
    db,
    `${paths.corteDia(negocioId, sucursalId, y, m, d)}/items/${corteId}`,
  );

  const corte: Corte = {
    corteId,
    estado: "corte_enCurso",
    idVenta_corte: "",
    nombre_corte,
    fecha_inicio: fechaISO_MX(now),
    totalEfectivo: "0",
    totalTransferencia: "0",
    totalTarjeta: "0",
    totalGeneral: "0",
    fondoInicial: fondoSan,
    negocioId,
    nodoId,
    sucursalId,
    usuarioCreador,
  };

  let enLinea = hayRed();
  if (enLinea) {
    try {
      await conLimite((ctl) =>
        runTransaction(db, async (tx) => {
          ctl.siAbandonada();
          const snap = await tx.get(contadorRef);
          const prev = snap.exists()
            ? (snap.data().ultimoNumeroCorte as number | undefined) ?? -1
            : -1;
          ctl.vaAEscribir();
          tx.set(corteRef, corte);
          tx.set(
            contadorRef,
            { ultimoNumeroCorte: prev + 1, actualizado: serverTimestamp() },
            { merge: true },
          );
        }),
      );
    } catch (e) {
      if (!esFallaDeRed(e)) throw e;
      enLinea = false;
    }
  }
  if (!enLinea) {
    // Sin internet el corte se guarda en la tablet y se sube solo al volver
    // la red. Sin el contador `ultimoNumeroCorte`, que nada lee; el corte es
    // el mismo doc que habría escrito la transacción, así que si esa alcanzó
    // a guardarse, esto solo lo vuelve a escribir igual.
    await guardadoEnLaTablet(setDoc(corteRef, corte), corteRef, "Corte iniciado sin internet");
  }
  return corte;
}

/**
 * FIX B1: calcula totales del corte consultando directo la subcolección
 * `items` del día actual (path fijo), filtrando por `nodoId` en Firestore y
 * filtrando fecha_inicio client-side. Evita collectionGroup (que leería
 * docs de otros negocios y rompería por rules) y evita la incompatibilidad
 * de formatos `fechaISO` (Date ISO 8601) vs `fecha_inicio` (YYYY-MM-DD HH:mm:ss).
 */
async function calcularTotales(
  negocioId: string,
  sucursalId: string,
  nodoId: string,
  fechaInicioLegacy: string,
  y: string,
  m: string,
  d: string,
): Promise<Omit<Corte, "corteId" | "estado" | "nombre_corte" | "fecha_inicio" | "nodoId" | "sucursalId" | "usuarioCreador" | "fecha_fin" | "idVenta_corte">> {
  const itemsRef = collection(
    db,
    `${paths.ventaDia(negocioId, sucursalId, y, m, d)}/items`,
  );
  const q = query(itemsRef, where("nodoId", "==", nodoId));
  // Del servidor, no del caché: sin internet `getDocs` devolvería solo las
  // ventas que la tablet tenga guardadas, y los totales saldrían de menos.
  const snap = await getDocsFromServer(q);

  const fechaInicio = parseFechaFlexible(fechaInicioLegacy);

  let totalEfectivo = 0;
  let totalTransferencia = 0;
  let totalTarjeta = 0;
  let totalGeneral = 0;

  snap.forEach((docSnap) => {
    const v = docSnap.data() as Venta;
    if (!Array.isArray(v.articulos)) return;
    if (fechaInicio) {
      const fVenta = parseFechaFlexible(v.fechaISO) ?? parseFechaFlexible(v.fecha);
      if (fVenta && fVenta < fechaInicio) return;
    }

    const monto = Number(v.montoCobro) || 0;
    totalGeneral += monto;

    if (v.movimiento === "pagoEfectivo") totalEfectivo += monto;
    else if (v.movimiento === "pagoTransferencia") totalTransferencia += monto;
    else if (v.movimiento === "pagoTarjeta") totalTarjeta += monto;
    else if (v.movimiento === "pagoDividido" && v.datosPagoDividido) {
      const dd = v.datosPagoDividido as Record<string, string>;
      totalEfectivo += Number(dd.efectivo) || 0;
      totalTransferencia += Number(dd.transferencia) || 0;
      totalTarjeta += Number(dd.tarjeta) || 0;
    }
  });

  return {
    totalEfectivo: totalEfectivo.toFixed(0),
    totalTransferencia: totalTransferencia.toFixed(0),
    totalTarjeta: totalTarjeta.toFixed(0),
    totalGeneral: totalGeneral.toFixed(0),
  };
}

export type FinalizarCorteInput = {
  negocioId: string;
  sucursalId: string;
  corte: Corte;
  y: string;
  m: string;
  d: string;
  idVenta_corte?: string;
};

export async function finalizarCorte(input: FinalizarCorteInput): Promise<Corte> {
  const { negocioId, sucursalId, corte, y, m, d } = input;
  if (!hayRed()) throw new SinConexion(SIN_INTERNET_FINALIZAR);
  let totales: Awaited<ReturnType<typeof calcularTotales>>;
  try {
    // Límite amplio: cerrar el corte no tiene prisa, y con muchas ventas o
    // red lenta la consulta tarda más que una transacción.
    totales = await conLimite(
      () => calcularTotales(negocioId, sucursalId, corte.nodoId, corte.fecha_inicio, y, m, d),
      { limiteMs: 15_000 },
    );
  } catch (e) {
    if (esFallaDeRed(e)) throw new SinConexion(SIN_INTERNET_FINALIZAR);
    throw e;
  }

  const corteRef = doc(
    db,
    `${paths.corteDia(negocioId, sucursalId, y, m, d)}/items/${corte.corteId}`,
  );

  // Los totales ya están: se espera solo a que el cierre quede en la tablet
  // (si la red se cae justo aquí, se sube solo al volver).
  const fecha_fin = fechaISO_MX(new Date());
  await guardadoEnLaTablet(
    updateDoc(corteRef, {
      estado: "corte_finalizado",
      fecha_fin,
      idVenta_corte: input.idVenta_corte ?? "",
      ...totales,
    }),
    corteRef,
    "Cierre de corte",
  );

  // Actualizar huella_venta para que otros clientes se enteren del cambio.
  // Best-effort y sin esperar.
  try {
    const huellaRef = doc(
      db,
      `${COL_NEGOCIOS}/${negocioId}/${COL_DATOS}/${DOC_VENTAS_AC}`,
    );
    void setDoc(huellaRef, { huella_venta: generarID() }, { merge: true }).catch((e) =>
      console.warn("No se pudo actualizar huella_venta tras corte:", e),
    );
  } catch (e) {
    console.warn("No se pudo actualizar huella_venta tras corte:", e);
  }

  return {
    ...corte,
    estado: "corte_finalizado",
    fecha_fin,
    ...totales,
  };
}

/**
 * Busca el corte en curso del nodo en el día de hoy.
 */
export async function buscarCorteActivo(
  negocioId: string,
  sucursalId: string,
  nodoId: string,
): Promise<{ corte: Corte; y: string; m: string; d: string } | null> {
  const { y, m, d } = ymdMX();
  const itemsRef = collection(
    db,
    `${paths.corteDia(negocioId, sucursalId, y, m, d)}/items`,
  );
  const q = query(
    itemsRef,
    where("nodoId", "==", nodoId),
    where("estado", "==", "corte_enCurso"),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const doc0 = snap.docs[0];
  return { corte: doc0.data() as Corte, y, m, d };
}

/** Marker — evita tree-shaking agresivo si se importa desde tests. */
export const __cortesInternals = {
  calcularTotales,
};
