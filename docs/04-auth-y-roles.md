# Autenticación y Roles

> **Cuándo usar este doc**: al trabajar con registro de usuarios/tablets,
> entender cómo se autorizan writes en Firestore, o diagnosticar problemas
> de permisos.

## Índice

1. [Modelo de roles](#modelo-de-roles)
2. [Custom claims](#custom-claims)
3. [Flujos de registro](#flujos-de-registro)
4. [Rebind (tras pérdida de caché)](#rebind)
5. [Revocación](#revocación)
6. [Cómo las rules usan los claims](#cómo-las-rules-usan-los-claims)
7. [Riesgos conocidos](#riesgos-conocidos)

---

## Modelo de roles

4 roles efectivos:

| Role | Quién | Cómo se crea | Auth method |
|---|---|---|---|
| `superadmin` | Propietario del negocio (humano) | Manualmente en Firebase Auth Console + `setup-initial.js` | Email/password o Google |
| `admin` | Empleado con permisos admin (humano) | CF `createUser` desde panel super-admin | Email/password |
| `vendedor` | Empleado vendedor (humano) | CF `createUser` (poco usado — hoy los vendedores son ítems de `equipoDeTrabajo`, no users Firebase) | Email/password |
| `nodo` | Tablet (no humano) | CF `registrarNodo` (first-run) | Anonymous + custom token |

**Nota sobre "vendedor" vs `equipoDeTrabajo`**: el "vendedor" que aparece en
`enTurno` de cada venta NO es necesariamente un user Firebase. Es un
entry del map `datos_web_new_version/equipoDeTrabajo` gestionado desde la UI
`/equipo` del admin. El tablet se loguea UNA vez como `nodo` y cada venta
pide/selecciona al vendedor del equipo para el campo `enTurno`.

---

## Custom claims

Los claims se inyectan en el ID token de Firebase Auth y se leen en
Firestore rules como `request.auth.token.*`.

### Shape por rol

```ts
// superadmin
{ role: "superadmin" }

// admin
{ role: "admin", negocioId: "amise" }

// vendedor (poco usado)
{ role: "vendedor", negocioId: "amise" }

// nodo
{ role: "nodo", negocioId: "amise", sucursalId: "suc_xxx", nodoId: "nid_xxx" }
```

### Cómo se asignan

- **superadmin**: script `setup-initial.js` usa Identity Toolkit REST API con
  OAuth token del `firebase-tools` config. Asigna una sola vez.
- **admin/vendedor**: CF `createUser` hace
  `admin.auth().setCustomUserClaims()`.
- **nodo**: CF `registrarNodo` crea el anonymous user Y setea los claims Y
  genera un custom token con los claims embebidos.

### Propagación de claims nuevos

Cuando cambian los claims de un user existente (ej. revocar nodo →
`role: "revocado"`), el cambio **no es inmediato** para el usuario ya
loggeado. El ID token tiene TTL de 1 hora — hasta que expire, los claims
"viejos" siguen activos.

Fuerza refresh desde el cliente:

```ts
await auth.currentUser?.getIdToken(true);
```

Pero si la tablet está revocada, el servidor ya no devuelve un refresh
válido tras 1h. Mientras tanto, puede seguir haciendo writes durante esa
ventana. Ver [Riesgo F5](#riesgos-conocidos).

---

## Flujos de registro

### Admin / superadmin

```
Firebase Auth Console (manual)
  ↓ crea user con email jesuscentenoramirez@gmail.com + password temporal
setup-initial.js (una sola vez)
  ↓ lookup user por email
  ↓ setCustomClaims({role: "superadmin"})
  ↓ crea usuarios/{uid} doc
  ↓ crea planes/basico
  ↓ crea negocios_web_new_version/amise
  ↓ crea datos_web_new_version/_init (placeholder)

Admin-web login:
  signInWithEmailAndPassword(email, password)
  → useAuth hook lee tokenResult.claims
  → role="superadmin" → pasa guard → entra a Dashboard

Admin subsecuente (opcional):
  Admin super → CF createUser({email, password, nombre, role:"admin", negocioId:"amise"})
  → CF crea user + claims + usuarios/{uid}
```

### Nodo — primera vez

```
1. User abre nodo-web en tablet limpia
   localStorage.amise_nodo_session no existe
   → useNodoSession.loading termina con nodoId=null
   → Route guard redirige a /first-run

2. FirstRun.tsx:
   llama listarSucursales({negocioId: "amise"}) [público]
   ↓
   a) Hay sucursales → UI muestra selector + "Nueva sucursal"
   b) No hay → directo a form de nueva sucursal

3. User rellena:
   - sucursalId (existente) o nuevaSucursal (nombre+dirección+tel)
   - nombreNodo ("Caja 1")
   - registradoPor ("Carlos")

4. useRegistroNodo.registrar(...) llama:
   fnRegistrarNodo({negocioId, sucursalId|nuevaSucursal, nombreNodo, registradoPor, userAgent})

5. CF registrarNodo:
   - Valida negocio existe
   - Si nuevaSucursal: crea sucursales_w/{sid}
   - admin.auth().createUser({}) → authUid nuevo (anonymous user)
   - setCustomUserClaims(authUid, {role:"nodo", negocioId, sucursalId, nodoId=authUid})
   - Crea nodos_w/{nodoId} con historial[{tipo:"registro"}]
   - createCustomToken(authUid, {role:"nodo", negocioId, sucursalId, nodoId})
   - return {nodoId, sucursalId, negocioId, customToken}

6. Cliente:
   loginConCustomToken(customToken)
   → signInWithCustomToken → user auth con claims aplicados
   requestPersistentStorage() [permanent IndexedDB]
   saveSession({nodoId, sucursalId, negocioId, nombreNodo}) en localStorage
   navigate("/") → pantalla de ventas

Estado post first-run:
   localStorage: amise_nodo_session = {...}
   Firebase Auth: anonymous user con claims persistente
   Firestore: usuarios/ (no) + nodos_w/{nodoId} (sí)
```

### Nodo — arranque subsecuente

```
Tablet ya registrada y con caché:
   localStorage.amise_nodo_session = {...nodoId, sucursalId, negocioId, nombreNodo}
   Firebase Auth: anonymous user session restored desde IndexedDB

   useNodoSession:
     loadSession() → nodoId presente
     onAuthStateChanged dispara con user actual
     loading=false, nodoId presente

   Route guard: nodoId !== null → / (Ventas)

No hay re-login. El user abre la tablet y directo a vender.
```

---

## Rebind

Escenario: caché perdido (user limpió datos del navegador, cambió
navegador, etc.) pero el nodo sigue activo en Firestore.

```
1. Tablet arranca sin localStorage ni auth.
   Redirige a /first-run.

2. FirstRun.tsx:
   User pulsa "Tablet recuperada — vincular a nodo existente".
   (toggle modoRebind=true)

3. Selector de sucursal (al elegir):
   listarNodos({negocioId, sucursalId}) [público, filter estado==activo]
   ↓
   UI muestra lista de nodos por nombre + registrado por + fecha.
   User elige uno.

4. useRegistroNodo.rebind({nodoId, registradoPor, nombreNodo}):
   fnRebindNodo({negocioId, nodoId, userAgent, registradoPor})

5. CF rebindNodo:
   - Valida nodo existe y estado !== "revocado"
   - admin.auth().createUser({}) → authUid NUEVO
   - setCustomUserClaims(authUid_nuevo, {role:"nodo", mismos claims})
   - FIX A4: revokeRefreshTokens(authUid_viejo) + deleteUser(authUid_viejo)
   - Append historial[{tipo:"rebind", fecha, userAgent, detalle: registradoPor}]
   - Update nodo: authUid = authUid_nuevo
   - createCustomToken(authUid_nuevo, {claims})

6. Cliente: signInWithCustomToken → redirige a /

Resultado:
   - El nodo sigue siendo el MISMO (nodoId no cambia).
   - authUid cambia (anterior deletado).
   - Nuevo token para la tablet actual.
   - historial preserva la trazabilidad.
```

⚠️ **Riesgo aceptado**: cualquier persona con acceso al tablet puede elegir
cualquier nodo activo de cualquier sucursal del negocio durante rebind. Es
un diseño intencional (simplicidad operacional) con mitigación via log
`historial`. Admin puede revisar re-binds sospechosos en `/nodos`.

---

## Revocación

Desde `/nodos` el admin marca un nodo como `revocado`:

```
1. Admin click "Revocar" en tabla de nodos.
2. fnRevocarNodo({negocioId, nodoId}).
3. CF revocarNodo (requireAdminOrSuper):
   - Append historial[{tipo:"revocado", detalle: by ${uid}}]
   - Update nodo: estado = "revocado"
   - revokeRefreshTokens(nodo.authUid)
   - setCustomUserClaims(nodo.authUid, {role: "revocado"})

4. Estado subsiguiente:
   - refresh tokens → invalid → no new ID tokens.
   - ID token vigente sigue válido 1 hora → role "nodo" vs "revocado"
     depende del cache del token.
   - Post-1h: el tablet no puede auth → queda offline.
   - User puede hacer rebind solo a nodos activos (no a este).
```

Para re-activar un nodo revocado: NO hay UI hoy. Se puede hacer manual en
Firestore Console: setear `estado: "activo"`. El authUid sigue borrado;
el rebind flow creará uno nuevo.

---

## Cómo las rules usan los claims

Ejemplo: venta escrita por el nodo `abc123` en sucursal `suc_xxx` del
negocio `amise`.

Path: `/negocios_web_new_version/amise/sucursales_data_web_new_version/suc_xxx/ventas_n_web_new_version/2026/4/24/items/huella_123`

Rule que aplica:

```
match /sucursales_data_web_new_version/{sucursalId}/{subcol=**} {
  allow write: if isSuperAdmin()
               || isBusinessAdmin(negocioId)
               || isNodo(negocioId, sucursalId);
}
```

Evaluación:

```
isSuperAdmin() = request.auth.token.role == 'superadmin'           → false
isBusinessAdmin("amise") = role in [admin, superadmin] AND ...     → false
isNodo("amise", "suc_xxx") =
  auth != null
  AND role == "nodo"              ← ✓
  AND token.negocioId == "amise"  ← ✓
  AND token.sucursalId == "suc_xxx" ← ✓                            → true

→ allow write: true
```

Si el mismo nodo intenta escribir a la sucursal `suc_otra`:

```
isNodo("amise", "suc_otra") = ... AND token.sucursalId == "suc_otra" → false
→ permission denied
```

---

## Riesgos conocidos

### F5 — Token TTL 1h post-revocación

**Descrito**: tras `revokeRefreshTokens`, los **ID tokens vigentes** siguen
siendo válidos hasta que expiren (máximo 1 hora).

**Impacto**: un nodo revocado puede seguir escribiendo ventas durante ~1
hora. La venta se guarda con el mismo `nodoId` por lo que es trazable.

**Mitigación actual**: ninguna en runtime. Documentado.

**Mitigación futura**: las rules podrían validar `estado == "activo"` del
doc del nodo en cada write, pero eso requiere un `get()` por write que es
caro. Alternativa: el cliente escucha su propio doc y bloquea writes si
`estado == "revocado"`. Pendiente.

### Shared UID entre devices

**Descrito**: si un mismo nodo hace rebind varias veces, los auth users
anteriores se borran. Si por alguna razón dos instancias del mismo
`nodoId` están activas (browser + tablet), ambas comparten el mismo
authUid actual. No hay garantía de unicidad de sesión.

**Impacto**: bajo — el tablet es un único device físico; el sceanario de
"dos clientes del mismo nodo" es raro.

**Mitigación**: aceptable.

### Claims stale durante flip de rol

**Descrito**: si el admin cambia el rol de un user (ej. admin → vendedor),
el usuario actualmente loggeado sigue con el rol viejo hasta refresh del
ID token (automático cada ~1h, o forzable con `getIdToken(true)`).

**Impacto**: ventana de 1h de permisos obsoletos.

**Mitigación**: en el admin-web podríamos llamar `getIdToken(true)` al
detectar cambio en el doc `usuarios/{uid}`. Pendiente.
