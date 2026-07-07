# Guía: Super Admin / POS‑as‑a‑Service

> **Objetivo.** Convertir el POS actual (`nodo-web`) y su panel (`admin-web`) en un
> **servicio de puntos de venta multi‑cliente**, operado por un **Super Admin (proveedor)**
> que da de alta clientes, les asigna uno de **3 planes**, y cobra por **periodos
> (mensual / anual)** vía **Stripe** o registrando **pagos manuales** ("ya me pagaron").
>
> Esta guía está anclada al **código real** de `nodo-web` y `admin-web` (no es genérica).
> Marca qué existe hoy, qué hay que agregar, dónde vive cada cambio y en qué orden hacerlo.

---

## 0. TL;DR (lo esencial en 12 líneas)

1. **Tenant = negocio.** Reutilizamos la raíz que ya existe: `negocios_web_new_version/{negocioId}`. No se renombra nada. `tenantId === negocioId`.
2. **Un solo proyecto Firebase** (`amisetienda-c7eab`), aislamiento **por path + por claim** (no proyecto‑por‑cliente). El data model ya cuelga de `negocios_web_new_version/{nid}` → solo falta cablearlo.
3. **El Super Admin vive en una app nueva** `superadmin-web` (4º hosting target), clon de `admin-web`. No se mezcla con los admins de cada negocio.
4. **3 planes** (Básico $99 · Pro $199 · Avanzado $259/mes) en la colección raíz `planes` (ya declarada como `COL_PLANES`, hoy sin uso). Periodos: mensual, anual (cobra **10** meses, otorga **12**) y pago único a 3 años (solo Pro: cobra **30**, otorga **36**). Add‑on de personalización **$999** one‑time.
5. **Suscripción por negocio**: subdoc `datos_web_new_version/suscripcion` (fuente de verdad) + campos espejo en el doc `Negocio` (para gatear rápido, ya lo lee `useNegocio`).
6. **Pagos**: subcolección append‑only `pagos_web_new_version/{pagoId}` (historial inmutable).
7. **Billing v1 = solo manual** desde el dashboard, con **dos subsecciones** (*"me pagaron al precio del plan"* — elige plan + periodo · *"me pagaron a otro precio"* — monto libre) y una acción aparte de **personalización $999**. **Stripe queda pendiente** (Fase 5).
8. **Vencimiento**: `nuevaVigencia = addMeses( max(hoy, vigenteHasta), mesesVigencia )` — si sigue vigente se suman al final; si ya venció, cuenta desde hoy. Ojo: **anual cobra 10 pero otorga 12 meses** (y el pago único cobra 30, otorga 36).
9. **Auth**: `admin-web` ya hace **Google + correo/contraseña**. Falta agregar login humano (Google + correo/contraseña) en `nodo-web` (hoy solo se autentica el dispositivo con custom token).
10. **Enforcement en 3 capas**: gate de UI (UX) + **Firestore Rules** (seguridad real) + **Cloud Functions** (provisioning + cron de vencimiento). Hoy **no existe** ningún bloqueo por estado/vencimiento.
11. **Estados de cuenta**: `prueba → activo → en_gracia (7 días, uso completo + aviso) → suspendido → cancelado`, con un **cron diario** que transiciona por fecha (el reloj del cliente no es confiable).
12. **Migración**: backfill del negocio actual (`amise`) con suscripción `activo` y vigencia lejana, para no auto‑bloquear producción al desplegar el gating.

---

## 1. Estado actual (lo que el código realmente hace hoy)

### 1.1 `admin-web` (panel)
- **Auth**: ya soporta **Google** (`signInWithPopup`, `prompt:'select_account'`) **y correo/contraseña** (`signInWithEmailAndPassword`, marcado como *legacy/fallback de transición*) en `routes/Login.tsx`.
- **Gating por custom claims**: `hooks/useAuth.ts` lee `role / negocioId / sucursalId / nodoId` del ID token vía `onIdTokenChanged` (deliberado, para enterarse del rol nuevo apenas la CF setea claims). `App.tsx` solo deja pasar `role === 'superadmin' || 'admin'`.
- **Whitelist de admins delegados**: `fnVerificarAdminWhitelist` eleva un email a `role:'admin'` server‑side; vive en Firestore `chat_whitelist_admin_*` por negocio. El **superadmin** (jesús) está *bootstrapeado* server‑side y **se salta** la whitelist (de ahí el fix reciente "superadmin no podía entrar por Google").
- **Tenant**: `hooks/useNegocio.ts` resuelve el `negocioId` del **claim**; si no hay claim y el rol es `superadmin`, cae al **fallback literal `'amise'`** (`VITE_NEGOCIO_ID || 'amise'`). Comentario en el propio código: *"Multi‑negocio UI añadirá un selector en Fase 4"*.

### 1.2 `nodo-web` (POS)
- **No hay login humano.** El dispositivo se autentica con **`signInWithCustomToken`**, emitido por las Cloud Functions `registrarNodo` / `rebindNodo`.
- **Identidad de tenant**: vive en `localStorage['amise_nodo_session'] = {nodoId, sucursalId, negocioId, nombreNodo}` **y** el `negocioId` está **hardcodeado** en `config.ts` (`NEGOCIO_ID = VITE_NEGOCIO_ID || 'amise'`, build‑time).
- **Gating de rutas**: `App.tsx` decide *first‑run* vs POS **solo por la presencia de `nodoId` en localStorage** — NO valida el estado real de Firebase Auth ni ninguna suscripción.
- **First‑run**: elegir/crear sucursal → registrar nodo (o *rebind* para recuperar una tablet). Sin pantalla de login tradicional.

### 1.3 Modelo de datos (Firestore) — **ya es multi‑negocio por path**
Todo se deriva de `shared/src/collections.ts` (`paths` + constantes `COL_*`). Raíz del tenant: **`negocios_web_new_version/{negocioId}`**.

| Dato | Ruta |
|---|---|
| Negocio (tenant) | `negocios_web_new_version/{nid}` |
| Sucursal | `…/{nid}/sucursales_web_new_version/{sid}` |
| Nodo (tablet) | `…/{nid}/nodos_web_new_version/{nodoId}` |
| Singletons de config | `…/{nid}/datos_web_new_version/{docKey}` (`equipoDeTrabajo`, `switches`, `pinVentas`, `refrescoRender`, `tallas`…) |
| Artículos | `…/{nid}/articulos_n_web_new_version/{artId}` |
| Ventas | `…/{nid}/sucursales_data_web_new_version/{sid}/ventas_n_web_new_version/{y}/{m}/{d}/items/{ventaId}` |
| Cortes | `…/{nid}/sucursales_data_web_new_version/{sid}/corte_1_web_new_version/{y}/{m}/{d}` |
| Apartados | `…/{nid}/sucursales_data_web_new_version/{sid}/apartados_web_new_version/{apId}` |
| **Globales (sin scope de negocio)** | `system/auth_kick_switch`, `usuarios`, **`planes`** (← `COL_PLANES` declarada **pero sin uso runtime**) |

- **Custom claims** (fuente de aislamiento): `{ role: 'superadmin'|'admin'|'vendedor'|'nodo', negocioId?, sucursalId?, nodoId? }`.
- **Proyecto único** `amisetienda-c7eab` (hardcodeado e idéntico en ambos `firebase/config.ts`). Deploy multi‑target en `firebase.json`/`.firebaserc`: `admin → amise-admin`, `nodo → amise-nodo`, `mercancia → amise-mercancia`. Functions `nodejs20`, región **default `us-central1`**.

### 1.4 La verdad incómoda (lo que NO existe hoy)
- ❌ **Cero billing**: sin Stripe, sin pagos, sin facturas, sin trial, sin vencimiento/vigencia. (Todo "plan/pago/suspendido" que aparece en `nodo-web` son falsos positivos: plan de migración, ticket de prueba, apartado cancelado…)
- ❌ **Campos fantasma**: `Negocio.plan`, `Negocio.estado` (`activo|suspendido|cancelado`), `limiteSucursales`, `limiteDispositivos` existen en `shared/src/schema.ts` **pero ningún `.tsx`/`.ts` de producción los lee**. Un negocio "suspendido" hoy **opera con total normalidad**.
- ❌ **De‑facto single‑tenant**: ambos fallback caen a `'amise'`. No hay selector de negocio. El "superadmin" actual es el **dueño de un negocio**, no un **operador de plataforma** que administre clientes.
- ❌ **Sin enforcement**: las escrituras solo dependen del claim `negocioId`, no de ningún estado de cuenta.

> **Conclusión de partida:** la estructura de datos ya soporta multi‑tenant; lo que falta es la **capa SaaS** (planes, suscripción, pagos, billing), el **enforcement** (gate + rules + cron) y la **consola del proveedor**.

---

## 2. Arquitectura objetivo

```
                       ┌────────────────────────┐
                       │   superadmin-web (NEW)  │  ← proveedor (jesús)
                       │  /tenants  /planes  ... │     role: superadmin
                       └───────────┬────────────┘
                                   │ Cloud Functions (solo role superadmin)
                                   │ provisionarTenant, registrarPagoManual, …
                ┌──────────────────┴───────────────────┐
                ▼                                       ▼
   ┌────────────────────────┐              ┌────────────────────────┐
   │      admin-web         │              │       nodo-web (POS)    │
   │  role: admin (tenant)  │              │  role: vendedor + nodo  │
   │  Google / correo+pass  │              │  Google / correo+pass   │
   └───────────┬────────────┘              └───────────┬────────────┘
               │   lee/escribe SU negocio (claim negocioId) + gate de suscripción
               └───────────────┬───────────────────────┘
                               ▼
            Firestore (proyecto único amisetienda-c7eab)
            negocios_web_new_version/{negocioId}/...     ← aislamiento por path + claim
            planes/{planId}   system/proveedor           ← datos del proveedor
            Reglas: request.auth.token.negocioId == nid  &&  suscripciónVigente(nid)
```

**Decisión de aislamiento: mismo proyecto Firebase, scope por `tenantId` en el path.** Justificación:
1. Toda la data ya cuelga de `negocios_web_new_version/{negocioId}`.
2. `firebaseConfig` está hardcodeado e idéntico → proyecto‑por‑cliente exigiría un bundle por cliente y rompería el deploy multi‑target.
3. Rules y Functions son compartidas a nivel proyecto; multiplicarlas por tenant es inviable para un proveedor único.
4. Proyecto‑por‑tenant solo se justificaría por residencia de datos / un cliente enterprise que lo exija. **No es el caso hoy.**

---

## 3. Modelo de datos SaaS (Firestore)

### 3.1 Planes — colección raíz `planes/{planId}` (cablea `COL_PLANES`)
```ts
type Plan = {
  planId: 'basico' | 'pro' | 'avanzado'
  nombre: string
  orden: number
  precioMensual: number          // centavos MXN: 9900 | 19900 | 25900
  moneda: 'MXN'
  incluyeImagenes: boolean        // básico:false · pro/avanzado:true (SOLO foto de artículo; la IA quitar fondo va aparte)
  modulos?: { apartados?: boolean; resurtidos?: boolean; chatGrupo?: boolean }  // baseline de funciones del plan (se afina en /planes)
  limiteNodos: number             // dispositivos: 1 | 3 | 10
  limiteAdmins: number            // 1 | 3 | 5
  limiteSucursales: number        // 1 | 3 | 10
  trialDias: number               // p.ej. 14
  graciaDias: number              // 7 (todos)
  // paquetes de cobro disponibles para este plan:
  periodos: Array<{
    clave: 'mensual' | 'anual' | 'unico_3a'
    nombre: string
    mesesPago: number             // meses que se COBRAN: 1 | 10 | 30
    mesesVigencia: number         // meses de servicio que OTORGA: 1 | 12 | 36
    incluyeAsistenciaPersonal?: boolean   // solo unico_3a (Pro)
  }>
  addonPersonalizacion: { disponible: true; precio: number }  // 99900 = $999, one-time
  stripePriceMensual?: string     // Stripe pendiente (Fase 5)
  stripePriceAnual?: string
  activoParaVenta: boolean
}
// precio de un periodo = precioMensual * mesesPago (no se almacena, se deriva)
```

### 3.2 Suscripción — **fuente de verdad** en subdoc + **espejo** en el doc Negocio
**Fuente de verdad** (rica, escrita solo por CF/superadmin): reutiliza `COL_DATOS` igual que `equipoDeTrabajo`/`switches`:
```
negocios_web_new_version/{nid}/datos_web_new_version/suscripcion
```
```ts
type Suscripcion = {
  negocioId: string
  planId: string
  origen: 'manual' | 'stripe'
  estado: 'prueba' | 'activo' | 'en_gracia' | 'suspendido' | 'cancelado'
  periodo?: 'mensual' | 'anual'
  fechaInicio: string            // ISO
  fechaVencimiento: string       // ISO  ← la fecha que importa
  graciaHasta?: string           // ISO  (fechaVencimiento + graciaDias)
  motivoSuspension?: 'pago_fallido' | 'vencimiento' | 'manual'
  // límites snapshot del plan AL ACTIVAR (para que editar el catálogo no cambie
  // retroactivamente a los tenants ya activos):
  limitesEfectivos: { sucursales: number; dispositivos: number }
  // Stripe (si aplica):
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  cancelAtPeriodEnd?: boolean
  ultimoPagoId?: string
  actualizadoEn: string          // ISO
  actualizadoPor: string         // uid superadmin | 'stripe-webhook' | 'cron'
}
```
**Espejo / caché para gatear rápido** — sobre el doc `negocios_web_new_version/{nid}` (que `useNegocio` **ya lee en vivo** con `onSnapshot`, así el gate cuesta **0 lecturas extra**). La misma CF escribe ambos en el **mismo batch**:
```ts
// añadir a type Negocio (dejan de ser "fantasma"):
estado: 'activo' | 'suspendido' | 'cancelado'   // ya existe → ahora SÍ se lee
plan: string                                     // ya existe → planId actual
fechaVencimiento: string                         // NUEVO (ISO)
graciaHasta?: string                             // NUEVO (ISO)
limiteSucursales: number                         // ya existe → ahora SÍ se valida
limiteDispositivos: number                       // ya existe → ahora SÍ se valida (= nodos)
limiteAdmins: number                             // NUEVO (1 / 3 / 5)
incluyeImagenes: boolean                          // NUEVO (gate de foto de artículo)
personalizaciones?: {                             // NUEVO (add-on $999): overrides de módulos por tenant
  funciones?: Record<string, boolean>             // p.ej. { apartados:true, resurtidos:false }
  nota?: string; pagoId?: string; fecha?: string
}
```

> **Funciones efectivas por tenant:** `funcionActiva(k) = personalizaciones?.funciones?.[k] ?? plan.modulos?.[k] ?? default`. El add‑on **$999** escribe `personalizaciones.funciones` para **activar/desactivar módulos específicos** (apartados, resurtidos, chat…) por encima de lo que da el plan, sin cambiar de plan.

### 3.3 Pagos — subcolección append‑only `pagos_web_new_version/{pagoId}` (inmutable)
```ts
type Pago = {
  pagoId: string
  negocioId: string
  concepto: 'suscripcion' | 'personalizacion'   // suscripcion extiende vigencia; personalizacion NO
  metodo: 'manual' | 'stripe'                    // v1: siempre 'manual'
  planId: string                 // snapshot
  periodo?: 'mensual' | 'anual' | 'unico_3a'
  mesesPago: number              // meses cobrados (1,10,30) — 0 si concepto='personalizacion'
  mesesVigencia: number          // meses otorgados (1,12,36) — 0 si personalizacion
  precioUnitario: number         // centavos por mes cobrado
  monto: number                  // centavos cobrados realmente
  moneda: 'MXN'
  esPrecioEspecial?: boolean      // true si el monto no coincide con el precio de lista
  nota?: string                   // "descuento amigo", folio de transferencia, alcance del addon…
  comprobanteUrl?: string         // Storage (opcional)
  vigenteAntes: string | null     // ISO de la vigencia previa
  vigenteDespues: string          // ISO resultante (= vigenteAntes si personalizacion)
  registradoPor: string           // uid+email superadmin | 'stripe-webhook'
  stripeInvoiceId?: string
  stripeEventId?: string
  fechaISO: string                // server time
}
```

### 3.4 Soporte
- `system/proveedor` → config del operador: `{ nombre, monedaDefault:'MXN', trialDiasDefault, graciaDiasDefault, soporteEmail? }` (junto al ya existente `system/auth_kick_switch`).
- `stripeCustomers/{stripeCustomerId} → { negocioId }` (índice inverso para el webhook en O(1)).
- `stripe_events_web_new_version/{eventId}` (idempotencia del webhook).
- *(Opcional, si crece el nº de tenants)* `tenants_index_web_new_version/{nid}`: proyección ligera (`nombre, estado, planId, fechaVencimiento, #sucursales, #nodos`) mantenida por CF, para que la consola liste/filtre sin abrir N subdocs.

### 3.5 Claims extendidos (server‑side; el cliente **nunca** setea claims)
```ts
type AuthClaims = {
  role: 'superadmin' | 'admin' | 'vendedor' | 'nodo'
  negocioId?: string             // identidad estable; aísla en las Rules
  sucursalId?: string
  nodoId?: string
}
```
> **Patrón clave: claims = autorización estable; Firestore = estado mutable.**
> El `negocioId` va en el claim (viaja gratis en cada request, aísla en Rules). El **estado de suscripción NO va en claims** (cambia seguido; el ID token vive ~1 h y no se puede revocar al instante) → vive en Firestore y las Rules lo leen con `get()`.

---

## 4. Planes y precios (definitivos)

Moneda **MXN**. Periodos: **mensual**, **anual** (se cobran **10 meses**, 2 de regalo) y **pago único a 3 años** (solo en el tier Pro). Todos con **7 días de gracia** al vencer.

| planId | Nombre | Sucursales | Nodos | Admins | Imágenes | Mensual | Anual (×10) | Pago único 3 años |
|---|---|---|---|---|---|---|---|---|
| `basico` | Básico | 1 | 1 | 1 | ❌ | **$99** | **$990** | — |
| `pro` | Pro | 3 | 3 | 3 | ✅ | **$199** | **$1,990** | **$5,970** (cobra 30 meses → **36 de vigencia**, con asistencia personal) |
| `avanzado` | Avanzado | 10 | 10 | 5 | ✅ | **$259** | **$2,590** | — |

**Reglas de cobro:**
- **Anual** = `precioMensual × 10`, otorga **12 meses** de vigencia (2 gratis).
- **Pago único 3 años** (solo Pro) = `precioMensual × 30` = **$5,970**, otorga **36 meses** (6 gratis), **pago no recurrente**, incluye **asistencia personal controlada**.
- **Add‑on de personalización** = **$999 pago único**, en **cualquier plan**. Cargo de servicio para **adaptar características** a los requerimientos del cliente; **no extiende la vigencia** (no suma meses), se registra como pago aparte (`concepto:'personalizacion'`).
- **Imágenes** = **solo foto del artículo** (subir/mostrar): **Básico NO**, Pro y Avanzado **SÍ** → flag `incluyeImagenes`. *(La IA de quitar fondo / Nanobanana **no** forma parte de los planes; se trata aparte.)*
- **Límites por plan**: sucursales **1 / 3 / 10** · nodos **1 / 3 / 10** · admins **1 / 3 / 5**. Se validan al provisionar (CF) y en la UI.

> **Clave del modelo de cobro:** distinguir **meses cobrados** (`mesesPago`) de **meses de vigencia** (`mesesVigencia`). Anual cobra 10 / da 12; el pago único cobra 30 / da 36. La **extensión** de la suscripción usa `mesesVigencia`; el **monto** usa el precio.

Los 3 docs viven en `planes/{planId}`. Editar un precio aquí afecta el autollenado de pagos y el MRR, **pero no** reescribe los `limitesEfectivos` de los tenants ya activos (son snapshot al activar).

---

## 5. Billing — v1 solo manual, Stripe en Fase 5

> **Decisión:** la **versión 1 cobra solo de forma manual** (el superadmin marca "ya me pagaron"). La integración con **Stripe queda pendiente** (Fase 5); el diseño §5.1 se documenta para esa fase.

### 5.1 Vía A — Stripe *(PENDIENTE — Fase 5)*
**Catálogo**: en Stripe, un **Producto por plan** y **2 Prices recurrentes** (mensual, anual). Los `priceId` se guardan en `planes/{planId}` → el mapeo plan↔price es **data, no código**.

**Funciones** (codebase `functions`, `nodejs20`, misma región `us-central1`; secretos `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET` en Secret Manager, mismo patrón que `quitarFondoImagen`):

| Función | Tipo | Qué hace |
|---|---|---|
| `crearCheckoutSession({negocioId, planId, periodo})` | callable | Valida ownership, resuelve `priceId`, crea Stripe Customer (guarda `metadata.negocioId` + índice inverso), devuelve `{url}`. Cliente: `window.location = url`. |
| `crearPortalSession({negocioId})` | callable | `billingPortal.sessions.create` → `{url}` (cambiar tarjeta, cancelar, cambiar plan). |
| `stripeWebhook` | **HTTP `onRequest`** | Server‑to‑server con firma. **No puede ser callable.** |

**Webhook** — verifica firma con **`req.rawBody`** (no `JSON.stringify(req.body)`, o la firma falla intermitente). Eventos:
- `checkout.session.completed` / `customer.subscription.created|updated` → escribe `suscripcion` (`estado` mapeado: `active|trialing→activo`, `past_due|unpaid→en_gracia/suspendido`, `canceled→cancelado`; `vigenteHasta = sub.current_period_end`).
- `invoice.payment_succeeded` → **renovación**: asienta un `Pago` y extiende vigencia (la fecha la **manda Stripe**).
- `invoice.payment_failed` → `estado='en_gracia'` con `graciaHasta` (no cortar al instante).
- `customer.subscription.deleted` → `estado='cancelado'`.

**Idempotencia** (Stripe reintenta): al entrar el webhook, `create()` de `stripe_events_web_new_version/{eventId}` dentro de una **transacción**; si ya existe → responder `200` y salir. Cada `Pago` de Stripe usa `stripeInvoiceId`/`stripeEventId` como `pagoId` determinista (segunda barrera). **Todo el asiento (`suscripcion` + `pago` + marca de evento) en un solo batch/transacción atómica.** Responder `200` si se procesó o ya estaba; `4xx` solo si la firma es inválida; `5xx` en fallo transitorio (para que Stripe reintente).

### 5.2 Vía B — Pago manual ("ya me pagaron") — **v1**
Ruta en `superadmin-web` → **modal "Registrar pago"** en el detalle del tenant. Llama a **una sola** CF `registrarPagoManual` que calcula la vigencia server‑side. Tres acciones:

**Subsección (1) — "Me pagaron al precio del plan"**
- Inputs: `planId` (precargado del actual) y **periodo** (`mensual` / `anual` / `unico_3a` solo en Pro).
- El sistema toma del catálogo `mesesPago` y `mesesVigencia` del periodo, `precioUnitario = plan.precioMensual`, `monto = precioUnitario × mesesPago`. El superadmin **no teclea** precio.
  - Ej. Pro **anual** → cobra `199×10 = $1,990`, extiende **12 meses**.
  - Ej. Pro **pago único 3 años** → cobra `199×30 = $5,970`, extiende **36 meses**, marca asistencia personal.
- `registrarPagoManual({ negocioId, planId, periodo, usarPrecioPlan:true })`.

**Subsección (2) — "Me pagaron a OTRO precio"** (descuento / trato especial)
- Inputs: `planId`, `periodo` (define `mesesVigencia`) y **`monto` personalizado** (lo teclea el superadmin).
- Se registra el **monto real cobrado**, con `esPrecioEspecial:true` y `nota` opcional.
- `registrarPagoManual({ negocioId, planId, periodo, usarPrecioPlan:false, monto:P })`.

**Acción aparte — "Cargo de personalización ($999)"**
- One‑time, cualquier plan. `concepto:'personalizacion'`, `monto:99900`, **no extiende vigencia** (`mesesVigencia:0`).
- Sirve para **activar/desactivar funciones específicas** del cliente (p.ej. habilitar **apartados** o **resurtidos**, o quitar un módulo). Además del `Pago`, escribe `negocio.personalizaciones.funciones` con los overrides y guarda el alcance en `nota`.
- `registrarPagoManual({ negocioId, concepto:'personalizacion', monto:99900, funciones:{ apartados:true }, nota })`.

**Cálculo de la nueva vigencia (server‑side, también reutilizable por Stripe):**
```
ahora   = serverTimestamp()                              // NUNCA la fecha del cliente
base    = (vigenteHasta && vigenteHasta > ahora) ? vigenteHasta : ahora
vigenteHastaNueva = addMeses(base, mesesVigencia)        // 1 | 12 | 36 ; suma calendario, clamp a fin de mes
graciaHasta       = addDias(vigenteHastaNueva, 7)        // 7 días de gracia
estado  = 'activo'                                        // reactiva si estaba suspendido/cancelado
```
- Se extiende por **`mesesVigencia`** (12 en anual, 36 en el pago único), **no** por los meses cobrados.
- Si **sigue vigente** → se suman al final (no se pierden días). Si **ya venció** → cuenta desde hoy.
- `concepto:'personalizacion'` **no** toca la vigencia; solo asienta el `Pago`.
- Tras extender: escribir `suscripcion` + espejo en doc `Negocio` (mismo batch) + crear el `Pago`.

**Historial**: cada pago queda en `pagos_web_new_version` (append‑only, inmutable): concepto, método, plan, meses cobrados/otorgados, precio, monto, quién y cuándo.

---

## 6. Autenticación (Google + correo/contraseña)

> Requisito del usuario: *"las cuentas de los puntos de venta (nodo y pos) deberán loguearse con Google o correo y contraseña."*

### 6.1 Estado y meta
| App | Hoy | Meta |
|---|---|---|
| `admin-web` | ✅ Google + correo/contraseña (legacy) | Mantener ambos; resolver el tenant por email (no fijo a `'amise'`). |
| `nodo-web` | ❌ Solo `signInWithCustomToken` del **dispositivo** | **Agregar login humano** (Google + correo/contraseña) del **operador/cajero**. |

### 6.2 Recomendación para `nodo-web`: **dos identidades** (no mezclar)
- **El dispositivo** sigue con `customToken` → ancla el tenant de forma **verificable** en sus claims (`{role:'nodo', negocioId, sucursalId, nodoId}`), eliminando la dependencia de localStorage como única fuente de tenant.
- **El operador** inicia sesión **encima** con Google o correo/contraseña (`{role:'vendedor', negocioId, sucursalId}`) → da **auditoría humana** (`vendedorUid` en cada venta).

> **Decisión tomada (más robusto):** **híbrido** — el **dispositivo** ancla el tenant con su `customToken` y el **operador** inicia sesión encima con Google/correo. Da binding fuerte de tenant + auditoría humana (`vendedorUid`), y es lo más resistente a manipular `localStorage`. *(Alternativa descartada: reemplazar el customToken por solo login humano — pierde el anclaje verificable del dispositivo al tenant.)*

### 6.3 Roles (claim `role`)
| Rol | Quién | Dónde | Alcance |
|---|---|---|---|
| `superadmin` | Proveedor (jesús) | `superadmin-web` | Plataforma: provisioning, billing, cambiar estado de cualquier tenant. Global (sin `negocioId` o `'*'`). **Único** (bootstrap manual server‑side; sin multi‑superadmin). |
| `admin` | Dueño del negocio | `admin-web` | Su tenant: sucursales, nodos, equipo, catálogo. **No** toca otros negocios ni el estado de suscripción. |
| `vendedor` | Cajero | `nodo-web` | Su sucursal: ventas, cortes, apartados. |
| `nodo` | El dispositivo | `nodo-web` | Identidad de máquina (customToken). |

### 6.4 Binding usuario→tenant
- **Provisioning** (CF, server‑side): `setCustomUserClaims(uid, {role, negocioId, sucursalId?})`. Tras setear, el cliente hace `getIdToken(true)` (patrón **ya usado** tras `verificarAdminWhitelist`).
- `useNegocio` **ya prioriza** `claims.negocioId` sobre el fallback → un tenant nuevo opera **sin tocar `admin-web`**, en cuanto su admin tenga el claim correcto.

---

## 7. Enforcement de la suscripción (defensa en 3 capas)

### 7.1 Estados efectivos (derivados de `estado` + `fechaVencimiento` + `graciaHasta`)
| Estado efectivo | Condición | Comportamiento |
|---|---|---|
| **POR VENCER** | `now ≥ fechaVencimiento − Npre` (p.ej. 7 / 3 / 1 días antes) | **Persuasión**: banner con cuenta regresiva "tu plan vence en N días". Operación normal. |
| **ACTIVO** | `estado=='activo' && now < fechaVencimiento` | Operación normal. |
| **EN GRACIA** | `now ≥ fechaVencimiento && now < graciaHasta` (**7 días**) | **Persuasión escalada**: aviso persistente "venció — te quedan N días". **Uso completo del POS** durante la semana ("se deja notificado y se puede usar 1 semana más"). |
| **VENCIDO / SUSPENDIDO** | `estado=='suspendido' || now ≥ graciaHasta` | **Bloqueo total**: pantalla bloqueante con CTA de contacto/pago; no se opera nada. |
| **CANCELADO** | `estado=='cancelado'` | **Bloqueo total** (solo pantalla de contacto). |

> **Persuasión antes del bloqueo (como lo pediste):** avisos crecientes **antes** de vencer (banners con cuenta regresiva), aviso persistente **durante** los 7 días de gracia con uso completo, y **solo al terminar la gracia → bloqueo total**. `cancelado` = bloqueo total. El **trial de 14 días** usa la misma maquinaria (al vencer el trial sin pago: persuasión → bloqueo).

### 7.2 Capa 1 — Gate de UI (UX, **no** es seguridad)
- `admin-web`: hook `useSuscripcion()` derivado del `onSnapshot` que **ya** hace `useNegocio()`; un `<SuscripcionGate>` en `AppShell` muestra **banner de persuasión** (por vencer / en gracia) y **bloqueo total** (tras la gracia / cancelado). Cambio de estado **en vivo, sin re‑login**.
- `nodo-web`: reusar el `onSnapshot` del doc negocio (`features/negocio/useNegocio.ts`); banner de cuenta regresiva en POR VENCER/GRACIA y **pantalla de bloqueo total** "Suscripción vencida — contacta a tu proveedor" tras la gracia (deshabilita todo el POS, sin borrar sesión/datos locales). **PWA/offline → fail‑safe cerrado**: cachear el último estado y **bloquear** si no se puede revalidar pasada la fecha.

### 7.3 Capa 2 — Firestore Security Rules (**seguridad real**)
Las Rules leen el doc del negocio con `get()` y bloquean escrituras si no está vigente. Impide saltarse el frontend manipulando localStorage o llamando a Firestore directo.
```js
function claims()   { return request.auth.token; }
function mismoTenant(nid) { return request.auth != null && claims().negocioId == nid; }
function esSuper()  { return request.auth != null && claims().role == 'superadmin'; }
function neg(nid)   { return get(/databases/$(database)/documents/negocios_web_new_version/$(nid)).data; }

function suscripcionVigente(nid) {
  let n = neg(nid);
  return n.estado == 'activo'
      && ( n.fechaVencimiento == null
           || request.time < timestamp.date( /* parse n.fechaVencimiento */ )
           || (n.graciaHasta != null && request.time < timestamp.date( /* n.graciaHasta */ )) );
}

match /negocios_web_new_version/{nid} {
  allow read:  if mismoTenant(nid) || esSuper();   // el tenant debe poder leer su estado aun suspendido
  allow write: if esSuper();                        // cambiar estado/vigencia: SOLO superadmin (vía CF)

  // Escrituras transaccionales del POS → bloqueadas cuando no está vigente (la UI muestra bloqueo total)
  match /sucursales_data_web_new_version/{sid}/{document=**} {
    allow read:  if mismoTenant(nid);
    allow write: if mismoTenant(nid)
                 && claims().role in ['admin','vendedor','nodo']
                 && suscripcionVigente(nid);
  }
  match /articulos_n_web_new_version/{doc=**} {
    allow read:  if mismoTenant(nid);
    allow write: if mismoTenant(nid) && claims().role == 'admin' && suscripcionVigente(nid);
  }
}
```
> Notas: (a) `get()` cuesta **1 lectura por escritura** — aceptable y es el único modo de revocación **casi‑instantánea** sin esperar el refresh de ~1 h de los claims. (b) **Cerrar al mismo tiempo el aislamiento de tenant**: hoy las Rules no comparan `claims().negocioId == nid` en todo el árbol — si no se hace, hay fuga cross‑tenant. (c) Las queries `collectionGroup('items')` (ventas) y cortes **barren todos los negocios** filtrando solo por `where negocioId` en cliente → blindar que solo `superadmin` haga vistas cross‑tenant; ventas/cortes viejos **sin `negocioId` embebido** no se aíslan.

### 7.4 Capa 3 — Cloud Functions + cron
- `cambiarEstadoNegocio` (solo superadmin) → escribe `estado/fechaVencimiento/graciaHasta`. Como vive en Firestore, surte efecto **inmediato** en Rules y en los `onSnapshot` **sin** refrescar tokens.
- CF de provisioning (`crearSucursal`, `registrarNodo`, `createUser`) deben validar `suscripcionVigente` **y** los límites del plano **antes** de escribir.
- **`barrerSuscripcionesVencidas`** (Cloud Scheduler diario): pasa a `en_gracia`/`suspendido` los negocios cuya `fechaVencimiento`/`graciaHasta` ya pasó (usa **server time**). **Sin este cron, la vigencia es decorativa** y los estados nunca transicionan por fecha.

---

## 8. La consola del Super Admin (`superadmin-web`)

**Dónde vive: app nueva `superadmin-web` (4º hosting target), NO una sección de `admin-web`.** Por qué:
1. `admin-web/App.tsx` deja entrar a `superadmin` **y** `admin` al mismo árbol → un admin‑delegado **no debe** ver MRR/otros tenants/cobros, y no debe descargarse el bundle de billing.
2. `admin-web` es single‑tenant de raíz (`useNegocio` resuelve **un** `negocioId`); la consola necesita **iterar entre N negocios** → rompería la invariante "un `admin-web` = un negocio".
3. El deploy **ya** es multi‑target en el mismo proyecto → añadir `superadmin → amise-superadmin` es el patrón establecido (clonar `admin-web`: mismo `firebaseConfig`, `@shared`, shadcn/Tailwind, helper `callable<I,O>`). **No** requiere proyecto Firebase nuevo.
4. Gate trivial: copiar `useAuth.ts` y admitir **solo** `role === 'superadmin'`. Login: clonar `Login.tsx` pero **solo Google**, sin paso de whitelist.

### 8.1 Pantallas
| Ruta | Contenido |
|---|---|
| `/tenants` | Tabla de **todos** los negocios (vía CF `listarNegocios`, **no** `onSnapshot` directo a la raíz). Columnas: nombre, plan, estado, vencimiento (badge "vence en N días"/"vencido"), #sucursales, #nodos, MRR. Filtros: estado, "por vencer (≤7 d)", plan. + tarjetas de indicadores (MRR, activos, suspendidos, por vencer, vencidos). |
| `/tenants/nuevo` | Alta: nombre del negocio, email+nombre del admin inicial, plan, arranca en **prueba** (trial). → CF `provisionarTenant`. |
| `/tenants/:negocioId` | Detalle: cambiar plan; **registrar pago manual (2 subsecciones)**; **personalización $999 (activar/desactivar módulos)**; suspender/reactivar/cancelar; **historial de pagos**. |
| `/planes` | CRUD de los 3 planes (precios + límites). |

### 8.2 Flujo de provisioning (`provisionarTenant`, transaccional)
1. Validar caller: `role === 'superadmin'` (si no → `permission-denied`).
2. Generar `negocioId` (slug del nombre + sufijo aleatorio, **unicidad garantizada server‑side**) y crear `negocios_web_new_version/{negocioId}` con `nombre, plan, estado='activo', fechaCreacion, limiteSucursales/limiteDispositivos (del plan)`, y subdoc `datos_web_new_version/suscripcion` `{ estado:'prueba', fechaInicio, fechaVencimiento = hoy + trialDias, limitesEfectivos }`.
3. Crear usuario admin Auth (reusa la lógica de `createUser` existente): password temporal o invite link.
4. `setCustomUserClaims(adminUid, {role:'admin', negocioId})`. → ese admin, al entrar a `admin-web`, **no** cae al fallback `'amise'` sino a SU negocio (cero cambios en `admin-web`).
5. Sembrar datos mínimos: `datos_web_new_version/{equipoDeTrabajo, pinVentas, switches}`. **La primera sucursal NO se siembra aquí**: la crea el nodo en su first‑run (`registrarNodo` ya soporta `nuevaSucursal` inline) o el admin desde `/sucursales`.
6. Asiento opcional de "alta/prueba" en `pagos` (monto 0).
7. Devolver `{ negocioId, adminUid, inviteLink|tempPassword }`.

> **Idempotencia/compensación**: si falla `setCustomUserClaims` tras crear doc+user, hacer rollback (borrar doc y user) o reintento seguro — para no dejar tenants huérfanos.

---

## 9. Cloud Functions necesarias (resumen)

> ⚠️ `functions/` está **fuera** de `nodo-web`/`admin-web`, pero es **imprescindible**: hoy **no existe ninguna** CF de billing/provisioning de planes. Toda mutación SaaS pasa por CFs que validan `role === 'superadmin'` server‑side.

| Función | Tipo | Rol | Propósito |
|---|---|---|---|
| `provisionarTenant` | callable | superadmin | Alta de cliente (negocio + admin + suscripción en prueba). |
| `listarNegocios` | callable | superadmin | Lista para la consola (la raíz `negocios` **no** se abre a clientes). |
| `registrarPagoManual` | callable | superadmin | Las 2 subsecciones; calcula vigencia y asienta pago. |
| `cambiarPlanTenant` | callable | superadmin | Cambia plan + `limitesEfectivos`. |
| `suspenderTenant` / `reactivarTenant` / `cancelarTenant` | callable | superadmin | Cambian `estado`. |
| `cambiarEstadoNegocio` | callable | superadmin | Genérica de estado/vigencia. |
| CRUD `planes` | callable | superadmin | Mantener los 3 planes. |
| `crearCheckoutSession` / `crearPortalSession` | callable | admin/superadmin | Stripe self‑service. |
| `stripeWebhook` | **HTTP** | — (firma) | Renovaciones/fallos/cancelaciones de Stripe. |
| `barrerSuscripcionesVencidas` | **scheduled** | — | Cron diario: transiciona estados por fecha. |
| `setClaimsUsuario` | callable | superadmin/admin | `setCustomUserClaims` al provisionar usuarios. |

Las CFs existentes a **endurecer**: `crearSucursal`, `registrarNodo`, `rebindNodo`, `createUser` → validar suscripción vigente + límites del plan, y **validar server‑side que el caller pertenece a ese `negocioId`** (hoy el `negocioId` viaja como parámetro de confianza del cliente).

---

## 10. Cambios concretos por app

> Scope estricto de esta guía: `nodo-web` y `admin-web`. Se listan también `shared/`, `functions/` e `infra` porque son **dependencias load‑bearing** (están fuera de las dos carpetas).

### `shared/` (contrato compartido)
- `schema.ts`: añadir `Plan`, `Suscripcion`, `Pago` (y opcional `TenantIndex`, `Proveedor`). Extender `Negocio` con `fechaVencimiento`, `graciaHasta`; documentar que `estado/plan/limite*` dejan de ser fantasma.
- `collections.ts`: cablear `COL_PLANES='planes'` (ya declarada). Añadir `COL_PAGOS='pagos_web_new_version'`, `DOC_SUSCRIPCION='suscripcion'`, y builders `paths.plan(planId)`, `paths.suscripcion(nid)`, `paths.pagosCol(nid)`, `paths.pago(nid, pagoId)`.

### `admin-web`
- `hooks/useSuscripcion.ts` (**nuevo**): deriva `{vigente, estadoEfectivo, diasRestantes}` del `onSnapshot` que ya hace `useNegocio()`.
- **Gate de features/límites por plan**: inhabilitar `features/articulos/ImageUpload.tsx` (foto de artículo) cuando `incluyeImagenes===false` (Básico); bloquear alta de admins/delegados (`createUser`, whitelist) al superar `limiteAdmins`, y de sucursales (`crearSucursal`) al superar `limiteSucursales`. *(La IA quitar fondo / `lib/quitarFondo.ts` **no** se gatea por plan.)*
- `components/AppShell.tsx`: montar `<SuscripcionGate>` (banner en gracia / solo‑lectura / bloqueo).
- `features/sucursales/sucursalService.ts`, `routes/nodos/NodosPage.tsx`: deshabilitar escrituras cuando no está vigente (defensa de UI; la real está en Rules/CF).
- `firebase/callables.ts`: wrappers `fnCrearCheckoutSession`, `fnCrearPortalSession`, `fnRegistrarPagoManual` (si el pago manual se hace desde aquí en MVP).
- `hooks/useNegocio.ts`: *(fase posterior)* eliminar/sustituir el fallback `'amise'` por selector. **Sin cambios obligatorios** para que un tenant nuevo opere (ya prioriza el claim).
- `routes/Login.tsx`: dejar de fijar `verificarAdminWhitelist` contra `NEGOCIO_DEFAULT='amise'`; resolver el tenant del email server‑side.

### `nodo-web`
- `features/billing/useSuscripcionNodo.ts` (**nuevo**) + gate en `App.tsx` / `Ventas.tsx` / `CarritoPanel.tsx`: pantalla "Suscripción vencida" y bloquear COBRAR sin borrar sesión/datos locales. Fail‑safe cerrado offline.
- `features/auth/LoginOperador.tsx` (**nuevo**) + `firebase/auth.ts`: añadir login humano (Google + correo/contraseña). Hoy `auth.ts` solo tiene `signInWithCustomToken`.
- `hooks/useNodoSession.ts`: namespacear la clave localStorage por negocio (`nodo_session__{negocioId}`) en vez de la fija `'amise_nodo_session'`. *(Migrar la clave en el arranque para no obligar a re‑vincular los nodos existentes.)*
- `config.ts`: *(Fase 6)* eliminar el fallback literal `'amise'`; el `negocioId` se deriva en **runtime desde el código de invitación** del first‑run (un solo bundle). Sin negocio resuelto = sin app (fallar fuerte, no caer a un default).

### `superadmin-web` (**app nueva**)
- Clonar estructura de `admin-web`: `package.json` (`deploy = firebase deploy --only hosting:superadmin`), `vite.config.ts` (aliases `@`, `@shared`), Tailwind/PostCSS/tsconfig, `index.html`, `src/main.tsx`.
- `firebase/config.ts` (copia idéntica), `hooks/useAuth.ts` (copia), `App.tsx` (guard `role==='superadmin'`), `routes/Login.tsx` (solo Google).
- `firebase/callables.ts`: wrappers de las CFs del proveedor.
- `routes/tenants/{TenantsListPage, TenantNuevoPage, TenantDetailPage}.tsx`, `routes/planes/PlanesPage.tsx`.

### `infra`
- `firestore.rules`: helpers `claims/mismoTenant/esSuper/neg/suscripcionVigente`; condicionar `write` transaccional a vigencia; cerrar el aislamiento `negocioId == nid`; `suscripcion`/`pagos`/`planes` solo lectura del tenant y escritura vía CF; `pagos` inmutable.
- `firestore.indexes.json`: índices en `tenants_index` (`estado + fechaVencimiento`) y `pagos` (`fechaPago`).
- `firebase.json` + `.firebaserc`: 4º hosting target `superadmin → amise-superadmin`. Exponer `stripeWebhook` como endpoint HTTP y registrar la URL en Stripe. Programar el cron `barrerSuscripcionesVencidas`.

---

## 11. Plan de implementación por fases

> Cada fase es desplegable y no rompe producción. El negocio actual `amise` sigue operando todo el tiempo.

**Fase 0 — Cimientos de datos (sin efecto visible)**
- `shared/`: tipos `Plan/Suscripcion/Pago` + `collections.ts` (cablear `COL_PLANES`, añadir `COL_PAGOS`, builders).
- Backfill: crear `planes/{basico,pro,avanzado}` y, para `amise`, el subdoc `suscripcion` `{estado:'activo', fechaVencimiento: lejano}` + espejo en el doc Negocio. **Sin esto, desplegar el gating auto‑bloquea producción.**

**Fase 1 — Consola del proveedor (read‑only primero)**
- `superadmin-web` con login Google + `/tenants` (vía `listarNegocios`) + `/planes`. Solo lectura/CRUD de planes. Aún sin tocar el comportamiento de `nodo-web`/`admin-web`.

**Fase 2 — Provisioning + pago manual**
- CFs `provisionarTenant`, `registrarPagoManual` (las 2 subsecciones), `cambiarPlanTenant`, `suspender/reactivar`. `/tenants/nuevo` y `/tenants/:id`. Ya puedes dar de alta clientes y registrar pagos.

**Fase 3 — Enforcement**
- `firestore.rules` con `suscripcionVigente` + cierre de aislamiento de tenant. Gates de UI en `admin-web` y `nodo-web`. Cron `barrerSuscripcionesVencidas`. **Ahora "suspender" tiene efecto real.**

**Fase 4 — Auth humano en `nodo-web`**
- Login del operador (Google + correo/contraseña) encima del customToken del dispositivo. `vendedorUid` en ventas.

**Fase 5 — Stripe**
- `crearCheckoutSession`/`crearPortalSession`/`stripeWebhook` + idempotencia. Conectar los `priceId` en `planes`.

**Fase 6 — `nodo-web` multi‑tenant real (un solo bundle)**
- **Decisión (más robusto y escalable):** eliminar el hardcode `'amise'` y derivar `negocioId` en **runtime mediante un código de invitación** que el dispositivo captura en el first‑run (una CF lo resuelve a `negocioId` y emite el `customToken`). **Un solo bundle para todos los tenants** (no deploy‑por‑negocio, que no escala: exigiría un site de Hosting y un build por cliente). El first‑run gana un paso "identifica tu negocio" antes de elegir sucursal.

---

## 12. Decisiones — resueltas y pendientes

**✅ Resueltas:**
- **Planes/precios y límites**: Básico $99 (1 sucursal / 1 nodo / 1 admin, sin imágenes) · Pro $199 (3 / 3 / 3, con imágenes) · Avanzado $259 (10 sucursales / 10 nodos / 5 admin, con imágenes).
- **Periodos**: anual = 10 cobrados / 12 de vigencia. **Pago único 3 años** (solo Pro) = 30 cobrados / 36 de vigencia + asistencia personal. **Add‑on personalización $999** one‑time, cualquier plan (no extiende vigencia).
- **Imágenes** = **solo foto del artículo** (la IA quitar fondo va aparte, no por plan).
- **Billing v1 = solo manual**; Stripe **pendiente** (Fase 5).
- **Vencimiento**: **trial 14 días** → al vencer, **persuasión** (avisos antes de vencer + 7 días de gracia con uso completo) → **bloqueo total**. `cancelado` = bloqueo total.
- **`nodo-web` login**: **híbrido** (dispositivo con customToken + operador con Google/correo).
- **`nodo-web` multi‑tenant**: **un solo bundle**, `negocioId` por **código de invitación** en el first‑run.
- **Super Admin** = **app separada** (`superadmin-web`), **uno solo** (bootstrap manual server‑side; sin multi‑superadmin).
- **Add‑on $999** = **personalización funcional por tenant**: activar/quitar **módulos específicos** (ej. habilitar apartados o resurtidos) vía `negocio.personalizaciones.funciones`, sin cambiar de plan.

**❓ Pendientes:**
1. **Facturación fiscal (CFDI/SAT)**: ¿factura por pago, o `pagos` es solo control interno? *(en pausa)*

---

## 13. Riesgos clave (no olvidar)

- **Campos fantasma**: hasta que se cablee el enforcement (Fase 3), marcar un negocio "suspendido" **no hace nada**. Suspender sin gate = decorativo.
- **`nodo-web` confía el tenant a `localStorage`** (manipulable): el bloqueo real debe estar en **Rules + CF**, no solo en UI. Mover el binding fuerte a los claims del customToken del dispositivo.
- **Fallback `'amise'`** en `admin-web` (`useNegocio`/`Login`) y `nodo-web` (`config.ts`): rompe el multi‑tenant. En SaaS debe **fallar fuerte** (sin tenant = sin app), no caer a un negocio default.
- **PWA/offline**: un POS offline tras el vencimiento podría seguir vendiendo → **fail‑safe cerrado** (solo‑lectura si no se puede revalidar).
- **Webhook de Stripe**: usar `req.rawBody` para la firma; **todo el asiento en una transacción**; idempotencia por `eventId`.
- **`collectionGroup('items')`** (ventas) y cortes barren **todos** los negocios; el aislamiento depende del `where negocioId` + Rules. Ventas/cortes viejos sin `negocioId` embebido **no se aíslan**.
- **Snapshot de límites** en `suscripcion.limitesEfectivos`: si el enforcement leyera el catálogo `planes` en vivo, editar un plan alteraría retroactivamente a todos sus tenants.
- **Reloj del cliente** no es confiable: las transiciones por fecha las hace el **cron** (server time).
- **Confusión de roles**: hoy `superadmin` = dueño de un negocio (jesús). Al volverlo "operador de plataforma", revisar el bloque de `Login.tsx` que salta la whitelist y el fallback de `useNegocio`.

---

*Guía generada a partir del mapeo del código real de `nodo-web` y `admin-web`. Las rutas, claims, callables y comportamientos descritos en §1 son verificados contra el repositorio; las secciones §2–§13 son el diseño propuesto.*
