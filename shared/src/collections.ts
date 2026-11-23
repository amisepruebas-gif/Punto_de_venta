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
/** Géneros (temáticas: Anime, K-pop…). Universales por negocio, aparte de
 *  las categorías. El campo del artículo es `generoId` (no `genero`: ese
 *  nombre es del legacy y lo borran/convierten las functions de migración). */
export const COL_GENEROS = `generos${SUFFIX}`;

// Sub-colecciones bajo /sucursales_data_web_new_version/{sucursalId}/
export const COL_VENTAS = `ventas_n${SUFFIX}`;
export const COL_CORTES = `corte_1${SUFFIX}`;
export const COL_APARTADOS = `apartados${SUFFIX}`;
export const COL_CONTADORES = `contadores${SUFFIX}`;
/** Usuarios con PIN para entrar a `mercancia-web`. Scope por sucursal. */
export const COL_USUARIOS_MERCANCIA = `usuariosMercancia${SUFFIX}`;

/** Resurtidos (transferencias bodega → sucursal). Scope por negocio. */
export const COL_RESURTIDOS = `resurtidos${SUFFIX}`;
/** Accesos por URL para armar lotes o subir sus fotos. Scope por negocio. */
export const COL_ENLACES_LOTE = `enlaces_lote${SUFFIX}`;
/** Etiquetas numeradas ya usadas (id = código): una etiqueta, un lote. */
export const COL_ETIQUETAS_LOTE = `etiquetas_lote${SUFFIX}`;
/** Sub-colección de un lote con sus fotos. */
export const COL_LOTE_FOTOS = `fotos${SUFFIX}`;
/** Impresoras de etiquetas (una por PC vinculada; id = id de su acceso). */
export const COL_IMPRESORAS = `impresoras${SUFFIX}`;
/** Cola de impresión de etiquetas. Scope por negocio. */
export const COL_IMPRESIONES = `impresiones${SUFFIX}`;

// Fabricación — scope por negocio.
/** Zonas de precios (precio normal + escalones de mayoreo compartidos). */
export const COL_ZONAS_PRECIO = `zonas_precio${SUFFIX}`;
/** Lotes de producción de mercancía propia. Inmutables. */
export const COL_PRODUCCION = `produccion${SUFFIX}`;
/** Reducciones manuales de inventario con motivo. Inmutables. */
export const COL_AJUSTES_INVENTARIO = `ajustes_inventario${SUFFIX}`;

// Cashback de mayoreo (propio de la tienda, sin amise.mx) — ver
// shared/src/cashbackMayoreo.ts. Scope por negocio.
/** Configuración (doc `config`): la lee la caja, la escribe admin. */
export const COL_CASHBACK_MAYOREO = `cashback_mayoreo${SUFFIX}`;
/** Cuentas por teléfono (id = 10 dígitos). Solo las escribe el servidor. */
export const COL_CLIENTES_MAYOREO = `clientes_mayoreo${SUFFIX}`;
/** Movimientos de una cuenta (sub-colección). */
export const COL_MOVIMIENTOS_CASHBACK = "movimientos";
/** Índices únicos: tarjeta (13 dígitos) y QR (token) → teléfono. Cerrados. */
export const COL_TARJETAS_MAYOREO = `tarjetas_mayoreo${SUFFIX}`;
export const COL_QR_MAYOREO = `qr_mayoreo${SUFFIX}`;
/** Sesiones de la página del cliente e intentos de PIN. Cerrados. */
export const COL_CASHBACK_SESIONES = `cashback_sesiones${SUFFIX}`;
export const COL_CASHBACK_INTENTOS = `cashback_intentos${SUFFIX}`;

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
/** Contador del folio de lotes de producción (`FAB-000001`). Shape:
 *  `{ ultimo: number }`. Solo admin lo escribe (regla dedicada). */
export const DOC_CONTADOR_FABRICACION = "_contadorFabricacion";
/** Contador de las etiquetas numeradas de lote. Shape: `{ ultimo: number }`.
 *  Solo admin lo escribe (regla dedicada). */
export const DOC_CONTADOR_ETIQUETAS_LOTE = "_contadorEtiquetasLote";

// Storage paths
export const STORAGE_MEDIA_ARTICULOS = `media${SUFFIX}/articulos`;
/** Fotos de lotes: `{raíz}/{negocioId}/{resurtidoId}/{archivo}`. */
export const STORAGE_MEDIA_LOTES = `lotes_media${SUFFIX}`;

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
  /** Cobro con la terminal Clip de una venta (lo escriben solo las CF). */
  pagoClip: (nid: string, sid: string, cobroId: string) =>
    `${COL_NEGOCIOS}/${nid}/${COL_SUCURSALES_DATA}/${sid}/pagos_clip_web_new_version/${cobroId}`,
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
  enlaceLote: (nid: string, enlaceId: string) =>
    `${COL_NEGOCIOS}/${nid}/${COL_ENLACES_LOTE}/${enlaceId}`,
  enlacesLoteCol: (nid: string) => `${COL_NEGOCIOS}/${nid}/${COL_ENLACES_LOTE}`,
  etiquetaLote: (nid: string, codigo: string) =>
    `${COL_NEGOCIOS}/${nid}/${COL_ETIQUETAS_LOTE}/${codigo}`,
  impresora: (nid: string, impresoraId: string) =>
    `${COL_NEGOCIOS}/${nid}/${COL_IMPRESORAS}/${impresoraId}`,
  impresorasCol: (nid: string) => `${COL_NEGOCIOS}/${nid}/${COL_IMPRESORAS}`,
  impresion: (nid: string, trabajoId: string) =>
    `${COL_NEGOCIOS}/${nid}/${COL_IMPRESIONES}/${trabajoId}`,
  impresionesCol: (nid: string) => `${COL_NEGOCIOS}/${nid}/${COL_IMPRESIONES}`,
  loteFoto: (nid: string, rid: string, fotoId: string) =>
    `${COL_NEGOCIOS}/${nid}/${COL_RESURTIDOS}/${rid}/${COL_LOTE_FOTOS}/${fotoId}`,
  loteFotosCol: (nid: string, rid: string) =>
    `${COL_NEGOCIOS}/${nid}/${COL_RESURTIDOS}/${rid}/${COL_LOTE_FOTOS}`,
  /** Archivo de una foto de lote en Storage. `fotoId` = `{uid}_{00..29}`. */
  storageLoteFoto: (nid: string, rid: string, fotoId: string, ext = "webp") =>
    `${STORAGE_MEDIA_LOTES}/${nid}/${rid}/${fotoId}.${ext}`,

  zonaPrecio: (nid: string, zid: string) =>
    `${COL_NEGOCIOS}/${nid}/${COL_ZONAS_PRECIO}/${zid}`,
  configCashbackMayoreo: (nid: string) =>
    `${COL_NEGOCIOS}/${nid}/${COL_CASHBACK_MAYOREO}/config`,
  clienteMayoreo: (nid: string, tel: string) =>
    `${COL_NEGOCIOS}/${nid}/${COL_CLIENTES_MAYOREO}/${tel}`,
  clientesMayoreoCol: (nid: string) => `${COL_NEGOCIOS}/${nid}/${COL_CLIENTES_MAYOREO}`,
  movimientosCashback: (nid: string, tel: string) =>
    `${COL_NEGOCIOS}/${nid}/${COL_CLIENTES_MAYOREO}/${tel}/${COL_MOVIMIENTOS_CASHBACK}`,
  zonasPrecioCol: (nid: string) => `${COL_NEGOCIOS}/${nid}/${COL_ZONAS_PRECIO}`,
  lote: (nid: string, loteId: string) =>
    `${COL_NEGOCIOS}/${nid}/${COL_PRODUCCION}/${loteId}`,
  produccionCol: (nid: string) => `${COL_NEGOCIOS}/${nid}/${COL_PRODUCCION}`,
  ajuste: (nid: string, ajusteId: string) =>
    `${COL_NEGOCIOS}/${nid}/${COL_AJUSTES_INVENTARIO}/${ajusteId}`,
  ajustesCol: (nid: string) =>
    `${COL_NEGOCIOS}/${nid}/${COL_AJUSTES_INVENTARIO}`,

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
  genero: (nid: string, gid: string) =>
    `${COL_NEGOCIOS}/${nid}/${COL_GENEROS}/${gid}`,
  generosCol: (nid: string) => `${COL_NEGOCIOS}/${nid}/${COL_GENEROS}`,

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
