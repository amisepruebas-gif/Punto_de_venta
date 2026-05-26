import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/firebase/config";
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

  let numero = 0;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(contadorRef);
    const prev = snap.exists()
      ? (snap.data().ultimoNumeroCorte as number | undefined) ?? -1
      : -1;
    numero = prev + 1;

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

    tx.set(corteRef, corte);
    tx.set(
      contadorRef,
      { ultimoNumeroCorte: numero, actualizado: serverTimestamp() },
      { merge: true },
    );
  });

  return {
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
  const snap = await getDocs(q);

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
  const totales = await calcularTotales(
    negocioId,
    sucursalId,
    corte.nodoId,
    corte.fecha_inicio,
    y,
    m,
    d,
  );

  const corteRef = doc(
    db,
    `${paths.corteDia(negocioId, sucursalId, y, m, d)}/items/${corte.corteId}`,
  );

  const fecha_fin = fechaISO_MX(new Date());
  await updateDoc(corteRef, {
    estado: "corte_finalizado",
    fecha_fin,
    idVenta_corte: input.idVenta_corte ?? "",
    ...totales,
  });

  // Actualizar huella_venta para que otros clientes se enteren del cambio
  try {
    const huellaRef = doc(
      db,
      `${COL_NEGOCIOS}/${negocioId}/${COL_DATOS}/${DOC_VENTAS_AC}`,
    );
    await setDoc(huellaRef, { huella_venta: generarID() }, { merge: true });
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
