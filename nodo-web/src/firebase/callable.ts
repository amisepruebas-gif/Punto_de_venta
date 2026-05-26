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
