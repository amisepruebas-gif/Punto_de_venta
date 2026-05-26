import { httpsCallable, type HttpsCallable } from "firebase/functions";
import { functions } from "./config";

// ============================================================
// Tipos de Cloud Functions
// ============================================================

export type CrearSucursalInput = {
  negocioId: string;
  nombre: string;
  direccion: string;
  telefono?: string;
};
export type CrearSucursalOutput = { success: boolean; sucursalId: string };

export type RevocarNodoInput = { negocioId: string; nodoId: string };
export type RevocarNodoOutput = { success: boolean };

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

export type CreateUserInput = {
  email: string;
  password: string;
  nombre: string;
  role: "admin" | "vendedor";
  negocioId?: string;
};
export type CreateUserOutput = { success: boolean; uid: string };

// ============================================================
// Wrappers
// ============================================================

function callable<I, O>(name: string): HttpsCallable<I, O> {
  return httpsCallable<I, O>(functions, name);
}

export const fnCrearSucursal = callable<CrearSucursalInput, CrearSucursalOutput>(
  "crearSucursal",
);
export const fnRevocarNodo = callable<RevocarNodoInput, RevocarNodoOutput>(
  "revocarNodo",
);
export const fnListarSucursales = callable<
  ListarSucursalesInput,
  ListarSucursalesOutput
>("listarSucursales");
export const fnListarNodos = callable<ListarNodosInput, ListarNodosOutput>(
  "listarNodos",
);
export const fnCreateUser = callable<CreateUserInput, CreateUserOutput>(
  "createUser",
);

// ---- migrarDataLegacy ----
export type MigrarDataLegacyInput = {
  negocioId: string;
  sucursalId: string;
  dryRun?: boolean;
  solo?:
    | "articulos"
    | "ventas"
    | "cortes"
    | "mensajes"
    | "apartados"
    | "datos";
};
export type MigrarDataLegacyOutput = {
  success: boolean;
  dryRun: boolean;
  articulos: number;
  ventas: number;
  cortes: number;
  mensajes: number;
  apartados: number;
  datos: number;
  errores: string[];
};
// Timeout extendido a 9 min (= 540s del server). Default del SDK es 70s,
// insuficiente para migrar miles de docs.
export const fnMigrarDataLegacy = httpsCallable<
  MigrarDataLegacyInput,
  MigrarDataLegacyOutput
>(functions, "migrarDataLegacy", { timeout: 540_000 });

// ---- migrarArticulosLegacy (Fase 3 — Ingreso de Mercancía) ----
export type MigrarArticulosLegacyInput = {
  negocioId: string;
  dryRun?: boolean;
};
export type MigrarArticulosLegacyOutput = {
  dryRun: boolean;
  articulosLeidos: number;
  articulosTocados: number;
  categoriasCreadas: number;
  subcategoriasCreadas: number;
  etiquetasPobladas: number;
  errores: Array<{ articuloId: string; error: string }>;
};
export const fnMigrarArticulosLegacy = httpsCallable<
  MigrarArticulosLegacyInput,
  MigrarArticulosLegacyOutput
>(functions, "migrarArticulosLegacy", { timeout: 540_000 });

// ---- migrarSubvariacionesLegacy (Fase 4 — Ingreso de Mercancía) ----
export type MigrarSubvariacionesLegacyInput = {
  negocioId: string;
  dryRun?: boolean;
};
export type MigrarSubvariacionesLegacyOutput = {
  dryRun: boolean;
  articulosLeidos: number;
  articulosTocados: number;
  codigosAsignados: number;
  archivosMovidos: number;
  archivosFallidos: number;
  errores: Array<{ articuloId: string; error: string }>;
};
export const fnMigrarSubvariacionesLegacy = httpsCallable<
  MigrarSubvariacionesLegacyInput,
  MigrarSubvariacionesLegacyOutput
>(functions, "migrarSubvariacionesLegacy", { timeout: 540_000 });

// ---- limpiarLegacyArticulos (Fase 6) ----
export type LimpiarLegacyArticulosInput = {
  negocioId: string;
  dryRun?: boolean;
};
export type LimpiarLegacyArticulosOutput = {
  dryRun: boolean;
  articulosLeidos: number;
  articulosTocados: number;
  camposGeneroBorrados: number;
  camposSubgeneroBorrados: number;
  camposHashtagsBorrados: number;
  errores: Array<{ articuloId: string; error: string }>;
};
export const fnLimpiarLegacyArticulos = httpsCallable<
  LimpiarLegacyArticulosInput,
  LimpiarLegacyArticulosOutput
>(functions, "limpiarLegacyArticulos", { timeout: 540_000 });

// ============================================================
// Chat — admin whitelist + colaboradores + grupos
// Ver `docs/14-chat-arquitectura.md` y `docs/15-chat-implementacion.md`.
// ============================================================

export type AgregarAdminWhitelistInput = {
  negocioId: string;
  email: string;
};
export type AgregarAdminWhitelistOutput = {
  ok: true;
  emailKey: string;
};
export const fnAgregarAdminWhitelist = callable<
  AgregarAdminWhitelistInput,
  AgregarAdminWhitelistOutput
>("agregarAdminWhitelist");

export type QuitarAdminWhitelistInput = {
  negocioId: string;
  email: string;
};
export type QuitarAdminWhitelistOutput = { ok: true };
export const fnQuitarAdminWhitelist = callable<
  QuitarAdminWhitelistInput,
  QuitarAdminWhitelistOutput
>("quitarAdminWhitelist");

export type AdminWhitelistItem = {
  id: string;
  email: string;
  habilitado: boolean;
  fechaAgregado?: unknown;
  agregadoPor?: string;
  uid?: string;
  ultimoLogin?: unknown;
};
export type ListarAdminWhitelistInput = { negocioId: string };
export type ListarAdminWhitelistOutput = { items: AdminWhitelistItem[] };
export const fnListarAdminWhitelist = callable<
  ListarAdminWhitelistInput,
  ListarAdminWhitelistOutput
>("listarAdminWhitelist");

export type VerificarAdminWhitelistInput = { negocioId: string };
export type VerificarAdminWhitelistOutput = {
  ok: true;
  role: "admin";
  negocioId: string;
};
export const fnVerificarAdminWhitelist = callable<
  VerificarAdminWhitelistInput,
  VerificarAdminWhitelistOutput
>("verificarAdminWhitelist");

export type CrearColaboradorInput = {
  negocioId: string;
  username: string;
  password: string;
  nombre?: string;
};
export type CrearColaboradorOutput = {
  ok: true;
  colaboradorId: string;
};
export const fnCrearColaborador = callable<
  CrearColaboradorInput,
  CrearColaboradorOutput
>("crearColaborador");

export type ActualizarColaboradorInput = {
  negocioId: string;
  colaboradorId: string;
  nombre?: string;
  habilitado?: boolean;
  nuevoPassword?: string;
};
export type ActualizarColaboradorOutput = { ok: true };
export const fnActualizarColaborador = callable<
  ActualizarColaboradorInput,
  ActualizarColaboradorOutput
>("actualizarColaborador");

export type EliminarColaboradorInput = {
  negocioId: string;
  colaboradorId: string;
};
export type EliminarColaboradorOutput = {
  ok: true;
  gruposLimpiados: number;
};
export const fnEliminarColaborador = callable<
  EliminarColaboradorInput,
  EliminarColaboradorOutput
>("eliminarColaborador");

export type HabilitarColaboradorEnGrupoInput = {
  negocioId: string;
  nodoId: string;
  colaboradorId: string;
};
export type HabilitarColaboradorEnGrupoOutput = { ok: true };
export const fnHabilitarColaboradorEnGrupo = callable<
  HabilitarColaboradorEnGrupoInput,
  HabilitarColaboradorEnGrupoOutput
>("habilitarColaboradorEnGrupo");

export type QuitarColaboradorDeGrupoInput = {
  negocioId: string;
  nodoId: string;
  colaboradorId: string;
};
export type QuitarColaboradorDeGrupoOutput = { ok: true };
export const fnQuitarColaboradorDeGrupo = callable<
  QuitarColaboradorDeGrupoInput,
  QuitarColaboradorDeGrupoOutput
>("quitarColaboradorDeGrupo");

export type AsegurarChatGrupoNodoInput = {
  negocioId: string;
  nodoId: string;
};
export type AsegurarChatGrupoNodoOutput = {
  ok: true;
  creado: boolean;
};
export const fnAsegurarChatGrupoNodo = callable<
  AsegurarChatGrupoNodoInput,
  AsegurarChatGrupoNodoOutput
>("asegurarChatGrupoNodo");
