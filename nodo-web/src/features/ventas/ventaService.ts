import {
  doc,
  getDocFromCache,
  runTransaction,
  setDoc,
  serverTimestamp,
  type DocumentReference,
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
  type PagoClip,
} from "@shared";
import {
  aplicarStockEnTx,
  leerStockEnTx,
  planearDecremento,
  type StockEstado,
} from "@/features/articulos/stockService";
import { cargarUbicacionStock } from "@/features/sucursal/ubicacionStock";

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
  /** Descuento aplicado por canje de cashback (pesos). Se persiste para auditoría. */
  descuentoPuntos?: string;
  /** Cliente de cashback de la venta (acumula o usa saldo). Auditoría. */
  puntosTelefono?: string;
  /** Crédito de regalo USADO (pesos) como descuento. NO es ingreso. Auditoría. */
  descuentoRegalo?: string;
  /**
   * Clave de idempotencia. Si se reintenta `crearVenta` con la MISMA key
   * (porque el primer intento falló con timeout y el cliente reintenta),
   * la transacción detecta el doc ya creado y devuelve el resultado
   * existente — no se duplica la venta. El caller debe generarla cuando
   * construye el preview del cobro y reusarla en cada retry.
   * Si se omite, se genera una key nueva (back-compat — no idempotente).
   */
  idempotencyKey?: string;
  /** Cobro con la terminal Clip de esta venta (marca y últimos 4 dígitos). */
  pagoClip?: PagoClip;
  /**
   * false: si la transacción falla, NO caer al modo offline sino lanzar el
   * error. Lo usa la caja al terminar una venta ya cobrada con terminal tras
   * recargar: la venta pudo haberse creado antes y el `setDoc` offline la
   * pisaría (y el stock se descontaría dos veces al reconciliar).
   */
  permitirOffline?: boolean;
};

export type VentaResult = {
  venta: Venta;
  path: string;
  /** true si la numeración es OFFLINE-prefixed (se reconcilia al reconectar) */
  offline: boolean;
};

/**
 * Tiempo para guardar la venta EN LÍNEA (número del día y stock) antes de
 * guardarla sin internet. Con red la transacción tarda 1–2 s. Sin internet el
 * SDK la reintenta 5 veces, y cada intento puede esperar hasta 15 s.
 * Pasarse con una red lenta no hace daño: la venta queda OFFLINE y el servidor
 * le pone número y descuenta su stock al llegar.
 */
const LIMITE_EN_LINEA_MS = 6_000;
/**
 * Si hace poco una venta no se pudo guardar en línea, la siguiente espera
 * menos: con el módem sin internet (la tablet sigue "conectada") cada venta
 * no tiene que esperar el límite completo. Si el internet ya volvió, la
 * transacción cabe de sobra en este tiempo.
 */
const LIMITE_TRAS_FALLO_MS = 2_000;
const VENTANA_FALLO_MS = 2 * 60_000;
let ultimoFalloEnLinea = 0;
/**
 * Si la transacción ya mandó sus escrituras, la venta pudo quedar guardada en
 * el servidor: se le da más tiempo para saberlo, porque guardarla sin internet
 * pisaría esa venta con la versión OFFLINE.
 */
const LIMITE_ESCRIBIENDO_MS = 30_000;

/** La venta no se pudo guardar en línea: no hay red o el servidor no contesta. */
export class SinConexion extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = "SinConexion";
  }
}

type ResultadoEnLinea = {
  numeroDeVenta: string;
  yaExistia: boolean;
  sobreventa: boolean;
};

/**
 * Crea una venta de forma atómica:
 * 1. Transacción: lee/incrementa contador del día (por sucursal)
 * 2. Escribe el doc individual bajo ventas_n_web_new_version/{y}/{m}/{d}/items/{ventaId}
 * 3. Fuera de la transacción: actualiza huella_venta en datos_web_new_version/ventas_ac
 *
 * Sin red, o si el servidor no contesta a tiempo, cae a modo OFFLINE:
 * numeroDeVenta = "OFFLINE-{nodoId}-{millis}", SIN descontar stock. La venta
 * queda guardada en la tablet y se sube sola al volver la red; al llegar al
 * servidor, la Cloud Function `reconciliarVentasOffline` le asigna número
 * real y descuenta su stock (marca `stockAplicado`).
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
  let huboSobreventa = false;

  // FASE 3A: si la venta cierra un apartado existente, el stock ya fue
  // reservado al crear ese apartado → no decrementar otra vez.
  const desdeApartado = input.apartado === "1" && !!input.idApartado;
  const construir = (numero: string, sobreventa: boolean) =>
    buildVenta({ ...input, numeroDeVenta: numero, huella, ventaId, now, y, m, d, sobreventa });

  try {
    // Sin red (WiFi apagado o sin señal) ni se intenta en línea: la
    // transacción necesita el servidor y solo reintentaría hasta rendirse.
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      throw new SinConexion("La caja no tiene internet.");
    }
    const r = await guardarEnLinea({
      input,
      ventaRef,
      contadorRef,
      desdeApartado,
      construir,
      limiteMs:
        Date.now() - ultimoFalloEnLinea < VENTANA_FALLO_MS
          ? LIMITE_TRAS_FALLO_MS
          : LIMITE_EN_LINEA_MS,
    });
    ultimoFalloEnLinea = 0;
    numeroDeVenta = r.numeroDeVenta;
    yaExistia = r.yaExistia;
    huboSobreventa = r.sobreventa;
  } catch (err) {
    ultimoFalloEnLinea = Date.now();
    if (input.permitirOffline === false) throw err;
    // FIX A8: fallback offline. numeroDeVenta con prefijo OFFLINE-
    // para ser reconciliado por Cloud Function al reconectar.
    // FASE 2: usar la misma huella en el setDoc — si el cliente reintenta
    // con misma idempotencyKey y el primer setDoc llegó al servidor, el
    // segundo sobreescribe los mismos datos (no duplica). El reconciliador
    // sigue siendo idempotente vía `numeroDeVenta.startsWith("OFFLINE-")`.
    offline = true;
    numeroDeVenta = `OFFLINE-${nodoId.slice(0, 6)}-${Date.now()}`;
    await guardarEnLaTablet(ventaRef, construir(numeroDeVenta, false));
    console.warn("Venta en modo OFFLINE:", (err as Error).message);
  }

  if (yaExistia) {
    // El doc ya existía — devolvemos su path con offline=false (no se
    // creó nada nuevo). El caller decide qué hacer (típicamente, mostrar
    // el ticket existente como si la venta hubiera sido fresca).
    return { venta: construir(numeroDeVenta, huboSobreventa), path: ventaRef.path, offline: false };
  }

  const venta = construir(numeroDeVenta, huboSobreventa);

  // Actualizar huella fuera de la transacción (trigger de sync). Best-effort
  // y sin esperar: sin red su promesa no se cumple hasta reconectar.
  try {
    const huellaRef = doc(
      db,
      `${COL_NEGOCIOS}/${negocioId}/${COL_DATOS}/${DOC_VENTAS_AC}`,
    );
    void setDoc(huellaRef, { huella_venta: generarID() }, { merge: true }).catch((e) =>
      console.warn("No se pudo actualizar ventas_ac.huella_venta:", e),
    );
  } catch (e) {
    console.warn("No se pudo actualizar ventas_ac.huella_venta:", e);
  }

  return { venta, path: ventaRef.path, offline };
}

/**
 * Guarda la venta en línea: número del día, la venta y su stock en una
 * transacción, con tiempo límite. Si se agota antes de que la transacción
 * escriba, se abandona: la transacción revisa `abandonada` antes de escribir,
 * así que ya no guardará nada y la venta OFFLINE no se cruza con ella.
 */
function guardarEnLinea(p: {
  input: NuevaVentaInput;
  ventaRef: DocumentReference;
  contadorRef: DocumentReference;
  desdeApartado: boolean;
  construir: (numero: string, sobreventa: boolean) => Venta;
  limiteMs: number;
}): Promise<ResultadoEnLinea> {
  const { input, ventaRef, contadorRef, desdeApartado, construir, limiteMs } = p;
  const { negocioId, sucursalId } = input;
  let abandonada = false;
  let escribiendo = false;
  const siAbandonada = () => {
    if (abandonada) throw new SinConexion("El servidor no respondió a tiempo.");
  };

  const trabajo = (async (): Promise<ResultadoEnLinea> => {
    // Stock de la sucursal del nodo: resolver si es la default (`cantidad`)
    // o no (`cantidadPorSucursal[sid]`) ANTES de la tx — necesita leer la
    // colección de sucursales. Si falla (sin red), la venta cae al modo
    // OFFLINE igual que si fallara la transacción.
    const ubicacion = desdeApartado
      ? null
      : await cargarUbicacionStock(negocioId, sucursalId);
    siAbandonada();
    return runTransaction(db, async (tx): Promise<ResultadoEnLinea> => {
      siAbandonada();
      // ---------- FASE DE LECTURAS ----------
      // Firestore exige que TODAS las reads vayan antes de cualquier write
      // dentro de la transacción. Ordenamos: ventaRef → contadorRef →
      // artículos (para decremento de stock).

      // FASE 2: idempotencia.
      const ventaSnap = await tx.get(ventaRef);
      if (ventaSnap.exists()) {
        const prev = ventaSnap.data() as Venta;
        return { numeroDeVenta: prev.numeroDeVenta, yaExistia: true, sobreventa: false };
      }

      const contadorSnap = await tx.get(contadorRef);

      // FASE 3A: leer stock de los artículos del carrito (excepto si la
      // venta cierra un apartado — en ese caso el stock ya se reservó).
      const stockEstados = ubicacion
        ? await leerStockEnTx(tx, negocioId, input.articulos, ubicacion)
        : new Map<string, StockEstado>();

      // ---------- FASE DE VALIDACIÓN ----------
      // SOBREVENTA permitida al cobrar (decisión de negocio): si el stock es
      // insuficiente NO se aborta — se reduce hasta 0 (clamp). Antes lanzaba y la
      // venta caía a falso-"OFFLINE" aunque hubiera internet. Solo aborta por
      // artículo/variación inexistente (errores reales), no por falta de stock.
      let sobreventa = false;
      if (!desdeApartado) {
        const r = planearDecremento(stockEstados, input.articulos, { permitirSobreventa: true });
        sobreventa = r.sobreventa;
      }

      // FASE 1: arrancar contador en 0 (primera venta = "1") en vez de -1.
      const prev = contadorSnap.exists()
        ? (contadorSnap.data().ultimoNumeroVenta as number | undefined) ?? 0
        : 0;
      const numeroDeVenta = String(prev + 1);

      // ---------- FASE DE ESCRITURAS ----------
      // Desde aquí la venta puede quedar guardada en el servidor: ya no se
      // abandona al primer límite (ver abajo).
      siAbandonada();
      escribiendo = true;
      tx.set(ventaRef, construir(numeroDeVenta, sobreventa));
      tx.set(
        contadorRef,
        { ultimoNumeroVenta: prev + 1, actualizado: serverTimestamp() },
        { merge: true },
      );
      if (!desdeApartado) {
        aplicarStockEnTx(tx, stockEstados);
      }
      return { numeroDeVenta, yaExistia: false, sobreventa };
    });
  })();

  return new Promise<ResultadoEnLinea>((resolve, reject) => {
    const abandonar = () => {
      abandonada = true;
      reject(new SinConexion("El servidor no respondió a tiempo."));
    };
    let reloj = setTimeout(() => {
      if (!escribiendo) return abandonar();
      reloj = setTimeout(abandonar, LIMITE_ESCRIBIENDO_MS - limiteMs);
    }, limiteMs);
    trabajo.then(
      (r) => {
        clearTimeout(reloj);
        resolve(r);
      },
      (e) => {
        clearTimeout(reloj);
        reject(e);
      },
    );
  });
}

/**
 * Guarda la venta sin internet. El SDK la escribe al instante en la tablet
 * (caché persistente) y la sube sola al volver la red, aunque la app se
 * cierre antes. La promesa de `setDoc` solo se cumple cuando el SERVIDOR la
 * confirma: sin red nunca terminaba y la caja se quedaba en "Procesando
 * venta…". Aquí se espera solo a que quede en la tablet: la lectura del caché
 * entra en la misma fila de trabajo del SDK, detrás de la escritura, así que
 * cuando contesta la venta ya está guardada.
 */
async function guardarEnLaTablet(ref: DocumentReference, v: Venta): Promise<void> {
  const escritura = setDoc(ref, v);
  escritura.catch((e) =>
    console.error("La venta guardada sin internet no se pudo subir:", e),
  );
  await Promise.race([
    escritura,
    getDocFromCache(ref).then(
      () => undefined,
      () => undefined,
    ),
  ]);
}

function buildVenta(p: NuevaVentaInput & {
  numeroDeVenta: string;
  huella: string;
  ventaId: string;
  now: Date;
  y: string;
  m: string;
  d: string;
  sobreventa?: boolean;
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
  if (p.pagoClip) v.pagoClip = p.pagoClip;
  if (p.descuentoPuntos && Number(p.descuentoPuntos) > 0) {
    v.descuentoPuntos = p.descuentoPuntos;
  }
  if (p.puntosTelefono) v.puntosClienteTelefono = p.puntosTelefono;
  if (p.descuentoRegalo && Number(p.descuentoRegalo) > 0) {
    v.descuentoRegalo = p.descuentoRegalo;
  }
  if (p.sobreventa) v.sobreventa = true;
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

