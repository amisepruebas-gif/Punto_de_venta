// ============================================================
// Esquemas TypeScript — docs Firestore
// ============================================================

// ---------- Negocio ----------
export type Negocio = {
  negocioId: string;
  nombre: string;
  email?: string;
  telefono?: string;
  plan: string;
  estado: "activo" | "suspendido" | "cancelado";
  fechaCreacion: string;
  limiteSucursales: number;
  limiteDispositivos: number;
  /**
   * Bandera de rollout para el esquema v2 de subvariaciones de artículos.
   * Default `false` (modo legacy: el padre es vendible y los codigos
   *   `v-NN-XXX` se ignoran en POS).
   * Cuando `true`: el POS rechaza el escaneo del padre cuando tiene
   *   variaciones, resuelve `v-NN-XXX` a la subvariación correspondiente,
   *   y persiste `subvariacionCodigo`/`subvariacionNombre` en cada venta.
   *
   * Se enciende per-negocio en la Fase 5 del plan de migración. Bajarla
   * a `false` revierte el comportamiento del POS al modo legacy sin
   * restart ni pérdida de datos.
   */
  usaSubvariacionesV2?: boolean;
  /** Id de la sucursal cuyo stock vive en `Articulo.cantidad` (legacy
   *  default). Las demás usan `Articulo.cantidadPorSucursal[sucId]`. Si
   *  está unset, el primer sucursalId alfabéticamente se trata como
   *  default — comportamiento de fallback. Se setea explícitamente cuando
   *  el admin agrega una segunda sucursal. */
  sucursalDefaultId?: string;
};

// ---------- Categoría / Subcategoría (universales por negocio) ----------
/**
 * Catálogo universal de categorías. Slug determinístico (`categoriaId`)
 * derivado del nombre normalizado para impedir duplicados.
 */
export type Categoria = {
  categoriaId: string;          // slug derivado de `nombre`
  nombre: string;               // único por negocio (case-insensitive)
  fechaCreacion: string;
};

/**
 * Subcategoría anidada bajo una categoría. Universales por negocio: una
 * subcategoría tiene un único nombre normalizado en todo el negocio.
 */
export type Subcategoria = {
  subcategoriaId: string;       // slug derivado de `nombre`
  nombre: string;               // único por negocio (case-insensitive)
  categoriaId: string;          // FK a la categoría padre
  fechaCreacion: string;
};

// ---------- Sucursal ----------
export type DatosTransferencia = {
  banco: string;
  cuenta: string; // CLABE / número de tarjeta receptora
  titular: string;
  referencia?: string;
  motivo?: string;
};

/**
 * Estilos disponibles para una línea del ticket. Mapean tanto a tags
 * ESC/POS de la lib DantSu como a fontSize/bold en pdfmake.
 */
export type TicketLineaEstilo = "normal" | "bold" | "big" | "small";
export type TicketLineaAlineacion = "left" | "center" | "right";

/**
 * Línea editable del ticket (encabezado o pie). El `id` es estable y
 * sirve como key en React + para reordenamiento.
 */
export type TicketLinea = {
  id: string;
  texto: string;
  estilo?: TicketLineaEstilo;
  alineacion?: TicketLineaAlineacion;
};

/**
 * Bloque opcional de código QR al final del ticket. `contenido` suele ser
 * una URL (Google Maps, redes sociales, encuesta de satisfacción, link de
 * pago) pero acepta cualquier texto. `leyenda` es un texto pequeño que
 * se imprime debajo del QR. Si `contenido` está vacío después del trim,
 * el QR se omite completamente.
 */
export type TicketQr = {
  contenido: string;
  leyenda?: string;
};

/**
 * Toggles para los metadatos automáticos del ticket (número, fecha,
 * vendedor). Cada flag es opcional: `undefined` o `true` → se imprime;
 * `false` → se omite. Default = todos visibles (preserva el comportamiento
 * pre-ticketConfig).
 */
export type TicketMostrar = {
  numeroTicket?: boolean;
  fecha?: boolean;
  vendedor?: boolean;
};

/**
 * Configuración del ticket por sucursal. Equivale al `datosTicket` del
 * Android nodo_1, pero flexible: el admin define cuántas líneas y con
 * qué estilo aparecen arriba (encabezado) y abajo (pie) de los items,
 * y opcionalmente un QR al cierre.
 *
 * Comportamiento de fallback en nodo-web:
 *   - `encabezado` ausente o vacío → se imprime el header automático
 *     con `nombre / direccion / telefono` de la sucursal.
 *   - `pie` ausente o vacío → se imprime el footer "¡Gracias por tu compra!".
 *   - `qr` ausente → no se imprime QR.
 *   - `mostrar.X !== false` → se imprime el dato automático correspondiente.
 */
export type TicketConfig = {
  encabezado?: TicketLinea[];
  pie?: TicketLinea[];
  qr?: TicketQr;
  mostrar?: TicketMostrar;
};

/** Helper para consultar los toggles con default = true. */
export function mostrarMetaTicket(
  cfg: TicketConfig | null | undefined,
  campo: keyof TicketMostrar,
): boolean {
  return cfg?.mostrar?.[campo] !== false;
}

export type Sucursal = {
  sucursalId: string;
  nombre: string;
  direccion: string;
  telefono?: string;
  fechaCreacion: string;
  createdBy: string; // nodoId o uid del creador
  activa: boolean;
  /** Cobrar comisión sobre pagos con tarjeta. Equivalente al toggle
   *  `cobrar_comision` del Android nodo_1. */
  cobrarComision?: boolean;
  /** Porcentaje (decimal). Android usa 0.04 hardcoded; aquí lo dejamos editable. */
  comisionTarjetaPct?: number;
  /** Datos editables desde admin-web; mostrados en nodo-web al elegir
   *  transferencia. Equivale al `transferencia_datos` SharedPreferences Android. */
  datosTransferencia?: DatosTransferencia;
  /** Configuración del ticket que entrega esta sucursal. Editable desde
   *  admin-web (`/sucursales/:sid/ticket`). Si está ausente, nodo-web
   *  imprime el ticket con el header/footer por defecto. */
  ticketConfig?: TicketConfig;
};

// ---------- Nodo (tablet) ----------
export type Nodo = {
  nodoId: string;
  sucursalId: string;
  nombre: string;
  registradoPor: string;
  fechaRegistro: string;
  userAgent: string;
  ultimoAcceso: string;
  estado: "activo" | "revocado";
  authUid?: string;
  historial?: Array<{
    tipo: "registro" | "rebind" | "revocado";
    fecha: string;
    userAgent: string;
    detalle?: string;
  }>;
  fcmToken?: string;
};

// ---------- Usuario (super admin / admin) ----------
export type Usuario = {
  uid: string;
  email: string;
  nombre: string;
  negocioId: string | null;
  role: "superadmin" | "admin" | "vendedor" | "nodo";
  estado: "activo" | "inactivo";
  createdAt: string;
};

// ---------- Artículo ----------
/**
 * Subvariación embebida dentro del artículo padre.
 *
 * El `codigo` `v-NN-XXX` es el identificador escaneable. Vive en el array
 * `subvariaciones` del padre y se genera al guardar (admin-web) o durante
 * la migración legacy (`migrarSubvariacionesLegacy`). El `codigo` es
 * opcional sólo en estados intermedios — al persistir en Firestore siempre
 * debe estar presente.
 *
 * El precio NO vive aquí: es único en el padre (`Articulo.precioVenta`)
 * y aplica a todas las variaciones.
 */
export type ArticuloSubvariacion = {
  /** Código escaneable propio. Forma: `v-{núcleo}-{rand3}`. */
  codigo?: string;
  nombre: string;
  /** Texto libre adicional (color, modelo, lote). */
  referencia?: string;
  imagenUrl?: string;
  /** Existencia individual en piso de tienda. Históricamente representa
   *  el stock total; convive con `cantidadBodega` cuando se separa el
   *  inventario en dos ubicaciones (tienda vs almacén). */
  cantidad?: string;
  /** Existencia individual en bodega/almacén. Opcional — si no aplica el
   *  sistema dual, vive todo en `cantidad`. */
  cantidadBodega?: string;
  /** Stock de esta subvariación por sucursal (sólo para sucursales NO
   *  default). El stock de la sucursal default vive en `cantidad`. Cuando
   *  se reciben resurtidos en una sucursal con id `sid`, suma a
   *  `cantidadPorSucursal[sid]` salvo que `sid` sea el `sucursalDefaultId`
   *  del negocio, en cuyo caso suma a `cantidad`. */
  cantidadPorSucursal?: { [sucursalId: string]: string };
  /** Precio con descuento de esta subvariación. Si está presente y > 0
   *  reemplaza al `Articulo.precioVenta` del padre para esta sub al
   *  cobrarse en el POS. `precioVenta` sigue siendo único en el padre —
   *  esta variación no puede tener un base distinto, solo un descuento
   *  propio. Resolución completa de precio: `resolverPrecioEfectivo` en
   *  `@shared`. */
  precioDescuento?: string;
  /** Historial de procesos sobre la imagen de esta subvariación
   *  (ej. "Quitar fondo" con Gemini). El último entry corresponde a la
   *  imagen actual; los anteriores son historial cuando se reemplaza. */
  imagenProcesos?: RegistroImagenProcesada[];
};

/**
 * Registro de un proceso aplicado a la imagen de un artículo o
 * subvariación. Usado para el tracking de costos del módulo
 * `/gastos-firebase/api-nanobanana`.
 */
export type RegistroImagenProcesada = {
  /** ISO 8601 con timezone (ej. "2026-04-27T14:32:05.123-06:00"). */
  fecha: string;
  /** Tipo de operación que generó el costo. */
  proceso: "nanobanana";
  /** Costo aproximado en USD según pricing oficial al momento del registro. */
  costoUsd: number;
  /** Costo aproximado en MXN al tipo de cambio aplicado. */
  costoMxn: number;
  /** Tipo de cambio USD→MXN aplicado para calcular `costoMxn`. */
  tipoCambio: number;
  /** URL final de la imagen resultante (después de subir a Storage). */
  imagenUrl?: string;
  /** UID de quien disparó el proceso (Firebase Auth). */
  uidUsuario?: string;
  /** Email/nombre legible (snapshot al momento — sobrevive si el usuario es
   *  borrado después). */
  emailUsuario?: string;
};

export type Articulo = {
  id: string; // secuencial desde 12300001
  nombre: string;
  sigla: string;
  referencia: string;
  codigo: string; // = id
  /** Existencia en piso de tienda. En artículos con subvariaciones es un
   *  snapshot informativo (suma de subvariaciones tienda). */
  cantidad: string;
  /** Existencia en bodega/almacén. Opcional. En artículos con
   *  subvariaciones es snapshot (suma de subvariaciones bodega). */
  cantidadBodega?: string;
  /** Stock por sucursal (sólo para sucursales NO default). Mismo criterio
   *  que `ArticuloSubvariacion.cantidadPorSucursal`. */
  cantidadPorSucursal?: { [sucursalId: string]: string };
  preciCompra: string; // typo histórico preservado
  precioVenta: string;
  utilidad: string;
  utilidadTotal: string;
  fecha: string; // "YYYY-MM-DD HH:mm:ss"
  imagenUrl?: string;

  // Catálogo universal (Fase 3 los puebla)
  /** FK a `Categoria.categoriaId`. Opcional. */
  categoriaId?: string;
  /** FK a `Subcategoria.subcategoriaId`. Requiere `categoriaId`. */
  subcategoriaId?: string;
  /** Tags libres por artículo (no universales). */
  etiquetas?: string[];

  // flags / promociones
  tallas?: string; // referencia al grupo en datos.tallas
  seña?: string; // presencia = true
  "3x2"?: string;
  mayoreo?: string;
  cantMayoreo?: string;
  /** Precio con descuento del artículo (aplica cuando no hay
   *  subvariaciones, o como descuento global del padre cuando una sub no
   *  define el suyo propio). Si está presente y > 0, reemplaza a
   *  `precioVenta` al cobrarse. Resolución completa de precio:
   *  `resolverPrecioEfectivo` en `@shared`. */
  precioDescuento?: string;
  /** LEGACY (pre-`precioDescuento`). Semántica histórica AMBIGUA:
   *  subtractivo en Android (`precio - descuento`), pero etiquetado
   *  "Descuento %" en mercancia-web vieja. Por seguridad
   *  `resolverPrecioEfectivo` NO lee este campo — datos legacy quedan
   *  inertes hasta que un admin los re-capture explícitamente en
   *  `precioDescuento` desde la UI (el form pre-llena el valor del
   *  legacy al cargar como ayuda visual). `articuloService` lo borra
   *  del doc en cada update. No introducir nuevas escrituras. */
  descuento?: string;
  promoBandera?: string;

  /**
   * Cuando `subvariaciones?.length > 0`, el `id` 8-dig del padre queda
   * inhabilitado al escaneo en POS (regla activa cuando
   * `Negocio.usaSubvariacionesV2 === true`). Las ventas se hacen con los
   * `codigo` `v-NN-XXX` de cada subvariación.
   */
  subvariaciones?: ArticuloSubvariacion[];

  /** Historial de procesos sobre la imagen principal del padre (ej.
   *  "Quitar fondo" con Gemini). El último entry corresponde a la imagen
   *  actual; los anteriores son historial cuando se reemplaza. */
  imagenProcesos?: RegistroImagenProcesada[];
};

// ---------- Venta ----------
export type VentaArticulo = {
  /** Siempre el id del padre (8 dígitos `123XXXXX`), aún cuando la venta
   *  llevó subvariación. Esto preserva la agrupación por artículo en
   *  reportes legacy. */
  id: string;
  cantidad: string;
  precio: string;
  nombrePublico: string;
  descripcion: string;
  talla?: string;
  seña?: string;
  descuento?: string;
  /** Código `v-NN-XXX` cuando la venta llevó subvariación. */
  subvariacionCodigo?: string;
  /** Nombre legible de la subvariación al momento de la venta (snapshot). */
  subvariacionNombre?: string;
  /** True cuando el cajero usó el botón "Otro" del VariacionPickerModal —
   *  es decir, vendió el padre con una variación que NO está documentada
   *  en el catálogo. El texto que escribió queda en `subvariacionNombre`
   *  (puede ser vacío) y NO hay `subvariacionCodigo`. Marca interna para
   *  reportes admin: permite distinguir variaciones libres de las que sí
   *  tienen código `v-NN-XXX` en el catálogo. */
  variacionLibre?: boolean;
  /** Snapshot de la URL de imagen (subvariación o padre) en el momento de la
   *  venta. Permite mostrar miniatura en el historial sin hacer lookups
   *  contra `articulos_n`. */
  imagenUrl?: string;
};

export type MovimientoPago =
  | "pagoEfectivo"
  | "pagoTransferencia"
  | "pagoTarjeta"
  | "pagoDividido";

export type Venta = {
  ventaId: string;
  numeroDeVenta: string;
  id_registro: string; // "YYYY MM DD"
  huella: string;
  enTurno: string;
  montoCobro: string;
  montoPago: string;
  cambio: string;
  movimiento: MovimientoPago;
  articulos: VentaArticulo[];
  apartado: "0" | "1";
  idApartado?: string;
  fecha: string; // "YYYY-MM-DD HH:mm:ss"
  fechaISO: string; // ISO 8601 estricto para queries
  datosPagoDividido?: Record<string, unknown>;

  negocioId: string; // necesario para collectionGroup queries admin
  nodoId: string;
  sucursalId: string;
  vendedorIdUsuario?: string;

  // Poblado por reconciliarVentasOffline cuando reconcilia un OFFLINE-
  numeroDeVentaOffline?: string;
  reconciliadoEn?: unknown; // Firestore Timestamp

  /** Comisión cobrada al cliente por pago con tarjeta. Equivale al campo
   *  `comicion` (sic) del Android nodo_1. Sin presencia o "0" = sin comisión. */
  comicion?: string;
  /** "con comision" | "sin comision" — replica el field Android. */
  statusComision?: string;

  /** Contraseña temporal de puntos a imprimir en el ticket (solo al vincular un
   *  cliente registrado a esta venta). No se persiste en Firestore. */
  codigoPuntos?: string;
  /** Puntos ganados en esta venta (informativo para el ticket). */
  puntosGanados?: string;
  /** Descuento aplicado por canje de puntos (pesos) — para el ticket/registro. */
  descuentoPuntos?: string;
  /** Cliente de puntos vinculado a la venta (auditoría). NO se guarda la
   *  contraseña temporal — es credencial. Se escriben vía updateDoc post-venta. */
  puntosClienteEmail?: string;
  puntosClienteTelefono?: string;
};

// ---------- Corte de caja ----------
export type EstadoCorte = "corte_iniciar" | "corte_enCurso" | "corte_finalizado";

export type Corte = {
  corteId: string;
  estado: EstadoCorte;
  idVenta_corte: string;
  nombre_corte: string;
  fecha_inicio: string;
  fecha_fin?: string;
  totalEfectivo: string;
  totalTransferencia: string;
  totalTarjeta: string;
  totalGeneral: string;
  /** Fondo de caja inicial al abrir el corte. Reportado APARTE en el
   *  resumen — NO modifica totalEfectivo ni totalGeneral, que siguen
   *  siendo suma de ventas del periodo. Default "0" cuando se omite. */
  fondoInicial?: string;
  negocioId?: string; // para queries admin
  nodoId: string;
  sucursalId: string;
  usuarioCreador: string;
};

// ---------- Mensaje ----------
export type Mensaje = {
  texto: string;
  hora: string; // "4:20:45 p. m."
  usuario: string;
  id: string; // nodoId o uid admin
  corte?: string;
  huella: string;
  nuevoDia?: string;
  inicioDeMes?: string;
  inicioAño?: string;
  sucursalId?: string;
  /** URL pública de Firebase Storage cuando el mensaje incluye una imagen.
   *  Se sube al path `mensajes_media/{negocioId}/{huella}.webp`. */
  imagenUrl?: string;
  /** Snapshot del usuario al que se está respondiendo (gesto swipe-right en
   *  el bubble citado). Mismos nombres que en la APK Android `pop_mensajes`. */
  replyEncabezado?: string;
  /** Texto citado del mensaje al que se responde (recortado si es muy largo). */
  replyTexto?: string;
  /** URL de imagen citada — cuando se responde a un mensaje que era imagen. */
  replyImagenUrl?: string;
};

// ---------- Apartado ----------
export type AbonoEstado = "pagado" | "pendiente";
export type AbonoTipo = "seña" | "abono" | "saldo";

export type Abono = {
  fecha: string;
  monto: number;
  estado: AbonoEstado;
  tipo: AbonoTipo;
  ventaId?: string;
};

export type EstadoApartado = "pendiente" | "parcial" | "completo" | "cancelado";

export type Apartado = {
  apartadoId: string;
  cliente: string;
  telefonoCliente?: string;
  articulos: Array<{
    id: string;
    cantidad: number;
    precio: number;
    nombre: string;
    /** FASE 3B — Código de subvariación cuando aplica. Permite reservar
     *  stock al nivel correcto (subvariación) y devolverlo al cancelar. */
    subvariacionCodigo?: string;
  }>;
  seña: number;
  totalApartado: number;
  abonos: Abono[];
  estado: EstadoApartado;
  fechaCreacion: string;
  sucursalId: string;
  nodoId: string;
  huella: string;
  /** FASE 3B — `true` cuando la creación del apartado descontó stock del
   *  catálogo. Apartados creados antes de Fase 3B tienen este campo
   *  ausente (ó `false`); su cancelación NO debe re-incrementar stock. */
  stockReservado?: boolean;
};

// ---------- Equipo de trabajo ----------
export type EquipoDeTrabajoItem = {
  nombre: string;
  idUsuario: string;
  admin?: string; // presencia = true
  estado?: "activo" | "inactivo";
};

// ---------- Contador de numeración ----------
export type ContadorDia = {
  ultimoNumeroVenta: number;
  ultimoNumeroCorte?: number;
};

// ---------- Claims de auth ----------
export type AuthClaims = {
  role: "superadmin" | "admin" | "vendedor" | "nodo" | "mercancia";
  negocioId?: string;
  sucursalId?: string;
  nodoId?: string;
  /** Para usuarios `mercancia-web`: id del doc en
   *  `usuariosMercancia_web_new_version`. */
  mercanciaUid?: string;
};

// ---------- Resurtido (transferencia bodega → sucursal) ----------
/**
 * Estados del documento de resurtido. Per-resurtido, no per-línea.
 *
 *  - `creando`     — el operador está armando la lista. NO toca stock.
 *  - `en_transito` — la caja salió. Decrementa `cantidadBodega` por la
 *                    suma de `lineas[].cantidadEnviada`.
 *  - `recibido`    — la caja llegó al destino. NO toca stock todavía
 *                    (sólo registra responsable).
 *  - `cerrado`     — el operador del destino confirmó pieza por pieza.
 *                    Cada `linea.disposicion.tienda` se SUMA al stock
 *                    de la sucursal destino. `dañado` y `perdido`
 *                    quedan documentados pero no entran a ningún stock
 *                    (efecto neto: salida desde bodega sin contraparte).
 */
export type ResurtidoEstado = "creando" | "en_transito" | "recibido" | "cerrado";

/**
 * Cómo se distribuyó cada línea al cerrar el resurtido. La suma debe
 * igualar `cantidadEnviada`. Sólo se llena cuando el resurtido está en
 * estado `cerrado`.
 */
export type ResurtidoDisposicion = {
  /** Llegaron en buen estado y entran al stock de la sucursal destino. */
  tienda: number;
  /** Llegaron rotas/inservibles. No entran al stock. Reportable. */
  dañado: number;
  /** No llegaron físicamente. No entran al stock. Reportable. */
  perdido: number;
};

export type ResurtidoLinea = {
  /** Id 8-dig del padre. */
  articuloId: string;
  /** Codigo `v-NN-XXX` cuando aplica. Si está, el stock se mueve sobre la
   *  subvariación; si no, sobre el padre. */
  subvariacionCodigo?: string;
  /** Snapshot del nombre legible al momento de crear el resurtido —
   *  preserva el reporte aunque el catálogo cambie nombres después. */
  nombreSnapshot: string;
  /** Snapshot de la sigla (mejora UX en listas históricas). */
  siglaSnapshot?: string;
  /** Cantidad enviada desde bodega. Decrementada de `cantidadBodega` al
   *  pasar el resurtido a `en_transito`. */
  cantidadEnviada: number;
  /** Sólo presente cuando estado === "cerrado". */
  disposicion?: ResurtidoDisposicion;
  /** Notas libres por línea (ej. "venían 3 pero llegaron 2 — falta 1"). */
  notas?: string;
};

export type Resurtido = {
  /** Id del doc en `negocios_web_new_version/{nid}/resurtidos_web_new_version/{id}`. */
  id: string;
  estado: ResurtidoEstado;
  /** Sucursal a la que se le envía. */
  sucursalDestinoId: string;
  /** Snapshot del nombre de la sucursal destino al crear. */
  sucursalDestinoNombre: string;
  fechaCreacion: string; // ISO 8601 con timezone MX
  fechaEnTransito?: string;
  fechaRecibido?: string;
  fechaCerrado?: string;
  /** Nombre del operador que armó/empacó el resurtido (texto libre). */
  responsableEmpaco: string;
  /** Nombre del operador que físicamente trasladó la caja. Se llena al
   *  pasar a `en_transito`. */
  responsableTraslado?: string;
  /** Nombre del operador del destino que recibió la caja. Se llena al
   *  pasar a `recibido`. (Ingresa típicamente desde nodo-web.) */
  responsableRecibe?: string;
  /** Operador que cerró el resurtido confirmando la disposición pieza por
   *  pieza. */
  responsableConfirma?: string;
  lineas: ResurtidoLinea[];
  /** Notas globales del resurtido. */
  notas?: string;
};

// ---------- mercancia-web ----------
/**
 * Usuario con PIN de 5 dígitos para entrar a `mercancia-web`. Scope por
 * sucursal: dos sucursales pueden tener PINs idénticos sin conflicto. Vive
 * en `negocios_web_new_version/{nid}/sucursales_data_web_new_version/{sid}/usuariosMercancia_web_new_version/{uid}`.
 *
 * El PIN no se persiste en plano: solo `pinHash` (SHA-256 + salt). En
 * desarrollo el salt es global; al cerrar reglas se puede mover a una CF
 * con salt por documento. El admin puede cambiar el PIN desde el dashboard;
 * el usuario nunca ve el hash.
 */
export type UsuarioMercancia = {
  /** Auto-generado al crear; sirve como segmento del path. */
  id: string;
  nombre: string;
  /** Hash del PIN. Ver `lib/pinHash` en cada cliente — algoritmo idéntico. */
  pinHash: string;
  /** `false` deshabilita el login sin borrar el registro. */
  habilitado: boolean;
  fechaCreacion: string; // ISO 8601
  /** Email/uid del admin que lo creó (snapshot). */
  creadoPor?: string;
  /** Última fecha de modificación (cambio de PIN, toggle, etc.). */
  fechaActualizacion?: string;
};

// ============================================================
// Chat — ver docs/14-chat-arquitectura.md
// ============================================================

/**
 * Tipo del remitente de un mensaje de chat. Determina cómo se resuelve el
 * `remitenteId`:
 *  - "admin": uid de Firebase Auth (cubre admin-real y admin-delegado).
 *  - "nodo": nodoId emitido por `fnRegistrarNodo`.
 *  - "colaborador": colaboradorId del doc en `colaboradores_w`.
 */
export type ChatRemitenteTipo = "admin" | "nodo" | "colaborador";

/**
 * Tipo de chat. `grupo` = grupo del nodo (admin-real + admin-delegado* +
 * nodo + colaboradores habilitados). `directo` = 1-a-1 entre cualquier
 * par de {admin-real, admin-delegado, colaborador}.
 */
export type ChatTipo = "grupo" | "directo";

/**
 * Mensaje individual dentro del array `mensajes` de un día. La unidad de
 * persistencia es el doc del día (`dias/{ymd}`); cada mensaje se agrega
 * con `arrayUnion`.
 */
export type ChatMensaje = {
  /** Id único del mensaje (timestamp + rand). Estable. */
  huella: string;
  /** Id del remitente — uid, nodoId o colaboradorId según `remitenteTipo`. */
  remitenteId: string;
  remitenteTipo: ChatRemitenteTipo;
  /** Snapshot del nombre del remitente al momento del envío. */
  remitenteNombre: string;
  /** ISO 8601 con timezone MX (estable, ordenable). */
  fechaISO: string;
  /** Texto plano (incluye emojis Unicode). Vacío si es sólo media. */
  texto: string;

  // Imagen — opcional, sólo cuando hay media
  /** URL de descarga de Firebase Storage. */
  mediaUrl?: string;
  mediaFileName?: string;
  /** Bytes. */
  mediaSize?: number;

  // Reply con cita — snapshot del mensaje citado al momento del envío
  replyHuella?: string;
  replyRemitenteNombre?: string;
  /** Texto recortado del mensaje citado (max ~120 chars). */
  replyTexto?: string;
  /** Sólo si el mensaje citado era una imagen. */
  replyImagenUrl?: string;
};

/**
 * Estado de lectura de un miembro respecto al chat. Se actualiza desde el
 * cliente del propio miembro al abrir/recibir mensajes. Las rules
 * permiten que cada miembro escriba sólo su propio entry.
 */
export type EstadoMiembroChat = {
  /** Huella del último mensaje cuya página de día se ha cargado en el
   *  cliente del miembro (≈ "delivered"). */
  ultimoMensajeEntregado?: string;
  /** Huella del último mensaje leído (al abrir el chat con foco). */
  ultimoMensajeLeido?: string;
  /** ISO 8601 — última vez que el miembro abrió este chat. Es el campo de
   *  telemetría que los admins consultan. */
  ultimaApertura: string;
};

/**
 * Doc `meta` de un chat (grupo o directo). Vive en
 *   chat_grupos_w/{nodoId}/meta              o
 *   chat_directos_w/{pairId}/meta
 */
export type ChatMeta = {
  chatId: string;
  tipo: ChatTipo;

  /** Lista mutable de IDs de miembros (uids/admin, nodoId, colaboradorIds). */
  miembros: string[];

  /** Sólo para tipo="grupo": id del nodo dueño del grupo. */
  nodoId?: string;
  /** Sólo para tipo="grupo": colaboradoresIds habilitados a participar. */
  colaboradoresHabilitados?: string[];

  /** Sólo para tipo="directo": tupla ordenada alfabéticamente. */
  pairIds?: [string, string];

  /** Estado por miembro. Map { memberId: EstadoMiembroChat }. */
  estadoPorMiembro: { [memberId: string]: EstadoMiembroChat };

  /** Snapshot del último mensaje para listar chats con preview sin leer
   *  el día completo. */
  ultimoMensaje?: {
    huella: string;
    /** Texto recortado para preview (max ~120 chars). */
    textoPreview: string;
    fechaISO: string;
    remitenteId: string;
    remitenteNombre: string;
    /** Si fue media, true para mostrar "📷 Imagen" en lugar de texto. */
    esMedia?: boolean;
  };

  fechaCreacion: string;
  /** Última actividad — actualizada en cada mensaje nuevo. */
  fechaActividad: string;
};

/**
 * Doc del día con el array de mensajes. Path:
 *   chat_grupos_w/{nodoId}/dias/{ymd}      ymd = "YYYYMMDD"
 *   chat_directos_w/{pairId}/dias/{ymd}
 */
export type ChatDia = {
  /** "YYYYMMDD" del día (zona horaria MX). */
  ymd: string;
  mensajes: ChatMensaje[];
};

/**
 * Indicador de escritura. Doc en
 *   chat_typing_w/{chatId}
 * con map { memberId: epochMs }. Cliente debounce: escribe cada >3s,
 * ignora entries con timestamp >6s.
 */
export type ChatTyping = {
  [memberId: string]: number;
};

// ---------- Whitelist de admin-delegados ----------
/**
 * Entry en `chat_whitelist_admin_w/{emailKey}`. `emailKey` = email
 * normalizado (lowercase, `.` → `_`, `@` → `_at_`) para que sea válido
 * como id de doc Firestore. Al hacer login con Google, una CF (o las
 * rules) verifica que el email del usuario tenga doc en esta colección
 * antes de elevar el rol a `admin`.
 */
export type AdminWhitelistEntry = {
  /** Email original normalizado a lowercase. */
  email: string;
  fechaAgregado: string;
  /** Uid o email del admin que lo agregó (snapshot). */
  agregadoPor: string;
  /** Se llena cuando el delegado hace su primer login con Google. */
  uid?: string;
  ultimoLogin?: string;
  /** `false` deshabilita sin borrar el registro. */
  habilitado: boolean;
};

// ---------- Colaborador (id-colaborador) ----------
/**
 * Usuario de chat sin permisos admin. Auth via username + password
 * generados por el admin. El password no se persiste en plano: sólo
 * `passwordHash` (SHA-256 + salt). Al login una CF valida el hash y emite
 * un Firebase Custom Token con `role: "colaborador"`.
 *
 * Vive en `negocios_w/{nid}/colaboradores_w/{colaboradorId}`.
 */
export type Colaborador = {
  colaboradorId: string;
  /** Único por negocio (case-insensitive). */
  username: string;
  /** Display name visible en el chat. Puede coincidir con `username`. */
  nombre: string;
  passwordHash: string;
  habilitado: boolean;
  fechaCreacion: string;
  /** Uid del admin que lo creó (snapshot). */
  creadoPor: string;
  ultimoLogin?: string;
  fechaActualizacion?: string;
};
