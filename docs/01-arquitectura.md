# Arquitectura

> **Cuándo usar este doc**: primer doc a leer si eres nuevo. Explica la forma
> del sistema, el modelo de datos y el flujo end-to-end de las operaciones
> más importantes (venta, corte, mensaje).

## Índice

1. [Visión general](#visión-general)
2. [Modelo jerárquico: negocio → sucursal → nodo](#modelo-jerárquico)
3. [Componentes](#componentes)
4. [Flujo end-to-end: una venta](#flujo-end-to-end-una-venta)
5. [Decisiones clave](#decisiones-clave)
6. [Stack técnico](#stack-técnico)

---

## Visión general

El sistema tiene **dos apps web** compartiendo el mismo backend Firebase:

- **`nodo-web`** — PWA para tablets. El vendedor la usa en sucursal para
  registrar ventas, cortes de caja, apartados y chat. Funciona offline
  (Firestore persistence + Service Worker).
- **`admin-web`** — Panel web para PC/móvil. El super-admin gestiona
  catálogo de artículos, sucursales, tablets, equipo, tallas, y consulta
  reportes (historial ventas, más vendidos, cortes, dashboard en vivo).

```
┌────────────────┐         ┌─────────────────┐
│   nodo-web     │         │   admin-web     │
│   (tablets)    │         │   (PC/móvil)    │
└────────┬───────┘         └────────┬────────┘
         │                          │
         │  Firebase SDK v10        │
         │                          │
         └──────────┬───────────────┘
                    │
       ┌────────────┴──────────────┐
       ▼                           ▼
  ┌─────────────┐           ┌──────────────┐
  │  Firestore  │           │  Cloud       │
  │  + Storage  │           │  Functions   │
  │  + Auth     │           │  (Node 20)   │
  └─────────────┘           └──────────────┘
```

Todo vive en el proyecto `amisetienda-c7eab`.

---

## Modelo jerárquico

Multi-tenant desde el diseño (aunque por ahora hay un solo negocio).

```
negocio (ej. "amise")
 ├── sucursales            (ej. "Centro", "Plaza Norte", "Legacy")
 │    └── nodos            (tablets registradas en esa sucursal)
 ├── articulos_n           (CATÁLOGO ÚNICO del negocio — compartido)
 ├── datos                 (equipoDeTrabajo, tallas, transferencia_datos)
 ├── mensajes_n            (chat general del negocio)
 └── sucursales_data/{sid} (datos operativos por sucursal)
      ├── ventas_n         (doc-por-venta)
      ├── corte_1          (doc-por-corte)
      ├── apartados
      └── contadores       (numeración atómica)
```

**Decisiones clave del modelo**:

- **Catálogo único por negocio** (no por sucursal): un artículo se edita una
  vez y todos los nodos lo ven. Stock global (no partido por sucursal).
- **Datos operativos por sucursal**: ventas/cortes/apartados pertenecen a
  una caja física concreta.
- **Multi-negocio listo**: el namespace `negocios_web_new_version/{negocioId}/*`
  permite escalar a varios negocios sin migración.

Ver contratos exactos en [`02-firestore-schema.md`](02-firestore-schema.md).

---

## Componentes

### `nodo-web`

PWA instalable (Chrome Android, iPad). Single Page App con React Router.
Routing:

- `/first-run` — registro inicial del nodo.
- `/` — pantalla principal de ventas (carrito + buscador + vendedores).

Features principales (ver [`05-nodo-web.md`](05-nodo-web.md) para detalles):

- Carrito con Zustand.
- Pago efectivo / transferencia / tarjeta / dividido.
- Corte de caja.
- Chat general.
- Apartados + abonos.
- Barcode scanner (`BarcodeDetector` API + `@zxing/browser` fallback).
- Ticket PDF (`pdfmake` lazy-loaded) + `navigator.share`.
- Offline-first: Firestore persistent cache + Workbox SW.

### `admin-web`

SPA React con sidebar navigation. 13 rutas:

```
/                       Dashboard con KPIs en vivo
/articulos              Lista + buscador
/articulos/nuevo        Crear artículo
/articulos/:id          Editar artículo (con subvariaciones)
/ventas                 Historial filtrable
/ventas/:id             Detalle venta
/cortes                 Cortes por sucursal+día
/apartados              Apartados por sucursal
/reportes/mas-vendidos  Top artículos
/reportes/articulo      Consulta venta por ID
/mensajes               Chat general
/tallas                 Grupos de tallas
/sucursales             CRUD sucursales
/nodos                  Ver/revocar tablets
/equipo                 CRUD equipo de trabajo (vendedores)
/ajustes/migracion      Migración data legacy
```

### `shared/`

Paquete local de TypeScript (path alias `@shared`). Contiene:

- `collections.ts` — nombres de colecciones (`_web_new_version` suffix) y
  builders de paths.
- `schema.ts` — tipos TS de todos los docs Firestore.
- `ids.ts` — `generarID()`, `genNodoId()`, `siguienteArticuloId()`.
- `date.ts` — formateos MX (compatibles con esquemas legacy preservados).

### `functions/`

Node 20 Cloud Functions. Lista completa en
[`03-cloud-functions.md`](03-cloud-functions.md).

---

## Flujo end-to-end: una venta

Escenario: Caja 2 en sucursal "Centro" del negocio "amise" cobra $500 en
efectivo al cliente.

```
1. Cliente llega con artículos
   │
   ▼
2. Vendedor (Carlos) abre nodo-web en la tablet
   │  ─ Ya vinculada (localStorage.amise_nodo_session existe)
   │  ─ Firebase Auth session vigente (anonymous user con claims
   │    role:"nodo", negocioId:"amise", sucursalId:"suc_xxx",
   │    nodoId:"abc123")
   ▼
3. Selecciona "Carlos" del SelectorVendedor
   │  ─ setVendedor("Carlos", "u_xxx") en el store Zustand
   ▼
4. Escanea código de barras → BarcodeScanner detecta
   │  ─ useBarcodeBusqueda busca en bySigla/byId (cache local)
   │  ─ agregar(articulo) → carritoStore
   ▼
5. Toca "Cobrar" → PagoModal
   │  ─ Elige "Efectivo", ingresa $500 recibido
   │  ─ cambio = 0, puedeCobrar = true
   ▼
6. Confirma → crearVenta() en ventaService.ts
   │
   │  runTransaction(db, async tx => {
   │    const contadorRef = contadorDia(neg, suc, "2026-04-24")
   │    const snap = await tx.get(contadorRef)
   │    numeroDeVenta = (snap.ultimoNumeroVenta ?? -1) + 1
   │    const ventaRef = ventaItem(neg, suc, "2026", "4", "24", ventaId)
   │    tx.set(ventaRef, venta)
   │    tx.set(contadorRef, { ultimoNumeroVenta: numeroDeVenta })
   │  })
   │
   │  ─ Atómico: dos nodos cobrando en paralelo obtienen números distintos
   ▼
7. Fuera de la transacción:
   │  setDoc(datos_w/ventas_ac, { huella_venta: newHuella }, merge)
   │  ─ Trigger sync para otros clientes que escuchen ventas_ac
   ▼
8. ventaService retorna { venta, offline: false }
   │  ─ Si red falló → fallback offline, numeroDeVenta = "OFFLINE-xxx-ts"
   │  ─ reconciliarVentasOffline (CF trigger onCreate) renombra al reconectar
   ▼
9. UI muestra TicketModal
   │  ─ Carga pdfmake (lazy chunk)
   │  ─ generarTicketPDF(venta, sucursal) → Blob
   │  ─ User elige "Imprimir" (abrirPDF) o "Compartir" (navigator.share)
   ▼
10. En paralelo, admin-web refleja la venta:
    │  ─ useVentasHoyRT (onSnapshot collectionGroup + where negocioId)
    │    recibe el nuevo doc
    │  ─ Dashboard recalcula totalHoy, countHoy, porSucursal
    │  ─ VentasPage (si está abierta) recarga al cambiar filtros
```

Puntos críticos del flujo:

- **Numeración atómica**: la transacción previene colisiones (dos nodos nunca
  asignan el mismo `numeroDeVenta`). Bug conocido en Android legacy
  resuelto en la web.
- **Offline resiliente**: la tablet puede seguir cobrando sin red. Los docs
  se encolan en IndexedDB y sincronizan al reconectar. La reconciliación
  corrige el `numeroDeVenta`.
- **Contrato schema preservado**: la venta lleva `huella`, `id_registro`,
  `fecha` localizada MX — compatibles con el formato Android histórico
  (aunque Android ya no escribe; los reportes entendiblen).

Flujos similares para corte, apartado y mensaje en
[`05-nodo-web.md`](05-nodo-web.md).

---

## Decisiones clave

### D1 — Doc-por-venta (no array)

**Alternativa descartada**: `ventas_n/{y}/{m}/{d}.registro[]` con `arrayUnion`
(como Android). **Razón**: el límite de 1 MB por documento Firestore se
alcanzaría tras ~1000 ventas/día.

**Elegido**: `ventas_n/{y}/{m}/{d}/items/{ventaId}` — un doc individual por
venta. Escalable a infinito. Un poco más de reads para "ver un día" pero con
índices compuestos es rápido.

### D2 — `collectionGroup` + campo `negocioId`

Para que el admin consulte ventas sin iterar sucursal×día, cada venta lleva
el campo `negocioId`. Luego un query:

```ts
query(collectionGroup(db, "items"),
  where("negocioId", "==", "amise"),
  where("fechaISO", ">=", desde),
  orderBy("fechaISO", "desc"))
```

Requiere índice compuesto declarado en `firestore.indexes.json`.

### D3 — Anonymous Auth para nodos

Un tablet no tiene "usuario"; tiene identidad persistente. Usamos
**Firebase Anonymous Auth** con custom claims (`role:"nodo"`, `negocioId`,
`sucursalId`, `nodoId`). El token persiste en IndexedDB; la tablet no
vuelve a loguearse mientras no pierda caché.

Al perder caché, el flujo de **rebind** crea un nuevo Anonymous user con los
mismos claims y revoca el anterior. Ver [`04-auth-y-roles.md`](04-auth-y-roles.md).

### D4 — Clean break vs Android legacy

Los Android ya no escriben. El namespace nuevo `_web_new_version` es
paralelo; las colecciones legacy quedan read-only (rules). Hay una Cloud
Function `migrarDataLegacy` que copia datos si se necesitan.

### D5 — Roles vs multi-tenancy

- `superadmin`: ve todo, crea negocios.
- `admin`: gestiona UN negocio específico (claims.negocioId).
- `vendedor`: usuario de Cloud Function `createUser` (no usado aún en UI).
- `nodo`: claims con `sucursalId` + `nodoId`. Rules verifican en cada write.

---

## Stack técnico

### Ambas apps

- **React 18 + TypeScript 5 + Vite 5** — SPAs ligeras, HMR rápido.
- **Tailwind CSS 3 + Shadcn UI (Radix primitives)** — estilos consistentes.
- **Firebase SDK v10 modular** — tree-shaking optimal.
- **TanStack Query** — cache de queries en admin.
- **Zustand** — store del carrito (nodo) y toasts.
- **React Router v6** — nested routes con layout shell.

### Solo `nodo-web`

- **vite-plugin-pwa** (Workbox) — SW con denylist de Firestore/Auth.
- **pdfmake** — generación client-side de tickets. Lazy-loaded.
- **@zxing/browser** — fallback de decodificación de barcode. Lazy-loaded.

### Solo `admin-web`

- **TanStack Table** — (importado pero aún no usado en Fase 5).
- **Recharts** — (listo para gráficas de Fase 5+).
- **lucide-react** — iconos.

### Backend

- **Cloud Functions v2** (trigger) + **v1** (callable) — Node 20.
- **Firestore** con reglas multi-tenant (ver
  [`02-firestore-schema.md`](02-firestore-schema.md)).
- **Storage** con cap 5 MB para imágenes de artículos.
- **firebase-functions ^5.1.1**, **firebase-admin ^12.6.0**.

Ver decisiones más finas en cada doc específico.
