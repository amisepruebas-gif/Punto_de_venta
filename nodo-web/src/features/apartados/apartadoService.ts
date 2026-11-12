import {
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import { trackSnapshot } from "@/lib/firestoreStats";
import {
  paths,
  COL_NEGOCIOS,
  COL_DATOS,
  DOC_APARTADOS_AC,
  fechaISO_MX,
  generarID,
  genApartadoId,
  type Apartado,
  type Abono,
  type VentaArticulo,
} from "@shared";
import {
  aplicarStockEnTx,
  leerStockEnTx,
  planearDecremento,
  planearIncremento,
  type ItemStock,
} from "@/features/articulos/stockService";
import { cargarUbicacionStock } from "@/features/sucursal/ubicacionStock";
import {
  SinConexion,
  conLimite,
  esFallaDeRed,
  guardadoEnLaTablet,
  hayRed,
  type ControlLimite,
} from "@/lib/sinInternet";

/**
 * Crear y cancelar un apartado mueven stock en una transacción: sin servidor
 * no se puede, así que se avisa claro y rápido en vez de dejar la pantalla
 * cargando o mostrar "Connection failed.".
 */
const SIN_INTERNET_APARTAR =
  "Sin internet no se puede apartar: el stock se aparta en el servidor. Inténtalo cuando vuelva la conexión.";
const SIN_INTERNET_CANCELAR =
  "Sin internet no se puede cancelar el apartado: el stock se devuelve en el servidor. Inténtalo cuando vuelva la conexión.";

/** Corre `trabajo` en línea; si falla por falta de conexión, avisa con `mensaje`. */
async function enLineaOAvisar<T>(
  mensaje: string,
  trabajo: (ctl: ControlLimite) => Promise<T>,
): Promise<T> {
  if (!hayRed()) throw new SinConexion(mensaje);
  try {
    return await conLimite(trabajo);
  } catch (e) {
    if (esFallaDeRed(e)) throw new SinConexion(mensaje);
    throw e;
  }
}

export type CrearApartadoInput = {
  negocioId: string;
  sucursalId: string;
  nodoId: string;
  cliente: string;
  telefonoCliente?: string;
  articulos: VentaArticulo[];
  totalApartado: number;
  señaInicial: number;
};

export async function crearApartado(input: CrearApartadoInput): Promise<Apartado> {
  const {
    negocioId,
    sucursalId,
    nodoId,
    cliente,
    telefonoCliente,
    articulos,
    totalApartado,
    señaInicial,
  } = input;
  const apartadoId = genApartadoId();
  const huella = generarID();
  const fecha = fechaISO_MX();

  const abonoInicial: Abono = {
    fecha,
    monto: señaInicial,
    estado: "pagado",
    tipo: "seña",
  };

  const estado =
    señaInicial >= totalApartado
      ? "completo"
      : señaInicial > 0
        ? "parcial"
        : "pendiente";

  const apartado: Apartado = {
    apartadoId,
    cliente,
    ...(telefonoCliente ? { telefonoCliente } : {}),
    // FASE 3B: preservar `subvariacionCodigo` por item para poder devolver
    // stock al nivel correcto si se cancela el apartado.
    articulos: articulos.map((a) => ({
      id: a.id,
      cantidad: Number(a.cantidad) || 0,
      precio: Number(a.precio) || 0,
      nombre: a.nombrePublico,
      ...(a.subvariacionCodigo
        ? { subvariacionCodigo: a.subvariacionCodigo }
        : {}),
    })),
    seña: señaInicial,
    totalApartado,
    abonos: [abonoInicial],
    estado,
    fechaCreacion: fecha,
    sucursalId,
    nodoId,
    huella,
    stockReservado: true,
  };

  const ref = doc(db, paths.apartado(negocioId, sucursalId, apartadoId));

  // FASE 3B: descontar stock dentro de una transacción atómica. Si el
  // stock es insuficiente, lanza y NO se crea el apartado. El stock es el
  // de la sucursal del apartado (resuelta fuera de la tx).
  await enLineaOAvisar(SIN_INTERNET_APARTAR, async (ctl) => {
    const ubicacion = await cargarUbicacionStock(negocioId, sucursalId);
    ctl.siAbandonada();
    await runTransaction(db, async (tx) => {
      ctl.siAbandonada();
      // Reads
      const stockEstados = await leerStockEnTx(
        tx,
        negocioId,
        articulos as ItemStock[],
        ubicacion,
      );
      // Validate
      planearDecremento(stockEstados, articulos as ItemStock[]);
      // Writes
      ctl.vaAEscribir();
      tx.set(ref, apartado);
      aplicarStockEnTx(tx, stockEstados);
    });
  });

  // Actualizar huella para que admin y otros nodos se enteren. Best-effort y
  // sin esperar: si la red se cae justo aquí, su promesa no se cumple.
  try {
    const huellaRef = doc(
      db,
      `${COL_NEGOCIOS}/${negocioId}/${COL_DATOS}/${DOC_APARTADOS_AC}`,
    );
    void setDoc(
      huellaRef,
      { huella_apartado: generarID() },
      { merge: true },
    ).catch((e) => console.warn("No se pudo actualizar apartados_ac:", e));
  } catch (e) {
    console.warn("No se pudo actualizar apartados_ac:", e);
  }

  return apartado;
}

export type AgregarAbonoInput = {
  negocioId: string;
  sucursalId: string;
  apartado: Apartado;
  monto: number;
  tipo: "abono" | "saldo";
};

export async function agregarAbono(
  input: AgregarAbonoInput,
): Promise<Apartado> {
  const { negocioId, sucursalId, apartado, monto, tipo } = input;
  const abono: Abono = {
    fecha: fechaISO_MX(),
    monto,
    estado: "pagado",
    tipo,
  };

  const pagado =
    apartado.abonos.reduce((acc, a) => acc + a.monto, 0) + monto;
  const nuevoEstado =
    pagado >= apartado.totalApartado ? "completo" : "parcial";

  const ref = doc(
    db,
    paths.apartado(negocioId, sucursalId, apartado.apartadoId),
  );
  // El abono funciona sin internet: queda guardado en la tablet y se sube
  // solo al volver la red (no hay stock de por medio).
  await guardadoEnLaTablet(
    updateDoc(ref, {
      abonos: arrayUnion(abono),
      estado: nuevoEstado,
    }),
    ref,
    "Abono de apartado",
  );

  return {
    ...apartado,
    abonos: [...apartado.abonos, abono],
    estado: nuevoEstado,
  };
}

export async function cancelarApartado(
  negocioId: string,
  sucursalId: string,
  apartadoId: string,
): Promise<void> {
  const ref = doc(db, paths.apartado(negocioId, sucursalId, apartadoId));

  // FASE 3B: si el apartado reservó stock al crearse y aún no fue
  // cancelado, devolver ese stock al catálogo. Apartados creados antes
  // de Fase 3B (sin `stockReservado === true`) no afectan stock.
  // Se devuelve a la sucursal del apartado (la misma de la que se reservó).
  await enLineaOAvisar(SIN_INTERNET_CANCELAR, async (ctl) => {
    const ubicacion = await cargarUbicacionStock(negocioId, sucursalId);
    ctl.siAbandonada();
    await runTransaction(db, async (tx) => {
      ctl.siAbandonada();
      // Reads
      const apartadoSnap = await tx.get(ref);
      if (!apartadoSnap.exists()) {
        throw new Error("Apartado no existe");
      }
      const apartado = apartadoSnap.data() as Apartado;
      if (apartado.estado === "cancelado") {
        // Idempotencia: ya cancelado, no hacer nada.
        return;
      }
      const debeDevolverStock = apartado.stockReservado === true;
      const itemsParaStock: ItemStock[] = debeDevolverStock
        ? apartado.articulos.map((a) => ({
            id: a.id,
            cantidad: a.cantidad,
            subvariacionCodigo: a.subvariacionCodigo,
            nombrePublico: a.nombre,
          }))
        : [];
      const stockEstados = debeDevolverStock
        ? await leerStockEnTx(tx, negocioId, itemsParaStock, ubicacion)
        : new Map();

      // Validate (incremento no valida, solo aplica)
      if (debeDevolverStock) {
        planearIncremento(stockEstados, itemsParaStock);
      }

      // Writes
      ctl.vaAEscribir();
      tx.update(ref, {
        estado: "cancelado",
        stockReservado: false,
      });
      if (debeDevolverStock) {
        aplicarStockEnTx(tx, stockEstados);
      }
    });
  });
}

/** Suscripción tiempo real a apartados NO completos/cancelados de la sucursal. */
export function onApartadosPendientes(
  negocioId: string,
  sucursalId: string,
  cb: (apartados: Apartado[]) => void,
) {
  const ref = collection(
    db,
    `${paths.sucursalData(negocioId, sucursalId)}/apartados_web_new_version`,
  );
  const q = query(ref, where("estado", "in", ["pendiente", "parcial"]));
  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snap) => {
      trackSnapshot(
        snap,
        `${paths.sucursalData(negocioId, sucursalId)}/apartados_web_new_version`,
      );
      const arr: Apartado[] = [];
      snap.forEach((d) => arr.push(d.data() as Apartado));
      arr.sort((a, b) => b.fechaCreacion.localeCompare(a.fechaCreacion));
      cb(arr);
    },
    (err) => console.error("onApartadosPendientes error:", err),
  );
}

export function saldoApartado(a: Apartado): number {
  const pagado = a.abonos.reduce((acc, ab) => acc + ab.monto, 0);
  return Math.max(0, a.totalApartado - pagado);
}
