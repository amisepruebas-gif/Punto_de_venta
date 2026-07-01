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
};
export type RegistrarNodoOutput = {
  success: boolean;
  nodoId: string;
  sucursalId: string;
  negocioId: string;
  customToken: string;
};

export type RebindNodoInput = {
  negocioId: string;
  nodoId: string;
  userAgent?: string;
  registradoPor?: string;
};
export type RebindNodoOutput = RegistrarNodoOutput;

export type ListarSucursalesInput = { negocioId: string };
export type ListarSucursalesOutput = {
  sucursales: Array<{ sucursalId: string; nombre: string; direccion: string }>;
};

export type ListarNodosInput = { negocioId: string; sucursalId: string };
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
