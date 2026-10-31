import { httpsCallable, type HttpsCallable } from "firebase/functions";
import { functions } from "./config";

// ============================================================
// Tipos de Cloud Functions (mismo contrato que functions/index.js)
// ============================================================

export type RegistrarNodoInput = {
  negocioId: string;
  sucursalId?: string;
  nuevaSucursal?: { nombre: string; direccion: string; telefono?: string };
  nombreNodo: string;
  registradoPor: string;
  userAgent?: string;
  /** Código de alta de un solo uso (admin → Nodos). */
  codigo?: string;
};
export type RegistrarNodoOutput = {
  success: boolean;
  nodoId: string;
  sucursalId: string;
  negocioId: string;
  customToken: string;
  /** Llave de re-auth de la tablet; null si conserva la que ya tenía. */
  llave?: string | null;
};

export type RebindNodoInput = {
  negocioId: string;
  nodoId: string;
  userAgent?: string;
  registradoPor?: string;
  /** Re-auth automático: la llave guardada en la tablet. */
  llave?: string;
  /** Re-vinculación manual: código de alta (admin → Nodos). */
  codigo?: string;
};
export type RebindNodoOutput = RegistrarNodoOutput;

export type ListarSucursalesInput = { negocioId: string; codigo?: string };
export type ListarSucursalesOutput = {
  sucursales: Array<{ sucursalId: string; nombre: string; direccion: string }>;
};

export type ListarNodosInput = {
  negocioId: string;
  sucursalId: string;
  codigo?: string;
};
export type ListarNodosOutput = {
  nodos: Array<{
    nodoId: string;
    nombre: string;
    registradoPor: string;
    fechaRegistro: string | null;
  }>;
};

// ============================================================
// Wrappers
// ============================================================

function callable<I, O>(name: string): HttpsCallable<I, O> {
  return httpsCallable<I, O>(functions, name);
}

export const fnRegistrarNodo = callable<RegistrarNodoInput, RegistrarNodoOutput>(
  "registrarNodo",
);
export const fnRebindNodo = callable<RebindNodoInput, RebindNodoOutput>(
  "rebindNodo",
);
export const fnListarSucursales = callable<
  ListarSucursalesInput,
  ListarSucursalesOutput
>("listarSucursales");
export const fnListarNodos = callable<ListarNodosInput, ListarNodosOutput>(
  "listarNodos",
);
/** Tablets dadas de alta antes de la llave: la piden con su sesión. */
export const fnAsegurarLlaveNodo = callable<
  Record<string, never>,
  { llave: string | null }
>("asegurarLlaveNodo");

// ---- Chat ----
export type AsegurarChatGrupoNodoInput = {
  negocioId: string;
  nodoId: string;
};
export type AsegurarChatGrupoNodoOutput = {
  ok: true;
  /** `true` si la CF acabo de crear el meta; `false` si ya existia. */
  creado: boolean;
};
export const fnAsegurarChatGrupoNodo = callable<
  AsegurarChatGrupoNodoInput,
  AsegurarChatGrupoNodoOutput
>("asegurarChatGrupoNodo");

// ---- Puntos / monedero (CF intermediaria → amise.mx; el secreto vive en la CF) ----
export type RegistrarClientePuntosInput = {
  email: string;
  phone: string;
  nombre?: string;
  /** Contraseña temporal generada en el POS. */
  code: string;
};
export type RegistrarClientePuntosOutput = { ok: boolean };
export const fnRegistrarClientePuntos = callable<
  RegistrarClientePuntosInput,
  RegistrarClientePuntosOutput
>("registrarClientePuntos");

export type AcreditarPuntosInput = {
  email?: string;
  phone?: string;
  amount: number;
  ventaId: string;
  sucursalId: string;
  nodoId: string;
};
export type AcreditarPuntosOutput = {
  ok: boolean;
  /** Cashback acumulado en esta venta, en $. */
  added: number;
  /** Saldo de cashback resultante, en $. */
  balance: number;
  /** $ de cashback por cada $1 de compra (regla vigente). */
  valorPorPeso?: number;
  /** true si la acreditación ya existía (idempotente) — para distinguir del monto bajo. */
  already?: boolean;
};
export const fnAcreditarPuntos = callable<AcreditarPuntosInput, AcreditarPuntosOutput>(
  "acreditarPuntos",
);

/** Estado de la tarjeta física vinculada. */
export type TarjetaInfo = {
  codigo: string;
  estado: "activa" | "bloqueada" | "repuesta";
};

export type ConsultarSaldoInput = {
  email?: string;
  phone?: string;
  /** Barcode EAN-13 de la tarjeta (consulta por escaneo). */
  codigo?: string;
};
export type ConsultarSaldoOutput = {
  exists: boolean;
  /** Saldo de cashback en $. */
  saldoDinero?: number;
  /** Saldo usable, redondeado HACIA ABAJO a $0.50. */
  saldoUsable?: number;
  /** $ de cashback por cada $1 de compra (regla vigente). */
  valorPorPeso?: number;
  /** Teléfono del monedero (E.164). Lo usa el POS al consultar por barcode. */
  telefono?: string | null;
  /** Tarjeta física vinculada (o null si no tiene). */
  tarjeta?: TarjetaInfo | null;
};
export const fnConsultarSaldoPuntos = callable<
  ConsultarSaldoInput,
  ConsultarSaldoOutput
>("consultarSaldoPuntos");

export type CanjearPuntosInput = {
  email?: string;
  phone?: string;
  /** $ de cashback a canjear. */
  money: number;
  idempotencyKey: string;
  /** Fase 5: activa el candado de canje en el servidor (anti doble-cobro). */
  pendingLock?: boolean;
};
export type CanjearPuntosOutput = {
  ok: boolean;
  redeemed: number;
  balance: number;
  money: number;
};
export const fnCanjearPuntos = callable<CanjearPuntosInput, CanjearPuntosOutput>(
  "canjearPuntos",
);

// Fase 5 — cierra el canje pendiente tras crear la venta (libera el candado).
export type CerrarCanjeInput = {
  email?: string;
  phone?: string;
  /** cobroId (= idempotencyKey del canje) a cerrar. */
  cobroId: string;
};
export type CerrarCanjeOutput = { ok: boolean; closed: boolean };
export const fnCerrarCanje = callable<CerrarCanjeInput, CerrarCanjeOutput>(
  "cerrarCanje",
);

export type RecuperarCodigoInput = { phone?: string; email?: string };
export type RecuperarCodigoOutput = { ok: boolean; email: string; code: string };
export const fnRecuperarCodigoPuntos = callable<
  RecuperarCodigoInput,
  RecuperarCodigoOutput
>("recuperarCodigoPuntos");

// ---- Tarjeta física (barcode EAN-13) ----
export type ActivarTarjetaInput = {
  email?: string;
  phone?: string;
  /** Barcode EAN-13 de la tarjeta física escaneada. */
  codigo: string;
  /** Venta donde se cobra/activa (idempotencia). */
  ventaId?: string;
};
export type ActivarTarjetaOutput = { ok: boolean; already: boolean };
export const fnActivarTarjeta = callable<ActivarTarjetaInput, ActivarTarjetaOutput>(
  "activarTarjeta",
);

export type ReponerTarjetaInput = {
  email?: string;
  phone?: string;
  /** Alternativa a email/phone: identificar por la tarjeta anterior. */
  codigoAnterior?: string;
  codigoNuevo: string;
  ventaId?: string;
};
export type ReponerTarjetaOutput = { ok: boolean; already: boolean };
export const fnReponerTarjeta = callable<ReponerTarjetaInput, ReponerTarjetaOutput>(
  "reponerTarjeta",
);

export type DesbloquearTarjetaInput = { email?: string; phone?: string; codigo?: string };
export type DesbloquearTarjetaOutput = { ok: boolean };
export const fnDesbloquearTarjeta = callable<
  DesbloquearTarjetaInput,
  DesbloquearTarjetaOutput
>("desbloquearTarjeta");

// ---- Tarjeta de REGALO (Feature 5, Fase 2) ----
// Crédito prepago (pozo separado del cashback; vence a 6m). El POS proxya a
// amise.mx /api/loyalty/gift/*; idempotencia por ventaId.
export type EmitirTarjetaRegaloInput = {
  /** Email del DESTINATARIO (quien la usará). Obligatorio. */
  email: string;
  phone?: string;
  nombre?: string;
  /** Monto de crédito a cargar ($200/$300/$500 o custom >$500). */
  denominacion: number;
  /** Barcode EAN-13 de la tarjeta física (D2: siempre física). */
  barcode: string;
  /** Venta donde se cobra/emite (idempotencia). */
  ventaId: string;
};
export type EmitirTarjetaRegaloOutput = {
  ok: boolean;
  walletId: string;
  balance: number;
  /** Vencimiento del crédito (ms epoch). */
  expiraAt: number;
  /** Código de acceso online EN CLARO (solo la 1ª emisión; null en reintentos). */
  accessCode: string | null;
  /** 'issued' | 'linked' | 'already-active' — por qué (no) vino accessCode. */
  accessCodeReason: string;
  /** ¿Se vinculó el barcode físico al monedero? */
  cardLinked: boolean;
  cardReason: string;
  /** true si la emisión ya existía (reintento idempotente). */
  already: boolean;
};
export const fnEmitirTarjetaRegalo = callable<
  EmitirTarjetaRegaloInput,
  EmitirTarjetaRegaloOutput
>("emitirTarjetaRegalo");

export type RecargarTarjetaRegaloInput = {
  email?: string;
  phone?: string;
  /** Alternativa: identificar por el barcode de la tarjeta. */
  codigo?: string;
  /** Monto a recargar (>0). */
  amount: number;
  ventaId: string;
};
export type RecargarTarjetaRegaloOutput = {
  ok: boolean;
  walletId: string;
  balance: number;
  expiraAt: number;
  already: boolean;
};
export const fnRecargarTarjetaRegalo = callable<
  RecargarTarjetaRegaloInput,
  RecargarTarjetaRegaloOutput
>("recargarTarjetaRegalo");

export type ConsultarSaldoRegaloInput = {
  email?: string;
  phone?: string;
  /** Barcode EAN-13 de la tarjeta. */
  codigo?: string;
};
export type ConsultarSaldoRegaloOutput = {
  ok: boolean;
  /** Crédito EFECTIVO en $ (0 si venció). */
  saldo: number;
  /** Vencimiento (ms epoch) o null. */
  expiraAt: number | null;
  /** true si había crédito pero venció. */
  vencido: boolean;
};
export const fnConsultarSaldoTarjetaRegalo = callable<
  ConsultarSaldoRegaloInput,
  ConsultarSaldoRegaloOutput
>("consultarSaldoTarjetaRegalo");

// ---- Uso de crédito de regalo en el POS (Feature 5, Fase 3) ----
// El crédito se aplica como DESCUENTO (reduce montoCobro → NO es ingreso). Candado
// (pendingLock) anti doble-débito, idempotente por ventaId.
export type RedimirCreditoRegaloInput = {
  email?: string;
  phone?: string;
  /** Barcode EAN-13 de la tarjeta (identificación por escaneo). */
  codigo?: string;
  /** $ de crédito a usar. */
  money: number;
  idempotencyKey: string;
  /** Activa el candado del servidor (anti doble-cobro). */
  pendingLock?: boolean;
};
export type RedimirCreditoRegaloOutput = {
  ok: boolean;
  used: number;
  balance: number;
  money: number;
  /** cobroId para cerrar el candado tras crear la venta. */
  cobroId: string;
};
export const fnRedimirCreditoRegalo = callable<
  RedimirCreditoRegaloInput,
  RedimirCreditoRegaloOutput
>("redimirCreditoRegalo");

export type CerrarCreditoRegaloInput = {
  email?: string;
  phone?: string;
  codigo?: string;
  /** cobroId (= idempotencyKey del uso) a cerrar. */
  cobroId: string;
};
export type CerrarCreditoRegaloOutput = { ok: boolean; closed: boolean };
export const fnCerrarCreditoRegalo = callable<
  CerrarCreditoRegaloInput,
  CerrarCreditoRegaloOutput
>("cerrarCreditoRegalo");
