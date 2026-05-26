# Firestore Schema

> **Cuándo usar este doc**: al necesitar el contrato exacto de algún
> documento, al diseñar una query nueva, o al tocar las reglas.

## Índice

1. [Convención `_web_new_version`](#convención-_web_new_version)
2. [Árbol completo de Firestore](#árbol-completo)
3. [Tipos por colección](#tipos-por-colección)
4. [Reglas de seguridad](#reglas-de-seguridad)
5. [Índices compuestos](#índices-compuestos)
6. [Storage paths](#storage-paths)

---

## Convención `_web_new_version`

Todas las colecciones creadas por las apps web llevan el sufijo
`_web_new_version` para aislar del namespace Android legacy.

Ejemplos:

| Legacy (Android, read-only) | Nuevo (web) |
|---|---|
| `articulos_n/{id}` | `negocios_web_new_version/{nid}/articulos_n_web_new_version/{id}` |
| `ventas_n/{y}/{m}/{d}` | `negocios_w.../sucursales_data_w/{sid}/ventas_n_w/{y}/{m}/{d}/items/{vid}` |
| `mensajes_n/{y}/{m}/{d}` | `negocios_w/{nid}/mensajes_n_w/{y}/{m}/{d}` |
| `corte_1/{y}/{m}/{d}` | `negocios_w/{nid}/sucursales_data_w/{sid}/corte_1_w/{y}/{m}/{d}/items/{cid}` |

Los valores reales tipo `COL_VENTAS = "ventas_n_web_new_version"` están en
`shared/src/collections.ts`. Usa los builders `paths.*` en vez de concatenar
a mano.

---

## Árbol completo

```
/planes/{planId}                                          ← planes de suscripción (SuperAdmin)
/usuarios/{uid}                                           ← perfil de usuarios admin
/negocios_web_new_version/{negocioId}                     ← doc raíz negocio
   ├── /sucursales_web_new_version/{sucursalId}          ← metadata sucursal
   ├── /nodos_web_new_version/{nodoId}                   ← tablets registradas
   ├── /articulos_n_web_new_version/{articuloId}         ← CATÁLOGO ÚNICO del negocio
   ├── /datos_web_new_version/{docKey}                   ← config, equipo, tallas, huellas
   │   ├── equipoDeTrabajo       { uid: {nombre, idUsuario, admin?, estado} }
   │   ├── tallas                { nombreGrupo: [string[]] }
   │   ├── transferencia_datos   { banco, tarjeta, referencia, titular }
   │   ├── articulos_ac          { huella } (trigger sync)
   │   ├── mensajes_ac           { huella_mensaje } (trigger sync)
   │   ├── ventas_ac             { huella_venta } (trigger sync)
   │   ├── apartados_ac          { huella_apartado } (trigger sync)
   │   ├── _contadorArticulos    { ultimoId } (ID secuencial artículos)
   │   └── _migracionesLegacy    { [timestamp]: { ejecutadoPor, resumen } }
   │
   ├── /mensajes_n_web_new_version/{y}/{m}/{d}           ← chat general del negocio
   │   (doc con array `mensajes`)
   │
   └── /sucursales_data_web_new_version/{sucursalId}
       ├── /ventas_n_web_new_version/{y}/{m}/{d}/items/{ventaId}  ← doc-por-venta
       ├── /corte_1_web_new_version/{y}/{m}/{d}/items/{corteId}   ← doc-por-corte
       ├── /apartados_web_new_version/{apartadoId}
       └── /contadores_web_new_version/{YYYY-MM-DD}       ← contador atómico día
            ( { ultimoNumeroVenta, ultimoNumeroCorte } )
```

Notas de paths:

- Los años/meses/días NO llevan padding: `2026/3/15` (no `2026/03/15`).
  Decisión heredada del schema Android.
- El `contadorDia` SÍ lleva padding (`2026-03-15`) porque es un doc ID.

---

## Tipos por colección

Los tipos TS canónicos están en `shared/src/schema.ts`. Aquí se muestran
condensados + notas.

### `Negocio`

```ts
type Negocio = {
  negocioId: string;
  nombre: string;              // "Amise"
  email?: string;
  telefono?: string;
  plan: string;                // "basico"
  estado: "activo" | "suspendido" | "cancelado";
  fechaCreacion: string;       // Server escribe Timestamp; types dicen string (TODO)
  limiteSucursales: number;
  limiteDispositivos: number;
};
```

### `Sucursal`

```ts
type Sucursal = {
  sucursalId: string;
  nombre: string;              // "Tienda Centro"
  direccion: string;
  telefono?: string;
  fechaCreacion: string;       // Timestamp
  createdBy: string;           // "first-run" si viene de registrarNodo; uid si de admin
  activa: boolean;
};
```

`useSucursales` lista todas; `listarSucursales` CF filtra `activa == true`
para el selector del first-run.

### `Nodo`

```ts
type Nodo = {
  nodoId: string;
  sucursalId: string;
  nombre: string;              // "Caja 1"
  registradoPor: string;       // nombre humano capturado en el form
  fechaRegistro: string;       // Timestamp
  userAgent: string;
  ultimoAcceso: string;        // Timestamp
  estado: "activo" | "revocado";
  authUid?: string;            // UID Firebase Auth vinculado
  historial?: Array<{
    tipo: "registro" | "rebind" | "revocado";
    fecha: string;             // ISO
    userAgent: string;
    detalle?: string;
  }>;
  fcmToken?: string;           // (no implementado aún)
};
```

### `Articulo`

ID secuencial desde `"12300001"` — preservado del legacy Android.

```ts
type Articulo = {
  id: string;                  // "12300001"
  nombre: string;
  sigla: string;               // única, 2-6 chars
  referencia: string;
  codigo: string;              // = id
  cantidad: string;            // stock global del negocio
  preciCompra: string;         // typo histórico preservado
  precioVenta: string;
  utilidad: string;
  utilidadTotal: string;
  genero?: string;
  subgenero?: string;
  hashtags?: string;
  fecha: string;               // "YYYY-MM-DD HH:mm:ss"
  imagenUrl?: string;          // URL Storage Download

  tallas?: string;             // referencia al grupo en datos.tallas
  seña?: string;               // presencia = true (acepta seña/apartado)
  "3x2"?: string;              // presencia = true
  mayoreo?: string;
  cantMayoreo?: string;
  descuento?: string;
  promoBandera?: string;

  subvariaciones?: Array<{
    id: number;                // índice en array
    nombre: string;
    imagenUrl?: string;
  }>;
};
```

### `Venta`

```ts
type Venta = {
  ventaId: string;             // = huella, idempotente
  numeroDeVenta: string;       // secuencial del día (o "OFFLINE-xxx-ts")
  id_registro: string;         // "YYYY MM DD" (con espacios, legacy)
  huella: string;              // timestamp concatenado con ms + random
  enTurno: string;             // nombre del vendedor
  montoCobro: string;
  montoPago: string;
  cambio: string;
  movimiento: "pagoEfectivo" | "pagoTransferencia" | "pagoTarjeta" | "pagoDividido";
  articulos: Array<{
    id: string;
    cantidad: string;
    precio: string;
    nombrePublico: string;
    descripcion: string;
    talla?: string;
    seña?: string;
    descuento?: string;
  }>;
  apartado: "0" | "1";
  idApartado?: string;
  fecha: string;               // "YYYY-MM-DD HH:mm:ss" MX
  fechaISO: string;            // ISO 8601 estricto — usado para queries admin
  datosPagoDividido?: { efectivo, transferencia, tarjeta };

  negocioId: string;           // necesario para collectionGroup queries admin
  nodoId: string;
  sucursalId: string;
  vendedorIdUsuario?: string;

  // Poblados por reconciliarVentasOffline
  numeroDeVentaOffline?: string;
  reconciliadoEn?: Timestamp;
};
```

### `Corte`

```ts
type Corte = {
  corteId: string;
  estado: "corte_enCurso" | "corte_finalizado";
  idVenta_corte: string;       // apunta a numeroDeVenta al cerrar
  nombre_corte: string;        // "Corte mañana"
  fecha_inicio: string;        // "YYYY-MM-DD HH:mm:ss" MX
  fecha_fin?: string;
  totalEfectivo: string;
  totalTransferencia: string;
  totalTarjeta: string;
  totalGeneral: string;
  negocioId?: string;          // para queries admin (Fase 5)
  nodoId: string;
  sucursalId: string;
  usuarioCreador: string;
};
```

### `Mensaje`

```ts
type Mensaje = {
  texto: string;
  hora: string;                // "4:20:45 p. m." MX
  usuario: string;
  id: string;                  // nodoId (vendedor) o "admin_" + uid (admin)
  corte?: string;              // referencia corte si aplica
  huella: string;
  nuevoDia?: string;           // flag protocolo — solo en primer mensaje del día
  inicioDeMes?: string;
  inicioAño?: string;
  sucursalId?: string;         // desde qué sucursal se envió
};
```

Escritura atómica: siempre `setDoc(ref, { mensajes: arrayUnion(msg) }, { merge: true })`.
`arrayUnion` + `merge: true` sirve tanto para crear el doc (primer mensaje
del día) como para append subsiguientes, sin race conditions.

### `Apartado`

```ts
type Apartado = {
  apartadoId: string;
  cliente: string;
  telefonoCliente?: string;
  articulos: Array<{ id, cantidad: number, precio: number, nombre: string }>;
  seña: number;
  totalApartado: number;
  abonos: Array<{
    fecha: string;             // ISO MX
    monto: number;
    estado: "pagado" | "pendiente";
    tipo: "seña" | "abono" | "saldo";
    ventaId?: string;
  }>;
  estado: "pendiente" | "parcial" | "completo" | "cancelado";
  fechaCreacion: string;
  sucursalId: string;
  nodoId: string;
  huella: string;
};
```

### `EquipoDeTrabajoItem`

Vive dentro del doc `datos_w/equipoDeTrabajo` como map:

```ts
// Doc field shape:
{
  [idUsuario: string]: {
    nombre: string;
    idUsuario: string;
    admin?: string;            // presencia = true (flag de admin)
    estado?: "activo" | "inactivo";
  }
}
```

**Nota crítica**: para quitar el flag `admin` se usa `deleteField()`, no
`undefined` (Firestore con `ignoreUndefinedProperties: true` ignora undefined
— documentado en [`09-deuda-tecnica.md`](09-deuda-tecnica.md) fix E1).

### `ContadorDia`

```ts
type ContadorDia = {
  ultimoNumeroVenta: number;
  ultimoNumeroCorte?: number;
  actualizado: Timestamp;
};
```

Path: `.../contadores_web_new_version/{YYYY-MM-DD}`. Usado en transacciones
atómicas de `ventaService.crearVenta()` y `corteService.iniciarCorte()`.

---

## Reglas de seguridad

Archivo: `firestore.rules`. Helpers al inicio:

```
function isAuthenticated()  = request.auth != null
function isSuperAdmin()     = role == 'superadmin'
function isBusinessMember(negocioId) = negocioId coincide en token
function isBusinessAdmin(negocioId)  = miembro + role in ['admin', 'superadmin']
function isNodo(negocioId, sucursalId) = role=='nodo' + negocioId+sucursalId coinciden
function isAnyNodo(negocioId) = role=='nodo' + negocioId coincide (sin requerir sucursal)
```

### Colecciones globales

```
/planes/{planId}            read auth; write superadmin
/usuarios/{uid}             read superadmin o propio uid; write superadmin
```

### Negocio y sub-colecciones

```
/negocios_web_new_version/{negocioId}
  read: superadmin OR businessMember OR anyNodo
  write: superadmin (escritura del doc raíz restringida)

  /sucursales_web_new_version/{sucursalId}
    read: superadmin OR businessMember OR anyNodo
    write: superadmin OR businessAdmin      ← solo admin/superadmin
    (los nodos no crean sucursales desde cliente; va via CF registrarNodo con Admin SDK)

  /nodos_web_new_version/{nodoId}
    read: superadmin OR businessMember OR anyNodo
    update: el propio nodo puede escribir ULTIMO_ACCESO y USER_AGENT
    create/delete: solo CF (con Admin SDK)

  /articulos_n_web_new_version/{artId}
    read: superadmin OR businessMember OR anyNodo
    write: superadmin OR businessAdmin      ← solo admin edita catálogo

  /datos_web_new_version/{docKey}
    read: superadmin OR businessMember OR anyNodo
    write: superadmin OR businessAdmin
        OR (anyNodo AND docKey in ['ventas_ac', 'mensajes_ac', 'articulos_ac', 'apartados_ac'])
           ← nodos solo escriben las 4 huellas de sync, NO equipoDeTrabajo/tallas/etc.

  /mensajes_n_web_new_version/{path=**}
    read, write: superadmin OR businessMember OR anyNodo

  /sucursales_data_web_new_version/{sucursalId}/{subcol=**}
    read: superadmin OR businessMember OR anyNodo
    write: superadmin OR businessAdmin OR isNodo(negocioId, sucursalId)
           ← el nodo solo puede escribir en SU PROPIA sucursal
```

### Legacy read-only

```
/articulos_n/{docId}        read: auth; write: superadmin (solo migración)
/ventas_n/{path=**}         idem
/mensajes_n/{path=**}       idem
/corte_1/{path=**}          idem
/apartados/{docId}          idem
/datos/{docId}              idem
/cliente/{docId}            idem
```

El superadmin puede escribir legacy vía `migrarDataLegacy` (Admin SDK bypass
aparte).

---

## Índices compuestos

Archivo: `firestore.indexes.json`.

```json
[
  // Historial admin: ventas por negocio ordenadas por fecha
  { collectionGroup: "items",
    fields: [{negocioId ASC}, {fechaISO DESC}] },

  // Historial admin: filtrar por sucursal
  { collectionGroup: "items",
    fields: [{negocioId ASC}, {sucursalId ASC}, {fechaISO DESC}] },

  // Historial admin: filtrar por vendedor
  { collectionGroup: "items",
    fields: [{negocioId ASC}, {enTurno ASC}, {fechaISO DESC}] },

  // Dashboard: cortes activos del negocio
  { collectionGroup: "items",
    fields: [{estado ASC}, {negocioId ASC}] }
]
```

**Por qué `collectionGroup("items")`**: las ventas y los cortes comparten
la subcolección `items` bajo distintos paths (`.../ventas_n.../items/` y
`.../corte_1.../items/`). El collectionGroup las recoge todas, y se filtran
post-query. Ej: ventas tienen `articulos` array, cortes tienen `estado`
`corte_enCurso|corte_finalizado`.

Deploy de índices (necesario tras cualquier cambio):

```bash
firebase deploy --only firestore:indexes
```

---

## Storage paths

```
media_web_new_version/articulos/{id}.webp           ← imagen principal
media_web_new_version/articulos/{id}_sv{idx}.webp   ← subvariación idx=0..N
media/articulos/{id}.{ext}                          ← LEGACY (Android, read-only)
```

Rules:

```
match /media_web_new_version/articulos/{fileName} {
  read:   isAuthenticated
  write:  isAuthenticated AND isImage AND under5MB
  delete: isAuthenticated
}
match /media/articulos/{fileName} {                  ← LEGACY
  read:  isAuthenticated
  write: false
}
```

Compresión client-side a WebP antes del upload
(`admin-web/src/lib/image.ts`) reduce el tamaño ~60% vs JPG.
