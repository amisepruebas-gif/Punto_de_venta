# Cloud Functions

> **Cuándo usar este doc**: al llamar, modificar o debuggear alguna Cloud
> Function. Todas viven en `functions/index.js`.

## Índice

1. [Inventario](#inventario)
2. [Helpers de autorización](#helpers-de-autorización)
3. [Endpoint HTTP: `enviar`](#enviar-endpoint-http)
4. [Auth / usuarios](#auth--usuarios)
5. [Sucursales y nodos](#sucursales-y-nodos)
6. [Triggers Firestore](#triggers-firestore)
7. [Migración legacy](#migración-legacy)
8. [Invocación desde frontend](#invocación-desde-frontend)
9. [Deploy y logs](#deploy-y-logs)

---

## Inventario

| Nombre | Tipo | Auth mínimo | Propósito |
|---|---|---|---|
| `enviar` | HTTP onRequest | Bearer token | Envía FCM push a topic del negocio |
| `setCustomClaims` | onCall | superadmin | Asigna role/negocioId/sucursalId/nodoId |
| `createUser` | onCall | superadmin | Crea admin/vendedor/superadmin |
| `createBusiness` | onCall | superadmin | Crea un negocio nuevo |
| `crearSucursal` | onCall | admin del negocio | Crea sucursal |
| `registrarNodo` | onCall | ninguno (público) | First-run: crea anonymous user + claims + doc nodo |
| `rebindNodo` | onCall | ninguno (público) | Re-vincula tablet a nodo existente tras perder caché |
| `revocarNodo` | onCall | admin del negocio | Invalida un nodo (revoke + deleteUser del Auth user) |
| `listarSucursales` | onCall | ninguno (público) | Lista sucursales de un negocio para first-run |
| `listarNodos` | onCall | ninguno (público) | Lista nodos activos de una sucursal para rebind |
| `getUserProfile` | onCall | autenticado | Perfil del propio usuario |
| `checkSubscriptionLimits` | onCall | autenticado | Verifica si cabe otro dispositivo/articulo/sucursal |
| `assignUserToBusiness` | onCall | superadmin | Reasigna admin a otro negocio |
| `reconciliarVentasOffline` | onDocumentCreated (v2) | (interno) | Asigna `numeroDeVenta` real a ventas offline |
| `migrarDataLegacy` | onCall (9 min timeout) | superadmin | Copia Android legacy → namespace nuevo |

---

## Helpers de autorización

Al inicio de `functions/index.js`:

```js
function requireAuth(context) {
  if (!context.auth) throw HttpsError("unauthenticated", ...);
  return context.auth.token;
}

function requireSuperAdmin(context) {
  const t = requireAuth(context);
  if (t.role !== "superadmin") throw HttpsError("permission-denied", ...);
}

function requireAdminOrSuper(context, negocioId) {
  const t = requireAuth(context);
  const ok = t.role === "superadmin" ||
             (t.role === "admin" && t.negocioId === negocioId);
  if (!ok) throw HttpsError("permission-denied", ...);
}
```

Las funciones públicas (`registrarNodo`, `rebindNodo`, `listarSucursales`,
`listarNodos`) NO requieren auth — aceptan cualquier llamante que conozca
el `negocioId`. Es un gate ligero (el `negocioId` del negocio default
`"amise"` está en el código del nodo).

---

## `enviar` (endpoint HTTP)

Push FCM a todos los dispositivos subscritos al topic del negocio.

```
POST https://us-central1-amisetienda-c7eab.cloudfunctions.net/enviar
Authorization: Bearer {idToken}
Content-Type: application/json

{
  "titulo": "Apertura",
  "mensaje": "Abrimos en 10 min"
}
```

- Verifica `Bearer idToken` (auth nativa Firebase).
- Extrae `negocioId` del claim. Topic: `negocio_{negocioId}_web`.
- Fallback legacy: si no hay `negocioId`, usa topic `"all"`.

**Pendiente**: los nodos no están subscritos al topic aún — el push llega a
0 dispositivos hoy. Ver [`09-deuda-tecnica.md`](09-deuda-tecnica.md).

---

## Auth / usuarios

### `setCustomClaims`

```ts
setCustomClaims({
  uid: string,
  role: "superadmin" | "admin" | "vendedor" | "nodo",
  negocioId?: string,
  sucursalId?: string,   // solo si role=nodo
  nodoId?: string,       // solo si role=nodo
})
```

- Side effects: `admin.auth().setCustomUserClaims()` + actualiza
  `usuarios/{uid}`.
- El cliente debe forzar refresh del token (`user.getIdToken(true)`) para
  ver los claims nuevos.

### `createUser`

Crea un usuario admin o vendedor desde el panel super-admin.

```ts
createUser({ email, password, nombre, role, negocioId? })
```

- Auth: `superadmin` only.
- Side effects: `admin.auth().createUser()` + asigna claims + crea
  `usuarios/{uid}`.
- **No usado aún** por el admin-web (UI pendiente en `ajustes/`).

### `createBusiness`

Crea un negocio nuevo en `negocios_web_new_version/{negocioId}`. Para
multi-negocio.

```ts
createBusiness({
  negocioId?: string,   // si se omite, ID aleatorio
  nombre: string,
  plan?: "basico",
  limiteSucursales?, limiteDispositivos?
})
```

El seed inicial usa esto via `setup-initial.js` con `negocioId: "amise"`.

---

## Sucursales y nodos

### `crearSucursal`

Solo admin/superadmin del negocio. Desde la UI `/sucursales`.

```ts
crearSucursal({ negocioId, nombre, direccion, telefono? })
```

- Crea `sucursales_web_new_version/{sucursalId}` con `activa: true`.
- `createdBy` = uid del caller.

### `registrarNodo` — FIRST-RUN

**Función crítica**. Llamada desde nodo-web cuando un tablet arranca por
primera vez sin `localStorage.amise_nodo_session`.

```ts
registrarNodo({
  negocioId: string,
  sucursalId?: string,          // si existe, usar esa
  nuevaSucursal?: {             // si no, crearla
    nombre, direccion, telefono?
  },
  nombreNodo: string,           // "Caja 1"
  registradoPor: string,        // nombre humano
  userAgent?: string
})

→ { nodoId, sucursalId, negocioId, customToken }
```

Side effects:

1. Si viene `nuevaSucursal`, crea `sucursales_web_new_version/{newSid}`.
2. Crea un nuevo Firebase Anonymous Auth user.
3. Asigna custom claims `{role:"nodo", negocioId, sucursalId, nodoId}`.
4. Crea doc `nodos_web_new_version/{nodoId}` con `estado: "activo"` e
   inicializa `historial`.
5. Genera custom token y lo retorna.

El cliente hace `signInWithCustomToken(customToken)` y queda loggeado.

### `rebindNodo`

Tablet pierde caché → pantalla de "Tablet recuperada". Lista nodos activos,
usuario elige → llama `rebindNodo`.

```ts
rebindNodo({ negocioId, nodoId, userAgent?, registradoPor? })
→ { nodoId, sucursalId, negocioId, customToken }
```

Side effects:

1. Verifica que el nodo exista y esté `activo`. Si `revocado`, throw.
2. Crea un **nuevo** Anonymous Auth user (distinto al authUid anterior).
3. Asigna mismos claims del nodo.
4. **FIX A4**: `revokeRefreshTokens(nodo.authUid_anterior)` + `deleteUser`
   del authUid viejo — evita que un token viejo siga siendo válido.
5. Registra evento en `nodo.historial[]` con tipo `"rebind"`.
6. Actualiza `authUid`, `userAgent`, `ultimoAcceso`.
7. Retorna custom token nuevo.

### `revocarNodo`

Admin bloquea una tablet (perdida/robada/rota) desde `/nodos`.

```ts
revocarNodo({ negocioId, nodoId })
```

Side effects:

1. Marca `estado: "revocado"` y agrega evento a `historial`.
2. `revokeRefreshTokens(authUid)` — invalida refresh tokens.
3. `setCustomUserClaims(authUid, {role:"revocado"})` — los ID tokens
   emitidos siguen siendo válidos **hasta 1 hora**. Ver riesgo en
   [`04-auth-y-roles.md`](04-auth-y-roles.md) "Riesgo F5".

### `listarSucursales` / `listarNodos`

Públicas (no requieren auth) — sólo sirven para el first-run y el
flujo de rebind del nodo, que aún no tiene auth.

```ts
listarSucursales({ negocioId })
→ { sucursales: Array<{sucursalId, nombre, direccion}> }   // filter activa==true

listarNodos({ negocioId, sucursalId })
→ { nodos: Array<{nodoId, nombre, registradoPor, fechaRegistro}> } // filter estado==activo
```

---

## Triggers Firestore

### `reconciliarVentasOffline`

Tipo: v2 `onDocumentCreated` trigger.

Path pattern:

```
negocios_web_new_version/{negocioId}/
  sucursales_data_web_new_version/{sucursalId}/
  ventas_n_web_new_version/{year}/{month}/{day}/items/{ventaId}
```

Lógica:

1. Se dispara con cada venta creada.
2. Si `numeroDeVenta` NO empieza con `"OFFLINE-"`, return (ignorar).
3. Si sí:
   - Abre transacción sobre `contadores_web_new_version/{ymd}`.
   - Asigna `numeroReal = (prev.ultimoNumeroVenta ?? -1) + 1`.
   - Actualiza la venta: `numeroDeVenta = numeroReal`, preserva original
     en `numeroDeVentaOffline`, añade `reconciliadoEn: serverTimestamp`.
   - Incrementa el contador.

Esto garantiza que las ventas offline terminen con el número correcto en
la secuencia, sin colisiones con ventas online concurrentes.

**Memoria**: el trigger auto-recursa si cambiamos `numeroDeVenta` de
`OFFLINE-` a `numero real`? No — el update no cumple el path pattern de
"create" entonces no re-dispara. ✓

---

## Migración legacy

### `migrarDataLegacy`

Config: `runWith({timeoutSeconds: 540, memory: "1GB"})`.

```ts
migrarDataLegacy({
  negocioId: string,
  sucursalId: string,   // sucursal destino para ventas/cortes/apartados
  dryRun?: boolean,
  solo?: "articulos" | "ventas" | "cortes" | "mensajes" | "apartados" | "datos"
})

→ { success, dryRun, articulos, ventas, cortes, mensajes, apartados, datos, errores[] }
```

Mapeo:

| Source legacy | Destino nuevo |
|---|---|
| `articulos_n/{id}` | `negocios_w/{nid}/articulos_n_w/{id}` (1:1) |
| `ventas_n/{y}/{m}/{d}.registro[]` | `sucursales_data_w/{sid}/ventas_n_w/{y}/{m}/{d}/items/{huella}` (split) |
| `corte_1/{y}/{m}/{d}.registro[]` | `sucursales_data_w/{sid}/corte_1_w/{y}/{m}/{d}/items/{id}` (split) |
| `mensajes_n/{y}/{m}/{d}` | `mensajes_n_w/{y}/{m}/{d}` (1:1) |
| `apartados/{id}` | `sucursales_data_w/{sid}/apartados_w/{id}` (1:1) |
| `datos/equipoDeTrabajo` | `datos_w/equipoDeTrabajo` |
| `datos/tallas` | `datos_w/tallas` |
| `datos/transferencia_datos` | `datos_w/transferencia_datos` |

Idempotencia: cada doc destino lleva `_migradoEn: Timestamp`. El ID del
doc es la `huella` del registro original — re-runs no duplican.

Edge case I1 (ver [`09-deuda-tecnica.md`](09-deuda-tecnica.md)): si un
registro legacy no tiene `huella`, se usa `legacy_${counter}` — NO idempotente.

Log de runs: `datos_web_new_version/_migracionesLegacy` con key timestamp.

---

## Invocación desde frontend

### Admin-web

`admin-web/src/firebase/callables.ts` exporta wrappers tipados:

```ts
import { fnCrearSucursal, fnMigrarDataLegacy } from "@/firebase/callables";

const res = await fnCrearSucursal({ negocioId, nombre, direccion });
console.log(res.data.sucursalId);
```

### Nodo-web

`nodo-web/src/firebase/callable.ts` — misma idea, sólo las CFs que el nodo
usa:

```ts
import { fnRegistrarNodo, fnRebindNodo, fnListarSucursales } from "@/firebase/callable";
```

### Para invocar una CF NUEVA

1. Agregar el export en `functions/index.js`.
2. Deploy: `firebase deploy --only functions:NOMBRE`.
3. Agregar el wrapper typed en el frontend callables file.

---

## Deploy y logs

### Deploy de functions

```bash
# Todas
firebase deploy --only functions

# Una específica (más rápido)
firebase deploy --only functions:registrarNodo
```

### Ver logs en tiempo real

```bash
# Todas
firebase functions:log

# Filtrar
firebase functions:log --only registrarNodo

# Últimas N entries
firebase functions:log -n 50
```

### Dashboard Firebase Console

`https://console.firebase.google.com/project/amisetienda-c7eab/functions/list`

Ver invocations, errors, execution time, memory.

### Emuladores (dev local)

```bash
cd functions
npm run serve   # firebase emulators:start --only functions
```

Con los emuladores, el `admin-web` y `nodo-web` apuntan a local si se
configura con `connectFunctionsEmulator(functions, 'localhost', 5001)`.
No está configurado por default — si lo quieres usar, modificar
`firebase/config.ts` con env var.
