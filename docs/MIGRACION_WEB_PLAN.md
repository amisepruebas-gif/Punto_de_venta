# Plan Principal — Migración Web (nodo-web + admin-web)

> Plan de implementación basado en las decisiones del usuario para las 10 preguntas abiertas del pre-plan (`MIGRACION_WEB_PREPLAN.md`).
>
> **Proyecto Firebase**: `amisetienda-c7eab` (existente).
> **Sitios Hosting**: `amise-admin.web.app` (admin-web) + `amise-nodo.web.app` (nodo-web).
> **Negocio default**: `negocioId: "amise"` (display: "Amise").
> **Super admin inicial**: `jesuscentenoramirez@gmail.com`.
> **Clean break**: los Android se apagan al lanzar la web. No hay backward-compat con schemas legacy.

---

## 0. Decisiones del usuario procesadas

| # | Decisión | Implicación |
|---|---|---|
| 1 | Catálogo único por negocio, compartido por todas sus sucursales | `articulos_n_web_new_version` al nivel del negocio, no de sucursal. Stock único por artículo |
| 2 | Opción más escalable sin comprometer datos | **Opción B**: un documento por venta bajo `.../ventas_n_web_new_version/{y}/{m}/{d}/items/{ventaId}` |
| 3 | Tablet con login único inicial, registro permanente hasta perder caché | Firebase Anonymous Auth + registro del nodo con nombre+dirección. Al perder caché → selector de sucursal + re-vinculación a nodo existente |
| 4 | Lo más escalable y bonito | **React 18 + TypeScript + Vite 5 + Tailwind 3 + Shadcn UI (Radix)** en ambas apps |
| 5 | `dispositivo_1/app-web/` no se reutiliza | Scaffold nuevo desde cero en `admin-web/` |
| 6 | Sufijo `_web_new_version` en todas las colecciones | Namespace aislado. Migración de artículos+ventas desde legacy se hará después en script |
| 7 | Android se apagan con la migración | No hay puente de compatibilidad; schema libre |
| 8 | Sitios Firebase Hosting | `amise-admin.web.app` + `amise-nodo.web.app` |
| 9 | Escaneo barcode: elegir mejor | `@zxing/browser` (misma lib que el Android) + fallback a `BarcodeDetector` API nativa cuando exista |
| 10 | Impresión: elegir mejor | MVP = PDF vía `pdfmake` + diálogo impresión nativo + botón "enviar a WhatsApp". Fase 2 = Web Bluetooth ESC/POS opt-in |

---

## 1. Arquitectura final

### 1.1 Layout del repositorio

```
C:\Users\jesus\Documents\dispositivo_1\
├── nodo-web/                         ← NUEVO — PWA tablet
├── admin-web/                        ← NUEVO — admin PC/móvil
├── shared/                           ← NUEVO — tipos + const compartidos
│   └── src/
│       ├── collections.ts            ← nombres con sufijo _web_new_version
│       ├── schema.ts                 ← types TypeScript (Venta, Articulo, Mensaje, Corte)
│       ├── ids.ts                    ← generarID(), genNodoId(), genArticuloId()
│       └── date.ts                   ← formato fecha MX
├── functions/                        ← Cloud Functions (extender dispositivo_1/functions)
├── firestore.rules                   ← actualizado
├── storage.rules                     ← actualizado
├── firebase.json                     ← multi-site hosting config
├── .firebaserc                       ← targets: admin-web → admin-amisetienda, nodo-web → nodo-amisetienda
├── nodo_1/                           ← Android, se apaga al lanzar — DEPRECATED
├── dispositivo_1/                    ← Android admin + Electron mensajes, se apaga — DEPRECATED
├── MIGRACION_WEB_PREPLAN.md          ← análisis previo
└── MIGRACION_WEB_PLAN.md             ← este doc
```

### 1.2 Stack técnico (idéntico en ambas apps para simplificar)

- **React 18** + **TypeScript 5** + **Vite 5**.
- **Tailwind 3** + **Shadcn UI** (componentes headless Radix + style Tailwind, copy-paste en `components/ui/`).
- **TanStack Query v5** para cache de datos Firebase + **Zustand** para estado UI local.
- **React Router v6** para routing.
- **React Hook Form** + **Zod** para formularios y validación.
- **Firebase SDK v10 modular** — solo imports necesarios para tree-shaking.
- **PWA**: `vite-plugin-pwa` con Workbox. Manifest + SW. Firestore persistence offline.
- **Iconos**: `lucide-react`.
- **Tablas** (admin): `@tanstack/react-table`.
- **Gráficos** (admin): `recharts`.
- **Escaneo barcode** (nodo): `@zxing/browser` + polyfill/detection de `BarcodeDetector`.
- **Impresión** (nodo): `pdfmake` + `navigator.canShare` para WhatsApp/email; Web Bluetooth ESC/POS en feature-flag.
- **Tests**: `vitest` + `@testing-library/react`. Smoke tests en lugares críticos (ventaService, corteService).

---

## 2. Schema Firestore final

### 2.1 Namespace de colecciones (todas con sufijo `_web_new_version`)

```
/negocios_web_new_version/{negocioId}/                                   ← doc raíz negocio
│   ├── nombre, razonSocial, plan, fechaCreacion
│
├── /sucursales_web_new_version/{sucursalId}                             ← metadata sucursal
│   ├── nombre, direccion, telefono, fechaCreacion, createdBy (nodoId o uid)
│
├── /nodos_web_new_version/{nodoId}                                      ← tablets registrados
│   ├── sucursalId, nombre, registradoPor, fechaRegistro, userAgent, ultimoAcceso, estado
│
├── /articulos_n_web_new_version/{articuloId}                            ← CATÁLOGO ÚNICO del negocio
│   └── campos del artículo (ver §2.2)
│
├── /datos_web_new_version/{docKey}                                      ← config del negocio
│   ├── equipoDeTrabajo, tallas, transferencia_datos, switches, articulos_ac, mensajes_ac, ventas_ac, apartados_ac, dispositivos
│
├── /mensajes_n_web_new_version/{y}/{m}/{d}                              ← chat general del negocio (un doc/día)
│   └── { mensajes: [ { texto, hora, usuario, id, corte, huella, nuevoDia, inicioDeMes, inicioAño, sucursalId } ] }
│
└── /sucursales_data_web_new_version/{sucursalId}/                       ← datos operativos por sucursal
    │
    ├── /ventas_n_web_new_version/{y}/{m}/{d}/items/{ventaId}            ← DOC-POR-VENTA (no array)
    │   └── { numeroDeVenta, huella, enTurno, nodoId, ... ver §2.3 }
    │
    ├── /corte_1_web_new_version/{y}/{m}/{d}/items/{corteId}             ← DOC-POR-CORTE
    │   └── { estado, fecha_inicio, ... ver §2.5 }
    │
    ├── /apartados_web_new_version/{apartadoId}
    │   └── { cliente, articulos, abonos, ... ver §2.6 }
    │
    └── /contadores_web_new_version/{YYYY-MM-DD}                         ← numeración atómica
        └── { ultimoNumeroVenta, ultimoNumeroCorte }
```

**Nota de terminología**: "legacy" = colecciones Android sin sufijo (`ventas_n`, `articulos_n`, etc.). Quedan intactas como read-only durante el período de migración.

### 2.2 Artículo — `articulos_n_web_new_version/{id}`

```ts
type Articulo = {
  id: string;                        // secuencial desde 12300001 (se preserva el generador)
  nombre: string;                    // requerido
  sigla: string;                     // requerido, único
  referencia: string;
  codigo: string;                    // = id
  cantidad: string;                  // stock único del negocio (número como string, legacy)
  preciCompra: string;               // typo histórico preservado intencional
  precioVenta: string;
  utilidad: string;                  // derivado
  utilidadTotal: string;             // derivado
  genero?: string;
  subgenero?: string;
  hashtags?: string;
  fecha: string;                     // "YYYY-MM-DD HH:mm:ss"
  imagenUrl?: string;                // Storage download URL

  tallas?: string;                   // referencia al grupo en datos.tallas
  seña?: string;                     // presencia = true
  "3x2"?: string;                    // presencia = true
  mayoreo?: string;
  cantMayoreo?: string;
  descuento?: string;
  promoBandera?: string;

  subvariaciones?: Array<{
    id: number;
    nombre: string;
    imagenUrl?: string;
  }>;
};
```

**Generador de ID** (`shared/src/ids.ts`):
```ts
export async function siguienteArticuloId(negocioId: string): Promise<string> {
  // leer el último id de articulos_n_web_new_version ordenado desc, +1
  // base inicial: "12300001"
  // implementar con transacción sobre datos_web_new_version/_contadorArticulos
}
```

**Imágenes**: Storage `media_web_new_version/articulos/{id}.webp` y `{id}_sv{idx}.webp`. Compresión cliente a WebP si > 1 MB; cap duro 5 MB.

### 2.3 Venta — `ventas_n_web_new_version/{y}/{m}/{d}/items/{ventaId}`

Un documento por venta (no array). `ventaId` = `huella` (único por `Date.now()` + random).

```ts
type Venta = {
  ventaId: string;                   // = id del doc
  numeroDeVenta: string;             // secuencial del día (contador transaccional)
  id_registro: string;               // "YYYY MM DD" legacy-compatible para UI Android que siga viva
  huella: string;                    // timestamp
  enTurno: string;                   // nombre del vendedor (del equipoDeTrabajo)
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
  fecha: string;                     // "YYYY-MM-DD HH:mm:ss" (ISO-ish, mejor que localized Android)
  fechaISO: string;                  // timestamp ISO 8601 estricto para queries
  datosPagoDividido?: Record<string, unknown>;

  // Nuevos multi-sucursal
  nodoId: string;
  sucursalId: string;
  vendedorIdUsuario?: string;        // del equipoDeTrabajo
};
```

**Creación** (escritura atómica):
```ts
async function crearVenta(negocioId, sucursalId, nodoId, venta) {
  const ymd = `${Y}-${M}-${D}`;
  const contadorRef = doc(db, `negocios_web_new_version/${negocioId}/sucursales_data_web_new_version/${sucursalId}/contadores_web_new_version/${ymd}`);
  const ventaId = generarID();

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(contadorRef);
    const prev = snap.exists() ? snap.data().ultimoNumeroVenta : -1;
    const numeroDeVenta = String(prev + 1);

    const ventaRef = doc(db, `negocios_web_new_version/${negocioId}/sucursales_data_web_new_version/${sucursalId}/ventas_n_web_new_version/${Y}/${M}/${D}/items/${ventaId}`);
    tx.set(ventaRef, { ...venta, ventaId, numeroDeVenta, nodoId, sucursalId });
    tx.set(contadorRef, { ultimoNumeroVenta: prev + 1 }, { merge: true });
  });

  // Fuera de transacción: actualizar trigger de huella
  await setDoc(
    doc(db, `negocios_web_new_version/${negocioId}/datos_web_new_version/ventas_ac`),
    { huella_venta: generarID() },
    { merge: true }
  );
}
```

Garantías: numeración única por sucursal+día, sin race condition, sin límite de 1 MB.

### 2.4 Mensaje — `mensajes_n_web_new_version/{y}/{m}/{d}`

Un doc por día con array `mensajes` usando `arrayUnion` (los mensajes son ligeros, 1 MB alcanza sobrado). Estructura preservada del Android (incluyendo flags de protocolo).

```ts
type Mensaje = {
  texto: string;
  hora: string;                      // "4:20:45 p. m."
  usuario: string;
  id: string;                        // nodoId o "admin_" + uid
  corte?: string;
  huella: string;
  nuevoDia?: string;                 // solo en el primer mensaje del día
  inicioDeMes?: string;              // solo en el primer mensaje del mes
  inicioAño?: string;                // solo en el primer mensaje del año
  sucursalId?: string;               // nuevo — filtro por sucursal (opcional)
};
```

Escritura:
```ts
await updateDoc(docRef, { mensajes: arrayUnion(nuevoMensaje) });
await setDoc(huellaDocRef, { huella_mensaje: generarID() }, { merge: true });
```

Sin race condition porque `arrayUnion` hace el merge server-side.

### 2.5 Corte — `corte_1_web_new_version/{y}/{m}/{d}/items/{corteId}`

```ts
type Corte = {
  corteId: string;
  estado: "corte_iniciar" | "corte_enCurso" | "corte_finalizado";
  idVenta_corte: string;             // numeroDeVenta donde se cerró
  nombre_corte: string;
  fecha_inicio: string;
  fecha_fin?: string;
  totalEfectivo: string;
  totalTransferencia: string;
  totalTarjeta: string;
  totalGeneral: string;
  nodoId: string;
  sucursalId: string;
  usuarioCreador: string;
};
```

Doc-por-corte (mismo patrón que ventas).

### 2.6 Apartado — `apartados_web_new_version/{apartadoId}`

```ts
type Apartado = {
  apartadoId: string;
  cliente: string;
  telefonoCliente?: string;
  articulos: Array<{ id; cantidad; precio; nombre; }>;
  seña: number;
  totalApartado: number;
  abonos: Array<{
    fecha: string;
    monto: number;
    estado: "pagado" | "pendiente";
    tipo: "seña" | "abono" | "saldo";
    ventaId?: string;                // referencia al doc de venta generado
  }>;
  estado: "pendiente" | "parcial" | "completo" | "cancelado";
  fechaCreacion: string;
  sucursalId: string;
  nodoId: string;
  huella: string;
};
```

### 2.7 Registro de nodo y sucursal

**Sucursal** — `negocios_web_new_version/{negocioId}/sucursales_web_new_version/{sucursalId}`:
```ts
type Sucursal = {
  sucursalId: string;
  nombre: string;                    // "Tienda Central"
  direccion: string;                 // "Av. Reforma 123, CDMX"
  telefono?: string;
  fechaCreacion: string;
  createdBy: string;                 // nodoId del primer nodo que la registró
  activa: boolean;
};
```

**Nodo** — `negocios_web_new_version/{negocioId}/nodos_web_new_version/{nodoId}`:
```ts
type Nodo = {
  nodoId: string;                    // uuid 12 chars base36
  sucursalId: string;
  nombre: string;                    // "Caja 1" o lo que ponga el usuario
  registradoPor: string;             // nombre de quien registró
  fechaRegistro: string;
  userAgent: string;
  ultimoAcceso: string;              // actualizado en cada boot
  estado: "activo" | "revocado";
  authUid?: string;                  // uid de Firebase Anonymous Auth vinculado
};
```

---

## 3. Autenticación y roles

### 3.1 Admin-web

- **Firebase Auth email/password** (función `createUser` existente en `dispositivo_1/functions/index.js:165-207`).
- **Custom claims** via `setCustomClaims` existente: `role: "superadmin" | "admin"`, `negocioId`.
- Primer super-admin se crea manual con `setup-initial.js` (script one-shot).
- Login persiste vía Firebase Auth session.

### 3.2 Nodo-web (tablet)

Decisión #3: login una vez, permanente hasta perder caché.

**Flow del primer arranque**:

1. App detecta `!localStorage.nodoId` → ruta `/first-run`.
2. UI pide:
   - **Nombre de quien registra** (texto libre).
   - **Sucursal**:
     - Si hay sucursales en el negocio → mostrar selector + opción "Nueva sucursal".
     - Si no hay → mostrar form de creación directo (nombre + dirección + teléfono).
     - Si se eligió "Nueva sucursal" → pedir nombre + dirección + teléfono.
   - **Nombre del nodo** (ej. "Caja 1").
3. Llamar Cloud Function `registrarNodo({ negocioId, sucursalId o datosNuevaSucursal, nombreNodo, registradoPor })`.
4. La función:
   - Si sucursal nueva → crea `sucursales_web_new_version/{sucursalId}`.
   - Crea Firebase Anonymous Auth user.
   - Asigna custom claims: `role: "nodo"`, `negocioId`, `sucursalId`, `nodoId`.
   - Crea `nodos_web_new_version/{nodoId}` con todos los metadatos.
   - Retorna `{ nodoId, sucursalId, authToken }`.
5. Cliente guarda en `localStorage`: `{ nodoId, sucursalId, negocioId }`. Firebase Auth persiste sesión Anonymous → no requiere re-login mientras el caché exista.

**Flow al perder caché** (`!localStorage.nodoId` + `auth.currentUser` null):

Detecta que es un re-bind (hay sucursales + nodos existentes en el negocio):

1. UI muestra selector de sucursal.
2. Dentro de la sucursal, lista de nodos activos.
3. Usuario elige nodo → confirma.
4. Llamar Cloud Function `rebindNodo({ nodoId })`.
5. La función crea Anonymous Auth user nuevo y asigna mismos custom claims del nodo (`negocioId`, `sucursalId`, `nodoId`, `role: "nodo"`).
6. Guardar localStorage + continuar.

⚠️ **Riesgo asumido por usuario** (#3): cualquiera con acceso al tablet puede elegir re-bind a cualquier nodo de cualquier sucursal del negocio. Mitigación mínima:
- Log de re-bind en `nodos_web_new_version/{nodoId}.historial[]`.
- Admin-web muestra alerta si un nodo hace re-bind sospechoso (ej. cambio de userAgent o geolocation).

### 3.3 Reglas Firestore (versión final)

Extender `firestore.rules` con:

```
function isNodo(negocioId, sucursalId) {
  return isAuthenticated()
    && request.auth.token.role == 'nodo'
    && request.auth.token.negocioId == negocioId
    && request.auth.token.sucursalId == sucursalId;
}

match /negocios_web_new_version/{negocioId} {
  allow read: if isSuperAdmin() || isBusinessMember(negocioId);
  allow write: if isSuperAdmin();

  match /sucursales_web_new_version/{sucursalId} {
    allow read: if isSuperAdmin() || isBusinessMember(negocioId);
    allow create: if isAuthenticated(); // nodos pueden crear sucursal en first-run (ver nota)
    allow update, delete: if isSuperAdmin() || isBusinessAdmin(negocioId);
  }

  match /nodos_web_new_version/{nodoId} {
    allow read: if isSuperAdmin() || isBusinessMember(negocioId);
    allow write: if false; // solo vía Cloud Function registrarNodo
  }

  match /articulos_n_web_new_version/{artId} {
    allow read: if isSuperAdmin() || isBusinessMember(negocioId);
    allow write: if isSuperAdmin() || isBusinessAdmin(negocioId); // solo admin-web
  }

  match /datos_web_new_version/{docKey} {
    allow read: if isSuperAdmin() || isBusinessMember(negocioId);
    allow write: if isSuperAdmin() || isBusinessAdmin(negocioId);
  }

  match /mensajes_n_web_new_version/{year}/{month}/{day} {
    allow read, write: if isSuperAdmin() || isBusinessMember(negocioId);
  }
  match /mensajes_n_web_new_version/{year}/{month} { ... }
  match /mensajes_n_web_new_version/{year} { ... }

  match /sucursales_data_web_new_version/{sucursalId} {
    match /ventas_n_web_new_version/{path=**} {
      allow read: if isSuperAdmin() || isBusinessMember(negocioId);
      allow write: if isNodo(negocioId, sucursalId) || isBusinessAdmin(negocioId);
    }
    match /corte_1_web_new_version/{path=**} {
      allow read: if isSuperAdmin() || isBusinessMember(negocioId);
      allow write: if isNodo(negocioId, sucursalId) || isBusinessAdmin(negocioId);
    }
    match /apartados_web_new_version/{apId} {
      allow read: if isSuperAdmin() || isBusinessMember(negocioId);
      allow write: if isNodo(negocioId, sucursalId) || isBusinessAdmin(negocioId);
    }
    match /contadores_web_new_version/{ymd} {
      allow read, write: if isNodo(negocioId, sucursalId) || isBusinessAdmin(negocioId);
    }
  }
}
```

**Reglas legacy**: `match /ventas_n/{path=**} { allow read: if isAuthenticated(); allow write: if false; }` — bloquear escrituras en colecciones legacy; solo lectura para scripts de migración.

---

## 4. Cloud Functions (nuevas + adaptadas)

Ubicación: `functions/` en raíz (migrar desde `dispositivo_1/functions/index.js`).

Funciones existentes a mantener:
- `enviar` — FCM (ajustar topic a `negocio_{negocioId}_web`).
- `setCustomClaims` — ahora acepta también `role: "nodo"` y claim `sucursalId`.
- `createUser`, `assignUserToBusiness`, `checkSubscriptionLimits`, `getUserProfile`, `createBusiness`.

Funciones nuevas:

- `registrarNodo({ negocioId, sucursalId?, datosNuevaSucursal?, nombreNodo, registradoPor })` → crea nodo + Anonymous auth + claims. Retorna `{ nodoId, sucursalId, authToken }`.
- `rebindNodo({ nodoId })` → crea nuevo Anonymous auth user, asigna claims del nodo existente, actualiza `ultimoAcceso` y log en `historial[]`.
- `crearSucursal({ negocioId, nombre, direccion, telefono })` → solo `admin` y `superadmin`.
- `revocarNodo({ nodoId })` → marca `estado: "revocado"`, invalida claims. Desde admin-web.
- `migrarDataLegacy({ dryRun? })` → lee de `articulos_n` y `ventas_n` legacy y escribe a `articulos_n_web_new_version` y `ventas_n_web_new_version`. Reversible. Solo `superadmin`.

---

## 5. Estructura de `nodo-web/`

```
nodo-web/
├── index.html
├── vite.config.ts                    ← PWA plugin, target tablets
├── tsconfig.json
├── tailwind.config.ts
├── package.json
├── public/
│   ├── icons/                        ← PWA 192, 512, maskable
│   └── manifest.webmanifest
├── src/
│   ├── main.tsx
│   ├── App.tsx                       ← router root + auth guard
│   ├── routes/
│   │   ├── FirstRun.tsx              ← primer arranque / re-bind
│   │   ├── Ventas.tsx                ← pantalla principal vendedor
│   │   ├── Cortes.tsx
│   │   └── Mensajes.tsx
│   ├── features/
│   │   ├── first-run/
│   │   │   ├── SelectorSucursal.tsx
│   │   │   ├── FormNuevaSucursal.tsx
│   │   │   ├── SelectorNodoExistente.tsx
│   │   │   └── useRegistroNodo.ts
│   │   ├── ventas/
│   │   │   ├── CarritoPanel.tsx
│   │   │   ├── ListaArticulos.tsx
│   │   │   ├── BuscadorArticulo.tsx
│   │   │   ├── BarcodeScanner.tsx    ← @zxing/browser
│   │   │   ├── PagoModal.tsx         ← efectivo / transferencia / tarjeta / dividido
│   │   │   ├── TicketPrintable.tsx   ← componente PDF
│   │   │   ├── ventaService.ts       ← crearVenta con transacción
│   │   │   └── useVentaDraft.ts
│   │   ├── cortes/
│   │   │   ├── CorteActivo.tsx
│   │   │   ├── CierreCorte.tsx
│   │   │   └── corteService.ts
│   │   ├── mensajes/
│   │   │   ├── ChatView.tsx
│   │   │   ├── ComposerMensaje.tsx
│   │   │   └── mensajeService.ts
│   │   ├── articulos/
│   │   │   └── useArticulos.ts       ← cache + onSnapshot
│   │   ├── equipo/
│   │   │   └── useEquipo.ts          ← para selector vendedor
│   │   └── apartados/
│   │       ├── AbonoModal.tsx
│   │       └── apartadoService.ts
│   ├── components/ui/                ← shadcn (Button, Dialog, Input, etc.)
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useNodoContext.ts
│   │   └── useOffline.ts
│   ├── lib/
│   │   ├── firebase.ts
│   │   ├── persistence.ts
│   │   ├── print.ts                  ← pdfmake + share API
│   │   └── zxing.ts
│   └── styles/globals.css
└── firebase.json                     ← hosting deploy rules per site
```

### 5.1 Criterios de aceptación nodo-web

| # | Criterio |
|---|---|
| N1 | App instalable como PWA en tablet Android + iPad |
| N2 | Primer arranque sin sucursales → crea sucursal nueva con dirección |
| N3 | Primer arranque con sucursales existentes → muestra selector + opción nueva |
| N4 | Re-bind tras limpiar caché → selector sucursal + nodo, registra `historial[]` |
| N5 | Venta se escribe como doc individual en `.../ventas_n_web_new_version/{y}/{m}/{d}/items/{ventaId}` |
| N6 | `numeroDeVenta` generado con transacción: dos ventas simultáneas nunca colisionan |
| N7 | Cortes de caja: iniciar / en curso / finalizar funcionan y se escriben como docs individuales |
| N8 | Mensajes: envío con `arrayUnion`, preservación de flags `nuevoDia`/`inicioDeMes`/`inicioAño` |
| N9 | Artículos: lectura con cache local + `onSnapshot` al listener de `articulos_ac` |
| N10 | Funciona offline: ventas encoladas se sincronizan al recuperar red |
| N11 | Ticket PDF generado client-side; botón "compartir por WhatsApp" usa `navigator.share` |
| N12 | Escaneo barcode: `BarcodeDetector` si disponible, fallback `@zxing/browser` |

---

## 6. Estructura de `admin-web/`

```
admin-web/
├── index.html
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── package.json
├── public/
├── src/
│   ├── main.tsx
│   ├── App.tsx                       ← router + auth + role guard
│   ├── routes/
│   │   ├── Login.tsx
│   │   ├── Dashboard.tsx             ← resumen: ventas hoy, cortes activos, alertas
│   │   ├── Articulos.tsx             ← lista + crear/editar
│   │   ├── ArticuloDetail.tsx        ← form completo con subvariaciones
│   │   ├── Ventas.tsx                ← historial filtrable
│   │   ├── VentaDetail.tsx
│   │   ├── Cortes.tsx
│   │   ├── Apartados.tsx
│   │   ├── Mensajes.tsx
│   │   ├── Reportes/
│   │   │   ├── MasVendidos.tsx
│   │   │   ├── ConsultaPorArticulo.tsx
│   │   │   └── VistaPorPrecios.tsx
│   │   ├── Sucursales.tsx            ← CRUD sucursales
│   │   ├── Nodos.tsx                 ← gestión tablets (ver / revocar)
│   │   ├── Equipo.tsx                ← equipoDeTrabajo CRUD
│   │   ├── Tallas.tsx                ← grupos de tallas
│   │   └── Ajustes.tsx
│   ├── features/
│   │   ├── auth/
│   │   ├── articulos/
│   │   │   ├── FormArticulo.tsx
│   │   │   ├── SubvariacionesEditor.tsx
│   │   │   ├── ImageUpload.tsx       ← compresión WebP + upload
│   │   │   ├── PromocionesTab.tsx    ← mayoreo / 3x2 / descuento / seña
│   │   │   └── articuloService.ts
│   │   ├── ventas/
│   │   │   ├── TablaHistorial.tsx    ← @tanstack/react-table
│   │   │   ├── FiltrosVenta.tsx      ← día/mes/año, vendedor, forma pago, sucursal
│   │   │   └── ventaQueries.ts
│   │   ├── reportes/
│   │   │   ├── masVendidosAgg.ts     ← agregación client o Cloud Function
│   │   │   ├── GraficaVentas.tsx     ← recharts
│   │   │   └── ExportCSV.tsx
│   │   ├── sucursales/
│   │   ├── nodos/
│   │   ├── equipo/
│   │   ├── tallas/
│   │   ├── apartados/
│   │   └── mensajes/
│   ├── components/ui/                ← shadcn
│   ├── hooks/
│   ├── lib/
│   │   ├── firebase.ts
│   │   ├── auth.ts
│   │   ├── image.ts                  ← canvas resize + WebP encode
│   │   └── csv.ts
│   └── styles/globals.css
└── firebase.json
```

### 6.1 Criterios de aceptación admin-web

| # | Criterio |
|---|---|
| A1 | Login email/password con role check (`superadmin` o `admin`) |
| A2 | CRUD artículos con imagen principal + subvariaciones + tallas + promociones |
| A3 | Generación de ID secuencial atómica (sin colisión entre dos admins) |
| A4 | Protocolo de sync `articulos_ac` respetado (nodos se enteran al editar) |
| A5 | Gestión sucursales (crear, editar, desactivar) |
| A6 | Gestión de nodos (ver, renombrar, revocar → invalida claims) |
| A7 | Historial ventas filtrable por día/mes/año/sucursal/vendedor/forma de pago |
| A8 | Vista detalle de venta con todos los campos y ticket imprimible |
| A9 | Reportes: más vendidos, consulta por artículo, vista por precios |
| A10 | Apartados: ver pendientes, agregar abonos, liquidar, cancelar |
| A11 | Cortes: historial por sucursal con totales |
| A12 | Equipo de trabajo CRUD (sin login Firebase — es lista local del negocio) |
| A13 | Mensajes: envío como "admin" + lectura chat general |
| A14 | Dashboard con KPIs (ventas hoy por sucursal, cortes activos, artículos sin stock) |

---

## 7. Plan por fases (cronograma sugerido)

Cada fase es una unidad entregable con criterios de aceptación verificables.

### Fase 0 — Setup (1-2 días)

- [ ] Crear `nodo-web/`, `admin-web/`, `shared/` con scaffolds Vite + TypeScript + React + Tailwind + Shadcn.
- [ ] Configurar `firebase.json` multi-site, `.firebaserc` con dos targets.
- [ ] Extender `firestore.rules` con reglas de §3.3 (namespace `_web_new_version`).
- [ ] Migrar/extender Cloud Functions a `functions/` en raíz con las nuevas: `registrarNodo`, `rebindNodo`, `crearSucursal`, `revocarNodo`, `migrarDataLegacy` (stub).
- [ ] Script `setup-initial.js` que crea el primer super-admin + negocio default.
- [ ] Shadcn UI instalado y primeros componentes base (`Button`, `Input`, `Dialog`, `Toast`).

**Criterio**: `npm run dev` en ambas apps levanta sin errores. `firebase deploy --only functions,firestore:rules` exitoso.

### Fase 1 — nodo-web first-run + ventas básicas (1 semana)

- [ ] `src/features/first-run/` — formulario primer arranque + creación/selección sucursal.
- [ ] `registrarNodo` Cloud Function funcional.
- [ ] `ventaService.ts` con transacción de contador.
- [ ] UI ventas: lista artículos (de cache) + carrito + pago efectivo.
- [ ] Escritura de venta en `ventas_n_web_new_version` verificada en Firestore.
- [ ] Criterios N1-N6 cumplidos.

### Fase 2 — nodo-web features restantes (1-2 semanas)

- [ ] Formas de pago adicionales (transferencia, tarjeta, dividido).
- [ ] Corte de caja (iniciar/curso/finalizar) con contador atómico.
- [ ] Mensajería (chat + flags protocolo).
- [ ] Apartados + abonos.
- [ ] Barcode scanner.
- [ ] Ticket PDF + share.
- [ ] Re-bind tras pérdida de caché.
- [ ] PWA offline verificado.
- [ ] Criterios N7-N12 cumplidos.

### Fase 3 — admin-web CRUD artículos (1 semana)

- [ ] Login admin + role guard.
- [ ] Lista artículos + buscador + filtros.
- [ ] Form CRUD con imagen principal + subvariaciones + tallas + promos.
- [ ] Generador ID secuencial atómico.
- [ ] Sync protocol `articulos_ac` (marcado por nodo).
- [ ] Criterios A1-A4 cumplidos.

### Fase 4 — admin-web gestión (1 semana)

- [ ] CRUD sucursales + nodos + equipo + tallas.
- [ ] Revocar nodo (invalida claims).
- [ ] Criterios A5, A6, A12 cumplidos.

### Fase 5 — admin-web vistas de ventas y reportes (1-2 semanas)

- [ ] Historial con filtros (TanStack Table).
- [ ] Detalle venta + ticket.
- [ ] Más vendidos + consulta por artículo + vista por precios.
- [ ] Apartados.
- [ ] Cortes historial.
- [ ] Dashboard.
- [ ] Criterios A7-A11, A13, A14 cumplidos.

### Fase 6 — Migración de datos legacy (2-3 días)

- [ ] Cloud Function `migrarDataLegacy` implementada completa.
- [ ] Dry-run: reporta qué se migraría (count por colección).
- [ ] Migración real: `articulos_n` → `articulos_n_web_new_version` (asignar al negocio default).
- [ ] Migración real: `ventas_n` → `ventas_n_web_new_version` (asignar a sucursal "legacy" + doc-por-venta).
- [ ] Verificación: UI admin muestra datos migrados correctamente.

### Fase 7 — Deploy producción (1-2 días)

- [ ] Sitios Firebase Hosting creados: `admin-amisetienda`, `nodo-amisetienda`.
- [ ] Dominios custom asignados (cuando el usuario provea).
- [ ] Whitelist en Firebase Auth.
- [ ] Reglas Firestore finales (bloqueo de writes legacy).
- [ ] Storage rules con cap 5 MB verificado.
- [ ] FCM topic `negocio_{negocioId}_web` para push.
- [ ] README de cada app con instrucciones de deploy.
- [ ] Smoke test end-to-end con una tablet real + un admin real.

---

## 8. Mecanismos cross-cutting

### 8.1 Offline y persistencia (nodo-web)

- `initializeFirestore(app, { localCache: persistentLocalCache({ cacheSizeBytes: CACHE_SIZE_UNLIMITED, tabManager: persistentMultipleTabManager() }) })`.
- `navigator.storage.persist()` tras primer login.
- Service Worker con Workbox (via `vite-plugin-pwa`).
- **Denylist** en SW para Firestore/Auth (no interceptar — WebChannel se rompería).
- Splash "necesitas red la primera vez" si `!navigator.onLine && !hasBootedBefore()`.

### 8.2 Escritura offline de venta

Una venta offline se encola en Firestore mutation queue. **Pero** la transacción del contador requiere red → si el nodo está offline, no puede leer el contador actual.

**Solución**:
- En modo offline, el `numeroDeVenta` se asigna con prefijo `OFFLINE-{nodoId}-{localSeq}` (local monotónico).
- Al reconectar, un job reconcilia: re-transacciona el contador y renombra los `numeroDeVenta` offline a los reales. Implementado vía Cloud Function `reconciliarVentasOffline` que corre al detectar docs con `numeroDeVenta` prefijado `OFFLINE-`.
- Trade-off: el ticket impreso offline muestra `OFFLINE-xxx` como número temporal, el ticket reimpreso post-sync muestra el número real.

### 8.3 Sync protocol de artículos (admin-web ↔ nodos)

Portado 1:1 del Android (`modulos_descarga/articulos.java:44-100`):

1. Admin edita artículo → escribe `articulos_n_web_new_version/{id}` + `datos_web_new_version/articulos_ac`:
   ```json
   {
     "huella": "...",
     "{articuloId}": [
       {"nodo_1_id": false},
       {"nodo_2_id": false}
     ]
   }
   ```
2. Cada nodo escucha `datos_web_new_version/articulos_ac`:
   - Detecta su flag en `false` → descarga el artículo → marca `true`.
   - Si todos los flags del `articuloId` son `true` → elimina esa entry.
   - Si no quedan entries → elimina el doc `articulos_ac`.

### 8.4 Notificaciones push (FCM)

- Web push vía Firebase Cloud Messaging con VAPID key.
- Token por dispositivo guardado en `nodos_web_new_version/{nodoId}.fcmToken`.
- Cloud Function `enviar` (existente, adaptada) envía a topic `negocio_{negocioId}_web`.
- Uso inicial: admin envía mensaje general → todos los nodos reciben push incluso cerrados.

### 8.5 Impresión (nodo-web)

- **Default MVP**: `pdfmake` genera PDF del ticket → `window.open(pdfBlobUrl)` abre diálogo impresión nativo.
- **Botón "Compartir"**: `navigator.share({ files: [pdfFile] })` en móvil → WhatsApp, email, etc.
- **Fase 2 (feature flag)**: Web Bluetooth API con comando ESC/POS para térmicas. Pairing inicial en Ajustes.
- **Fase 3 si aparece**: agente local Windows/Mac en puerto 9100 para impresoras serie/USB.

### 8.6 Escaneo código de barras (nodo-web)

```ts
if ('BarcodeDetector' in window) {
  // nativo Chrome Android
  const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128', 'qr_code'] });
  // usar con getUserMedia
} else {
  // @zxing/browser fallback universal (iOS Safari, Firefox)
  const reader = new BrowserMultiFormatReader();
  reader.decodeFromVideoDevice(...);
}
```

---

## 9. Migración de datos legacy (Fase 6)

Cloud Function `migrarDataLegacy({ dryRun })`:

1. **Artículos** (`articulos_n/{id}` → `negocios_web_new_version/{defaultNegocio}/articulos_n_web_new_version/{id}`):
   - Copy 1:1 campo por campo.
   - ID secuencial preservado.
   - Imágenes Storage: copiar de `media/articulos/` a `media_web_new_version/articulos/`.
   - Nota: en dry-run, reporta count + sample.

2. **Ventas** (`ventas_n/{y}/{m}/{d}.registro[]` → `negocios_web_new_version/{defaultNegocio}/sucursales_data_web_new_version/{sucursalLegacyId}/ventas_n_web_new_version/{y}/{m}/{d}/items/{ventaId}`):
   - Cada elemento del array `registro` pasa a ser un doc individual.
   - `ventaId` generado a partir de `huella` existente (para idempotencia — re-correr la migración no duplica).
   - Asignar `sucursalId = "sucursal-legacy"` (se crea una sucursal "Sucursal Original" al inicio de la migración).
   - Asignar `nodoId` a partir de `enTurno` mapping si es posible, o `"nodo-legacy"` genérico.

3. **Cortes** (`corte_1/{y}/{m}/{d}.registro[]` → doc-por-corte equivalente).

4. **Mensajes** (`mensajes_n/{y}/{m}/{d}` → `negocios_web_new_version/{defaultNegocio}/mensajes_n_web_new_version/{y}/{m}/{d}`):
   - Copy 1:1 (ambos son docs con array `mensajes`).

5. **Apartados** (`apartados/{id}` → por sucursal legacy).

6. **datos/** (`equipoDeTrabajo`, `tallas`, etc.) → `datos_web_new_version/` del negocio default.

Idempotencia: cada doc migrado lleva campo `_migradoEn: timestamp` para re-correr sin duplicar.

Reversibilidad: un flag `--rollback` que borra los docs migrados (identificados por `_migradoEn`).

---

## 10. Notas sobre el sufijo `_web_new_version`

- Aplica a **todas** las colecciones nuevas, tanto raíz (`negocios_web_new_version`) como anidadas (`articulos_n_web_new_version`, `ventas_n_web_new_version`, etc.).
- Elegida la ortografía correcta en inglés (`version` con `s`) por decisión del usuario ("lo que sea más aceptable en sintaxis").
- Un único find-and-replace basta para renombrar en el futuro si se decide cambiar a algo más corto (ej. `_v2`).

---

## 11. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Nodo re-bind malicioso (tablet robado) | Media | Medio | Log en `historial[]` + alerta admin + opción `revocarNodo` |
| Venta offline con `numeroDeVenta` temporal confunde al vendedor | Media | Bajo | UI muestra clarísimo "Venta offline, número temporal". Ticket se reimprime al sync |
| Firestore 1 MB límite en `mensajes_n` día con mucho chat | Baja | Medio | Docs de mensajes son ligeros. Si llega límite → partir por hora (`mensajes_n/{y}/{m}/{d}/{h}`) — cambio aditivo |
| Imagen > 5 MB Storage rules rechaza | Baja | Bajo | Compresión client-side WebP antes de upload + validación previa |
| Concurrencia de dos admins editando mismo artículo | Baja | Bajo | `updatedAt` + refresh opcional. Last-write-wins aceptable |
| Reloj cliente desincronizado genera `huella` mal ordenada | Baja | Bajo | `serverTimestamp()` de Firestore en el field `fechaISO` como source of truth |
| Usuario pierde caché en tablet y elige nodo equivocado | Media | Bajo | Riesgo aceptado por usuario + log de re-bind |

---

## 12. Confirmaciones finales del usuario

Todas las decisiones cerradas. Procede Fase 0.

| Decisión | Valor |
|---|---|
| Catálogo único | Por negocio, compartido entre sucursales. Stock único (no dividido por sucursal) |
| Sufijo colecciones | `_web_new_version` (ortografía correcta) |
| Sitio admin-web | `amise-admin.web.app` |
| Sitio nodo-web | `amise-nodo.web.app` |
| `negocioId` default | `"amise"` (display: "Amise") |
| Super admin inicial | `jesuscentenoramirez@gmail.com` |

---

## 13. Referencia rápida a archivos Android de origen

La matriz completa está en `MIGRACION_WEB_PREPLAN.md §7`. Úsala cuando implementes cualquier feature para consultar el comportamiento esperado en el código Android original.
