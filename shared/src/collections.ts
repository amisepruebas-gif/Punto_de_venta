// ============================================================
// Nombres de colecciones Firestore — namespace _web_new_version
// ============================================================
// Todas las colecciones de la nueva versión web llevan este sufijo.
// Las colecciones legacy (sin sufijo) son READ-ONLY durante migración.
// ============================================================

export const SUFFIX = "_web_new_version";

// Raíz
export const COL_NEGOCIOS = `negocios${SUFFIX}`;
export const COL_USUARIOS = "usuarios";
export const COL_PLANES = "planes";

// Sub-colecciones bajo /negocios_web_new_version/{negocioId}/
export const COL_SUCURSALES = `sucursales${SUFFIX}`;
export const COL_NODOS = `nodos${SUFFIX}`;
export const COL_ARTICULOS = `articulos_n${SUFFIX}`;
export const COL_DATOS = `datos${SUFFIX}`;
export const COL_MENSAJES = `mensajes_n${SUFFIX}`;
export const COL_SUCURSALES_DATA = `sucursales_data${SUFFIX}`;
export const COL_CATEGORIAS = `categorias${SUFFIX}`;
export const COL_SUBCATEGORIAS = `subcategorias${SUFFIX}`;

// Sub-colecciones bajo /sucursales_data_web_new_version/{sucursalId}/
export const COL_VENTAS = `ventas_n${SUFFIX}`;
export const COL_CORTES = `corte_1${SUFFIX}`;
export const COL_APARTADOS = `apartados${SUFFIX}`;
export const COL_CONTADORES = `contadores${SUFFIX}`;
/** Usuarios con PIN para entrar a `mercancia-web`. Scope por sucursal. */
export const COL_USUARIOS_MERCANCIA = `usuariosMercancia${SUFFIX}`;

/** Resurtidos (transferencias bodega → sucursal). Scope por negocio. */
export const COL_RESURTIDOS = `resurtidos${SUFFIX}`;

// Chat — ver docs/14-chat-arquitectura.md
export const COL_CHAT_GRUPOS = `chat_grupos${SUFFIX}`;
export const COL_CHAT_DIRECTOS = `chat_directos${SUFFIX}`;
export const COL_CHAT_TYPING = `chat_typing${SUFFIX}`;
export const COL_CHAT_WHITELIST_ADMIN = `chat_whitelist_admin${SUFFIX}`;
export const COL_COLABORADORES = `colaboradores${SUFFIX}`;
/** Sub-colección dentro de un chat: días con mensajes (`dias/{ymd}`). */
export const COL_CHAT_DIAS = "dias";

// Docs conocidos dentro de /datos_web_new_version/
export const DOC_VENTAS_AC = "ventas_ac";
export const DOC_MENSAJES_AC = "mensajes_ac";
export const DOC_ARTICULOS_AC = "articulos_ac";
export const DOC_APARTADOS_AC = "apartados_ac";
export const DOC_EQUIPO = "equipoDeTrabajo";
export const DOC_TALLAS = "tallas";
export const DOC_TRANSFERENCIA = "transferencia_datos";
export const DOC_SWITCHES = "switches";
/** Doc con el PIN de protección de "Registros de venta" en nodo-web.
 *  Editable desde admin-web `/ventas`. Default "2121" cuando no existe. */
export const DOC_PIN_VENTAS = "pinVentas";
/** Doc que sirve como "señal" remota para que los nodos limpien su caché de
 *  renderizado (Service Worker + workbox-precache) y recarguen. Admin lo
 *  bumpea desde NodosPage; cada nodo guarda en localStorage la última
 *  huella vista y dispara limpieza+reload solo cuando detecta cambio.
 *  Shape: `{ huella: string, fecha: string, by?: string }`. */
export const DOC_REFRESCO_RENDER = "refrescoRender";

// Storage paths
export const STORAGE_MEDIA_ARTICULOS = `media${SUFFIX}/articulos`;

// ============================================================
// Builders de paths completos
// ============================================================
export const paths = {
  negocio: (nid: string) => `${COL_NEGOCIOS}/${nid}`,
  sucursal: (nid: string, sid: string) =>
    `${COL_NEGOCIOS}/${nid}/${COL_SUCURSALES}/${sid}`,
  nodo: (nid: string, nodoId: string) =>
    `${COL_NEGOCIOS}/${nid}/${COL_NODOS}/${nodoId}`,
  articulo: (nid: string, artId: string) =>
    `${COL_NEGOCIOS}/${nid}/${COL_ARTICULOS}/${artId}`,
  dato: (nid: string, docKey: string) =>
    `${COL_NEGOCIOS}/${nid}/${COL_DATOS}/${docKey}`,
  mensajesDia: (nid: string, y: string, m: string, d: string) =>
    `${COL_NEGOCIOS}/${nid}/${COL_MENSAJES}/${y}/${m}/${d}`,

  sucursalData: (nid: string, sid: string) =>
    `${COL_NEGOCIOS}/${nid}/${COL_SUCURSALES_DATA}/${sid}`,
  ventaDia: (nid: string, sid: string, y: string, m: string, d: string) =>
    `${COL_NEGOCIOS}/${nid}/${COL_SUCURSALES_DATA}/${sid}/${COL_VENTAS}/${y}/${m}/${d}`,
  ventaItem: (
    nid: string,
    sid: string,
    y: string,
    m: string,
    d: string,
    vid: string,
  ) =>
    `${COL_NEGOCIOS}/${nid}/${COL_SUCURSALES_DATA}/${sid}/${COL_VENTAS}/${y}/${m}/${d}/items/${vid}`,
  corteDia: (nid: string, sid: string, y: string, m: string, d: string) =>
    `${COL_NEGOCIOS}/${nid}/${COL_SUCURSALES_DATA}/${sid}/${COL_CORTES}/${y}/${m}/${d}`,
  apartado: (nid: string, sid: string, apId: string) =>
    `${COL_NEGOCIOS}/${nid}/${COL_SUCURSALES_DATA}/${sid}/${COL_APARTADOS}/${apId}`,
  contadorDia: (nid: string, sid: string, ymd: string) =>
    `${COL_NEGOCIOS}/${nid}/${COL_SUCURSALES_DATA}/${sid}/${COL_CONTADORES}/${ymd}`,
  usuarioMercancia: (nid: string, sid: string, uid: string) =>
    `${COL_NEGOCIOS}/${nid}/${COL_SUCURSALES_DATA}/${sid}/${COL_USUARIOS_MERCANCIA}/${uid}`,
  usuariosMercanciaCol: (nid: string, sid: string) =>
    `${COL_NEGOCIOS}/${nid}/${COL_SUCURSALES_DATA}/${sid}/${COL_USUARIOS_MERCANCIA}`,
  resurtido: (nid: string, rid: string) =>
    `${COL_NEGOCIOS}/${nid}/${COL_RESURTIDOS}/${rid}`,
  resurtidosCol: (nid: string) => `${COL_NEGOCIOS}/${nid}/${COL_RESURTIDOS}`,

  storageArticuloPrincipal: (artId: string, ext = "webp") =>
    `${STORAGE_MEDIA_ARTICULOS}/${artId}.${ext}`,
  /**
   * Path de imagen de subvariación. **Firma cambiada en Fase 1**:
   * el segundo argumento ahora es el `codigo` (`v-NN-XXX`), no el índice
   * del array. Esto hace el path estable ante reordenamiento del array.
   *
   * La Fase 4 mueve los archivos legacy `{artId}_sv{idx}.webp` al nuevo
   * path `{artId}_{codigo}.webp` durante la migración.
   */
  storageArticuloSubvariacion: (
    artId: string,
    codigo: string,
    ext = "webp",
  ) => `${STORAGE_MEDIA_ARTICULOS}/${artId}_${codigo}.${ext}`,
  /** Path legacy: usar solo durante migración Fase 4 (move source). */
  storageArticuloSubvariacionLegacy: (
    artId: string,
    idx: number,
    ext = "webp",
  ) => `${STORAGE_MEDIA_ARTICULOS}/${artId}_sv${idx}.${ext}`,
  categoria: (nid: string, cid: string) =>
    `${COL_NEGOCIOS}/${nid}/${COL_CATEGORIAS}/${cid}`,
  subcategoria: (nid: string, sid: string) =>
    `${COL_NEGOCIOS}/${nid}/${COL_SUBCATEGORIAS}/${sid}`,

  // ---------- Chat ----------
  /** Doc principal del grupo del nodo — contiene el `meta` (miembros,
   *  estadoPorMiembro, ultimoMensaje, etc.). Los mensajes viven en la
   *  sub-colección `dias`. */
  chatGrupoMeta: (nid: string, nodoId: string) =>
    `${COL_NEGOCIOS}/${nid}/${COL_CHAT_GRUPOS}/${nodoId}`,
  /** Doc del día (array de mensajes) en el grupo del nodo. */
  chatGrupoDia: (nid: string, nodoId: string, ymd: string) =>
    `${COL_NEGOCIOS}/${nid}/${COL_CHAT_GRUPOS}/${nodoId}/${COL_CHAT_DIAS}/${ymd}`,
  /** Sub-colección de días del grupo (para queries paginadas). */
  chatGrupoDiasCol: (nid: string, nodoId: string) =>
    `${COL_NEGOCIOS}/${nid}/${COL_CHAT_GRUPOS}/${nodoId}/${COL_CHAT_DIAS}`,

  /** Doc principal del chat directo — análogo al grupo. `pairId` =
   *  sort([idA, idB]).join("__"). */
  chatDirectoMeta: (nid: string, pairId: string) =>
    `${COL_NEGOCIOS}/${nid}/${COL_CHAT_DIRECTOS}/${pairId}`,
  chatDirectoDia: (nid: string, pairId: string, ymd: string) =>
    `${COL_NEGOCIOS}/${nid}/${COL_CHAT_DIRECTOS}/${pairId}/${COL_CHAT_DIAS}/${ymd}`,
  chatDirectoDiasCol: (nid: string, pairId: string) =>
    `${COL_NEGOCIOS}/${nid}/${COL_CHAT_DIRECTOS}/${pairId}/${COL_CHAT_DIAS}`,

  /** Doc de typing por chat. `chatId` = nodoId (grupo) o pairId (directo). */
  chatTyping: (nid: string, chatId: string) =>
    `${COL_NEGOCIOS}/${nid}/${COL_CHAT_TYPING}/${chatId}`,

  /** Whitelist de admin-delegados. `emailKey` = email normalizado. */
  chatWhitelistAdmin: (nid: string, emailKey: string) =>
    `${COL_NEGOCIOS}/${nid}/${COL_CHAT_WHITELIST_ADMIN}/${emailKey}`,
  chatWhitelistAdminCol: (nid: string) =>
    `${COL_NEGOCIOS}/${nid}/${COL_CHAT_WHITELIST_ADMIN}`,

  /** Doc de un colaborador. */
  colaborador: (nid: string, colaboradorId: string) =>
    `${COL_NEGOCIOS}/${nid}/${COL_COLABORADORES}/${colaboradorId}`,
  colaboradoresCol: (nid: string) =>
    `${COL_NEGOCIOS}/${nid}/${COL_COLABORADORES}`,
} as const;

// ============================================================
// Helpers de chat
// ============================================================

/**
 * Calcula el `pairId` determinístico para un chat directo entre dos
 * identidades. Garantiza el mismo id sin importar quién inicie:
 *   pairId("uidA", "uidB") === pairId("uidB", "uidA")
 *
 * Acepta cualquier tipo de identidad — uid, nodoId, colaboradorId.
 * Aunque por reglas de comunicación los nodos no participan en directos,
 * la función es agnóstica.
 */
export function chatPairId(idA: string, idB: string): string {
  if (idA === idB) {
    throw new Error(`chatPairId: ids iguales "${idA}"`);
  }
  return [idA, idB].sort().join("__");
}

/**
 * Normaliza un email para usarlo como id de doc Firestore. Firestore no
 * permite `/`, `.`, `*`, `[`, `]`, `~` en los segmentos del path; los
 * emails contienen `.` y `@` que necesitan reemplazo. Forma:
 *   "Foo.Bar+x@Example.com" → "foo_bar_plus_x_at_example_com"
 *
 * El reemplazo es determinístico y reversible si se necesitara, aunque
 * el caso de uso primario es lookup directo (no recuperar el original).
 */
export function emailKey(email: string): string {
  return email
    .trim()
    .toLowerCase()
    .replace(/\+/g, "_plus_")
    .replace(/@/g, "_at_")
    .replace(/\./g, "_");
}
