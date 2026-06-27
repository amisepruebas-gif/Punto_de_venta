import {
  doc,
  runTransaction,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import {
  paths,
  COL_NEGOCIOS,
  COL_DATOS,
  DOC_VENTAS_AC,
  ymdMX,
  ymdPaddedMX,
  fechaISO_MX,
  fechaISOStrict,
  generarID,
  type Venta,
  type VentaArticulo,
  type MovimientoPago,
} from "@shared";
import {
  aplicarStockEnTx,
  leerStockEnTx,
  planearDecremento,
  type StockEstado,
} from "@/features/articulos/stockService";

export type NuevaVentaInput = {
  negocioId: string;
  sucursalId: string;
  nodoId: string;
  enTurno: string;
  vendedorIdUsuario?: string;
  articulos: VentaArticulo[];
  movimiento: MovimientoPago;
  montoCobro: string;
  montoPago: string;
  cambio: string;
  apartado?: "0" | "1";
  idApartado?: string;
  datosPagoDividido?: Record<string, unknown>;
  comicion?: string;
  statusComision?: string;
  /** Descuento aplicado por canje de puntos (pesos). Se persiste para auditoría. */
  descuentoPuntos?: string;
  /**
   * Clave de idempotencia. Si se reintenta `crearVenta` con la MISMA key
   * (porque el primer intento falló con timeout y el cliente reintenta),
   * la transacción detecta el doc ya creado y devuelve el resultado
   * existente — no se duplica la venta. El caller debe generarla cuando
   * construye el preview del cobro y reusarla en cada retry.
   * Si se omite, se genera una key nueva (back-compat — no idempotente).
   */
  idempotencyKey?: string;
};

export type VentaResult = {
  venta: Venta;
  path: string;
  /** true si la numeración es OFFLINE-prefixed (se reconcilia al reconectar) */
  offline: boolean;
};

/**
 * Crea una venta de forma atómica:
 * 1. Transacción: lee/incrementa contador del día (por sucursal)
 * 2. Escribe el doc individual bajo ventas_n_web_new_version/{y}/{m}/{d}/items/{ventaId}
 * 3. Fuera de la transacción: actualiza huella_venta en datos_web_new_version/ventas_ac
 *
 * Si la transacción falla por falta de red, cae a modo OFFLINE:
 * numeroDeVenta = "OFFLINE-{nodoId}-{millis}" y una Cloud Function reconcilia
 * al reconectar (TODO: implementar reconciliarVentasOffline).
 */
export async function crearVenta(input: NuevaVentaInput): Promise<VentaResult> {
  const { negocioId, sucursalId, nodoId, idempotencyKey } = input;
  const now = new Date();
  const { y, m, d } = ymdMX(now);
  const ymd = ymdPaddedMX(now);
  // FASE 2 hardening: si el caller pasa `idempotencyKey`, la usamos como
  // huella/ventaId estable. Esto hace que un retry sobre la misma venta
  // (mismo doc id) no duplique. Si se omite, fallback al comportamiento
  // anterior (no idempotente).
  const huella = idempotencyKey || generarID();
  const ventaId = huella;

  const contadorRef = doc(db, paths.contadorDia(negocioId, sucursalId, ymd));
  const ventaRef = doc(db, paths.ventaItem(negocioId, sucursalId, y, m, d, ventaId));

  let numeroDeVenta = "";
  let offline = false;
  let yaExistia = false;

  // FASE 3A: si la venta cierra un apartado existente, el stock ya fue
  // reservado al crear ese apartado → no decrementar otra vez.
  const desdeApartado = input.apartado === "1" && !!input.idApartado;

  try {
    await runTransaction(db, async (tx) => {
      // ---------- FASE DE LECTURAS ----------
      // Firestore exige que TODAS las reads vayan antes de cualquier write
      // dentro de la transacción. Ordenamos: ventaRef → contadorRef →
      // artículos (para decremento de stock).

      // FASE 2: idempotencia.
      const ventaSnap = await tx.get(ventaRef);
      if (ventaSnap.exists()) {
        const prev = ventaSnap.data() as Venta;
        numeroDeVenta = prev.numeroDeVenta;
        yaExistia = true;
        return;
      }

      const contadorSnap = await tx.get(contadorRef);

      // FASE 3A: leer stock de los artículos del carrito (excepto si la
      // venta cierra un apartado — en ese caso el stock ya se reservó).
      const stockEstados = desdeApartado
        ? new Map<string, StockEstado>()
        : await leerStockEnTx(tx, negocioId, input.articulos);

      // ---------- FASE DE VALIDACIÓN ----------
      // SOBREVENTA permitida al cobrar (decisión de negocio): si el stock es
      // insuficiente NO se aborta — se reduce hasta 0 (clamp). Antes lanzaba y la
      // venta caía a falso-"OFFLINE" aunque hubiera internet. Solo aborta por
      // artículo/variación inexistente (errores reales), no por falta de stock.
      if (!desdeApartado) {
        planearDecremento(stockEstados, input.articulos, { permitirSobreventa: true });
      }

      // FASE 1: arrancar contador en 0 (primera venta = "1") en vez de -1.
      const prev = contadorSnap.exists()
        ? (contadorSnap.data().ultimoNumeroVenta as number | undefined) ?? 0
        : 0;
      numeroDeVenta = String(prev + 1);

      // ---------- FASE DE ESCRITURAS ----------
      const v = buildVenta({ ...input, numeroDeVenta, huella, ventaId, now, y, m, d });
      tx.set(ventaRef, v);
      tx.set(
        contadorRef,
        { ultimoNumeroVenta: prev + 1, actualizado: serverTimestamp() },
        { merge: true },
      );
      if (!desdeApartado) {
        aplicarStockEnTx(tx, stockEstados);
      }
    });
  } catch (err) {
    // FIX A8: fallback offline. numeroDeVenta con prefijo OFFLINE-
    // para ser reconciliado por Cloud Function al reconectar.
    // FASE 2: usar la misma huella en el setDoc — si el cliente reintenta
    // con misma idempotencyKey y el primer setDoc llegó al servidor, el
    // segundo sobreescribe los mismos datos (no duplica). El reconciliador
    // sigue siendo idempotente vía `numeroDeVenta.startsWith("OFFLINE-")`.
    offline = true;
    numeroDeVenta = `OFFLINE-${nodoId.slice(0, 6)}-${Date.now()}`;
    const v = buildVenta({ ...input, numeroDeVenta, huella, ventaId, now, y, m, d });
    await setDoc(ventaRef, v);
    console.warn("Venta en modo OFFLINE:", (err as Error).message);
  }

  if (yaExistia) {
    // El doc ya existía — devolvemos su path con offline=false (no se
    // creó nada nuevo). El caller decide qué hacer (típicamente, mostrar
    // el ticket existente como si la venta hubiera sido fresca).
    const venta = buildVenta({ ...input, numeroDeVenta, huella, ventaId, now, y, m, d });
    return { venta, path: ventaRef.path, offline: false };
  }

  const venta = buildVenta({ ...input, numeroDeVenta, huella, ventaId, now, y, m, d });

  // Actualizar huella fuera de la transacción (trigger de sync). Best-effort.
  try {
    const huellaRef = doc(
      db,
      `${COL_NEGOCIOS}/${negocioId}/${COL_DATOS}/${DOC_VENTAS_AC}`,
    );
    await setDoc(huellaRef, { huella_venta: generarID() }, { merge: true });
  } catch (e) {
    console.warn("No se pudo actualizar ventas_ac.huella_venta:", e);
  }

  return { venta, path: ventaRef.path, offline };
}

function buildVenta(p: NuevaVentaInput & {
  numeroDeVenta: string;
  huella: string;
  ventaId: string;
  now: Date;
  y: string;
  m: string;
  d: string;
}): Venta {
  const v: Venta = {
    ventaId: p.ventaId,
    numeroDeVenta: p.numeroDeVenta,
    id_registro: `${p.y} ${p.m} ${p.d}`,
    huella: p.huella,
    enTurno: p.enTurno,
    montoCobro: p.montoCobro,
    montoPago: p.montoPago,
    cambio: p.cambio,
    movimiento: p.movimiento,
    articulos: p.articulos,
    apartado: p.apartado ?? "0",
    fecha: fechaISO_MX(p.now),
    fechaISO: fechaISOStrict(p.now),
    negocioId: p.negocioId,
    nodoId: p.nodoId,
    sucursalId: p.sucursalId,
  };
  if (p.idApartado) v.idApartado = p.idApartado;
  if (p.vendedorIdUsuario) v.vendedorIdUsuario = p.vendedorIdUsuario;
  if (p.datosPagoDividido) v.datosPagoDividido = p.datosPagoDividido;
  if (p.comicion) v.comicion = p.comicion;
  if (p.statusComision) v.statusComision = p.statusComision;
  if (p.descuentoPuntos && Number(p.descuentoPuntos) > 0) {
    v.descuentoPuntos = p.descuentoPuntos;
  }
  return v;
}

/** Calcula el total del carrito a partir de los items.
 *
 * `descuento` (snapshot del POS) representa el PRECIO FINAL por unidad,
 * no un monto a restar — misma semántica que `subtotalItem`. Antes esta
 * función hacía `cant*precio - desc`, lo cual subvaluaba la venta tras
 * la introducción de `precioDescuento` (los snapshots venían con precio
 * final → el resto inflado producía `montoCobro` y totales de apartado
 * erróneos).
 */
export function totalCarrito(items: VentaArticulo[]): number {
  return items.reduce((acc, it) => {
    const cant = Number(it.cantidad) || 0;
    const aply3x2 = Number((it as { aply_3x2?: string }).aply_3x2) || 0;
    const precio = Number(it.descuento) || Number(it.precio) || 0;
    return acc + (cant - aply3x2) * precio;
  }, 0);
}

