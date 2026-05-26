# Chat — Plan de implementación y notas de ejecución

> **Para qué sirve este doc**: registro vivo del trabajo de chat. Audita
> la recomendación de orden, lista las fases con check-marks, y guarda
> notas que cierre cada fase. Si retomas el trabajo en otra sesión,
> empieza por leer este MD para no perder contexto.
>
> **Spec de negocio**: `14-chat-arquitectura.md` (no duplicar aquí; este MD
> sólo trata la ejecución).

## Estado

- [x] Fase 0 — Decisiones cerradas (ver 14-chat-arquitectura.md)
- [x] Fase A — Tipos en `shared/src/schema.ts` y paths en `shared/src/collections.ts`
- [x] Fase B — Cloud Functions (deployed)
- [x] Fase C — Wrappers callables en admin-web
- [x] Fase D — Cliente admin-web (gestión de delegados/colaboradores)
- [x] Fase D-deploy — admin-web desplegado, validado por usuario
- [x] Fase E — Cliente nodo-web (chat de grupo del nodo) deployed
- [x] Fase E-rev — Rediseño visual a modal centrado + compresión 700 KB + back-handler interno (2026-05-11)
- [x] Fase F — Cliente admin-web (UI de chats: grupos + directos) — deployed 2026-05-11
- [ ] Fase G — Migración del cliente Electron `gomu-chat`
- [ ] Fase H — Cierre de Firestore rules

---

## Auditoría de la recomendación "empezar por Cloud Functions"

### Lo que valida la recomendación

1. **No hay ruta de auth para colaboradores sin CF**: el username+password
   exige hash + emisión de Custom Token, ambos sólo posibles desde CF
   (Admin SDK).
2. **Los claims dictan las rules**: si después diseñamos rules con un
   `role: "colaborador"` que aún no se emite, las rules quedan inválidas
   en cuanto las activemos. Mejor sellar primero la forma del claim.
3. **Las CFs no rompen producción**: agregar `onCall` nuevos no afecta
   los existentes. Las rules siguen abiertas en dev así que aunque la CF
   tenga bugs, el cliente puede operar sin trabarse.
4. **Patrón establecido**: `functions/index.js` ya usa
   `firebase-functions/v2`, helpers `requireAuth/requireSuperAdmin/requireAdminOrSuper`
   y mantiene un solo archivo. Encajamos sin reformatear.

### Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Hash incompatible CF↔cliente | Función única en `shared/src/passwordHash.ts`, importada por ambos lados. Mismo patrón que `pinHash.ts` ya existente. |
| `verificarAdminWhitelist` corre con un user sin claims (Google sign-in fresco) → la CF se llama pero el `requireAdmin` no aplica | La CF acepta un user autenticado SIN role; sólo valida que el email de `request.auth.token.email` esté en la whitelist. **No** elevamos basados en input del cliente — sólo basados en lookup Firestore. |
| Whitelist add/remove necesita admin existente, pero no hay admin si nadie pasó por whitelist | El `superadmin` actual (jesús) no se toca: él añade el primer delegado vía CF. La CF acepta `superadmin` o `admin` por consistencia con el patrón existente. |
| `inicializarChatGrupoNodo` debe correr al registrar un nodo, pero el `registrarNodo` ya existe y es tolerante a fallos | Dos opciones: (a) extender `registrarNodo` para crear el meta dentro del rollback existente, (b) `onDocumentCreated` trigger sobre `nodos_w/{nodoId}`. Voy con **(a)** — simplifica el orden de operaciones y mantiene la atomicidad del rollback. |
| Colaborador hash débil (SHA-256 + salt global) | Aceptamos el modelo dev igual que `pinHash`. Documentamos la deuda en este MD para hardening pre-producción (bcrypt server-side + per-user salt). |
| Triggers de notif (FCM) tienen costo | Diferimos las notifs a una fase posterior. Por ahora las notificaciones se disparan cliente-side detectando snapshot changes. |
| El cliente Electron `gomu-chat` sigue escribiendo al schema viejo durante la transición | Sin migración (Q5 cerrado: arrancar limpio). Mientras Electron no se actualice, sus mensajes legacy permanecen aislados — no contaminan el nuevo schema. |

### Decisiones del audit

- **Empezamos por CF, sí**, pero con el orden corregido:
  0. `shared/src/passwordHash.ts` — antes que cualquier CF use el hash.
  1. Whitelist CRUD (admin-real puede agregar el primer delegado).
  2. `verificarAdminWhitelist` — habilita Google sign-in para delegados.
  3. Colaborador CRUD + `loginColaborador`.
  4. Extender `registrarNodo` para crear `chat_grupos_w/{nodoId}/meta` en el mismo flow.
  5. `habilitarColaboradorEnGrupo` / `quitarColaboradorDeGrupo`.
- **NO** tocamos `firestore.rules` hasta después de wirear los clientes.
  Las rules se cierran en una sola pasada al final, junto con las
  pendientes documentadas en `13-rules-pendientes-produccion.md` si tiene
  sentido cerrar las dos cosas a la vez.
- **NO** modificamos la app Electron `gomu-chat` en esta fase. Su
  migración tiene su propia fase (G).

---

## Fase B — Cloud Functions (en curso)

Plan paso a paso. Cada item se marca `[x]` al cerrar y se anota cualquier
sorpresa al final.

### B0. `shared/src/passwordHash.ts` ✅

- [x] `hashPassword(password)` — SHA-256 + salt
  `"amise.colaborador.v1"`. Distinto del salt de `pinHash`.
- [x] `isValidPassword(password)` — al menos 8 chars.
- [x] Re-export desde `shared/src/index.ts`.

### B1. Whitelist de admin-delegados — CRUD ✅

- [x] `agregarAdminWhitelist({negocioId, email})`
- [x] `quitarAdminWhitelist({negocioId, email})` — soft-disable + revoca
  claims si el delegado tenía uid registrado.
- [x] `listarAdminWhitelist({negocioId})`

### B2. `verificarAdminWhitelist({negocioId})` ✅

- [x] Acepta user autenticado sin claims (Google fresh login).
- [x] Lookup por `emailKey(email)` con `habilitado: true`.
- [x] Persiste `uid` y `ultimoLogin` en el doc.
- [x] Eleva claims a `{role: "admin", negocioId}`.

### B3. Colaborador CRUD ✅

- [x] `crearColaborador` — valida unicidad de username (case-insensitive),
  crea auth user, setea claims, persiste con passwordHash. Rollback del
  auth user si la persistencia falla.
- [x] `actualizarColaborador` — soporta cambio de nombre, habilitado,
  password (re-hash + revokeRefreshTokens).
- [x] `eliminarColaborador` — soft-delete + revokeRefreshTokens + role
  "revocado" + cleanup en todos los grupos donde el colaborador estaba
  habilitado (query con `array-contains`).

### B4. `loginColaborador({negocioId, username, password})` ✅

- [x] Público (sin requireAuth).
- [x] Lookup por `username` lowercase. Verifica habilitado.
- [x] Verifica `passwordHash`. Re-aplica claims y emite custom token.
- [x] Update `ultimoLogin`.

### B5. Extender `registrarNodo` ✅

- [x] Helper interno `inicializarChatGrupoNodo(negocioId, nodoId)` crea
  el doc principal del grupo con `tipo:"grupo"`, miembros = whitelist de
  delegados con uid resuelto + nodoId, `colaboradoresHabilitados: []`,
  `estadoPorMiembro: {}`.
- [x] Llamado dentro de `registrarNodo` después del set del nodo.
  Fallar aquí no aborta el registro (best-effort) pero queda warning en
  logs.
- [x] Rollback agregado: al fallar el resto del flow, también borra el
  doc del chat.
- **Nota auditoría**: el `superadmin` (jesús) no está en la whitelist,
  así que NO se incluye en `miembros` al crear. Solución temporal:
  cuando jesús abra cualquier grupo desde admin-web, su cliente hace
  un auto-add a `miembros` con `arrayUnion`. Esa lógica se documenta en
  Fase F y no es bloqueante para B.

### B6. Habilitar/quitar colaborador en grupo ✅

- [x] `habilitarColaboradorEnGrupo` — verifica que el colaborador exista
  y esté habilitado; arrayUnion en `colaboradoresHabilitados` y
  `miembros`.
- [x] `quitarColaboradorDeGrupo` — arrayRemove en ambos campos.

### B7. Deploy ✅

- [x] `npm run deploy` ejecutado.
- [x] **Todas las CFs de chat se desplegaron exitosamente.**
- [x] `registrarNodo` actualizado en producción con la integración del
  chat.

**Nota deploy**: el deploy reportó errores de **Cloud Run CPU quota
exceeded** al intentar redeploy de CFs antiguas (`crearSucursal`,
`createUser`, `createBusiness`, `enviar`, `getUserProfile`, `listarNodos`,
`reconciliarVentasOffline`). Las CFs antiguas siguen corriendo en sus
revisiones previas — no afecta este trabajo. Para resolver la quota
hay que esperar (suele liberarse en horas) o pedir aumento. Documentado
para no repetir el deploy hasta entonces.

### Validación humo (pendiente — antes de Fase D/F)

- [ ] Smoke test desde admin-web: `fnAgregarAdminWhitelist` con un email
  de prueba → ver doc creado en Firestore.
- [ ] Smoke test: `fnVerificarAdminWhitelist` con un email NO en lista
  debe retornar `permission-denied`.
- [ ] Smoke test: `fnCrearColaborador` → doc en `colaboradores_w` con
  `passwordHash` correcto.
- [ ] Smoke test: `fnLoginColaborador` con credenciales válidas →
  `customToken` no vacío.

---

## Fase C — Wrappers en clientes ✅

- [x] `admin-web/src/firebase/callables.ts` — agregadas:
  `fnAgregarAdminWhitelist`, `fnQuitarAdminWhitelist`,
  `fnListarAdminWhitelist`, `fnVerificarAdminWhitelist`,
  `fnCrearColaborador`, `fnActualizarColaborador`,
  `fnEliminarColaborador`, `fnHabilitarColaboradorEnGrupo`,
  `fnQuitarColaboradorDeGrupo`.
- `nodo-web` no requiere wrappers nuevos en esta fase (los nodos no
  llaman estas CFs). Tendrá los suyos cuando entremos a Fase E para el
  chat propio del nodo.
- `fnLoginColaborador` se llamará desde el cliente colaborador (Electron
  o un futuro cliente web colaborador). No vive en admin-web.

---

## Fase D — Cliente admin-web — gestión de delegados/colaboradores ✅

- [x] `features/equipo-chat/useAdminWhitelist.ts` — hook con `onSnapshot`.
- [x] `features/equipo-chat/adminWhitelistService.ts` — wrappers
  `agregarAdminWhitelist`/`quitarAdminWhitelist` que invocan las CFs.
- [x] `features/equipo-chat/useColaboradores.ts` — hook con `onSnapshot`.
- [x] `features/equipo-chat/colaboradorService.ts` — `crearColaborador`,
  `actualizarColaborador`, `eliminarColaborador`, helper
  `generarPasswordAleatorio(len=12)` con alfabeto sin caracteres ambiguos.
- [x] `routes/equipo-chat/EquipoChatPage.tsx` — pantalla con tabs
  Delegados | Colaboradores.
- [x] `routes/equipo-chat/DelegadosTab.tsx` — agregar/deshabilitar/reactivar
  emails de la whitelist.
- [x] `routes/equipo-chat/ColaboradoresTab.tsx` — CRUD con modal.
  El modal de "nuevo" muestra credenciales finales en una pantalla
  copyable (con botón Copiar) **antes de cerrar** — el password sólo se
  ve esa vez, después no se recupera (sólo el hash queda).
- [x] Ruta `/equipo-chat` en `App.tsx`.
- [x] Item "Equipo chat" en `AppShell` (icono `MessagesSquare`).

### Pendiente / nota para Fase F

- [ ] Modificar `Login.tsx` para que tras Google sign-in llame
  `fnVerificarAdminWhitelist` y refresque token. Si falla, mostrar
  "Cuenta no autorizada" + `signOut`. Esto se hace cuando se construya la
  UI completa de chat porque hoy el flujo de login admin sigue siendo
  email+password legacy y migrar requiere coordinar con la pantalla de
  delegados.

---

## Fase E — Cliente nodo-web — chat de grupo ✅

- [x] Reescribir `nodo-web/src/features/mensajes/` → migrado a
  `nodo-web/src/features/chat-grupo/`, apunta a `chat_grupos_w/{nodoId}`.
  El nodo tiene **un solo chat** (su grupo) — no necesita selector.
- [x] Componente refactorizado (`ChatGrupoSheet` original):
  - Mensajes del día actual vía `onSnapshot` + paginación día por día
    de previos con heurístico 7-días-vacíos.
  - Send con `arrayUnion` al doc del día actual; `setDoc({merge:true})`
    crea si no existe.
  - `onSnapshot` al meta + al día actual.
  - Reply con cita (huella + remitenteNombre + texto + imagenUrl).
  - Imagen: upload a Storage en `chat_media_web_new_version/{neg}/{nodo}/{huella}.{ext}`.
- [ ] Indicador de escritura: postergado a Fase F (chat_typing).
- [x] Estado por miembro: `marcarApertura` al abrir actualiza
  `meta.estadoPorMiembro[nodoId].ultimaApertura/ultimoMensajeLeido`.

## Fase E-rev — Rediseño visual + compresión + back-handler ✅

Revisión hecha el 2026-05-11 sobre la implementación de Fase E.

- [x] **Visual**: `ChatGrupoSheet.tsx` (sheet lateral derecho, full-height)
  renombrado a `ChatGrupoModal.tsx` y rediseñado como **modal centrado**
  estilo `pop_mensajes.xml` del nodo_1 Android (card ~420px máx, alto
  85vh con tope 680px, backdrop semi-transparente).
- [x] **Compresión cliente**: imágenes de chat pasan por
  `compressToWebP({ maxBytes: 700 * 1024 })` antes del upload — re-encode
  WebP con quality decreciente + re-scale dimensional hasta caber. UI
  muestra placeholder "Comprimiendo imagen…" + bloquea inputs durante.
- [x] **Persistencia local automática** (sin botón "guardar"): el cache
  nativo `ImageCache.java` (APK) y el SW Workbox `firebase-storage-img`
  (navegador) ya cubren la persistencia de imágenes — substring
  `media_web_new_version` matchea también `chat_media_web_new_version`.
- [x] **Lightbox con back-handler interno**: si el lightbox está abierto
  encima del modal, el back físico Android lo cierra a él primero
  (stack-based, gana al handler del modal padre). Sin esto el back
  cerraba el chat entero.
- [x] **Cleanup completo en `useEffect([open])`**: reset `sending`,
  `comprimiendo`, `error`, `replyTo`, `emojiOpen`, `lightboxUrl` cuando
  el modal cierra. Fix del mismo patrón que el bug de
  `ConfirmarVentaModal` (state heredado entre aperturas).
- [x] **Guard contra entrada concurrente** en `onElegirImagen` por si
  el file-picker se dispara dos veces.
- [x] **Imágenes con `decoding="async"` + `loading="lazy"`** para
  reducir competencia de decode al abrir el modal.

---

## Fase F — Cliente admin-web — UI de chats

Sub-staging (cada uno es PR auditable independiente):

### F1 — Infraestructura + lista de chats ✅
- [x] Nueva ruta `/chat` en `App.tsx` (reemplaza a `/mensajes` legacy — borrado en F8).
- [x] Item "Chat" en `AppShell` reemplazando al legacy "Mensajes" (icon `MessageSquare`).
- [x] `features/chat/useChatList.ts` — onSnapshot a:
  - `negocios_w/{nid}/chat_grupos_w` filtrado por `miembros array-contains uid`
    (admin-delegado). Para superadmin: query sin filtro.
  - `negocios_w/{nid}/chat_directos_w` filtrado por `miembros array-contains uid`
    (ambos: superadmin y admin solo ven sus propios directos).
- [x] `routes/chat/ChatPage.tsx` — split-pane (sidebar lista + main view).
- [x] Auto-add del superadmin a `meta.miembros` con `arrayUnion` al abrir un
  grupo si no está (vía `marcarAperturaAdmin({autoAddMember:true})`).

### F2 — ChatView (lectura) ✅
- [x] `features/chat/useChatActivo.ts` — hook unificado (grupos + directos)
  análogo a `useChatGrupoNodo` de nodo-web. Paginación día por día con
  heurístico 7 días vacíos.
- [x] `features/chat/ChatView.tsx` — burbujas, fechas, replies, lightbox.
- [x] Copia de `ImageLightbox` desde nodo-web. `MensajesLista` + `Burbuja`
  inline en ChatView (futuro: extraer a `shared/ui` si crece).
- [x] `marcarApertura` al abrir el chat (con guard contra writes redundantes
  vía refs en el componente — separa "apertura inicial" de "ver mensaje
  nuevo", solo el segundo escribe únicamente `ultimoMensajeLeido`).

### F3 — Composer (envío) ✅
- [x] `features/chat/chatAdminService.ts` — `enviarMensajeTextoAdmin` /
  `enviarMensajeImagenAdmin` con `remitenteTipo: "admin"`. `arrayUnion` al
  día actual, `setDoc({merge:true})` si no existe.
- [x] Compose UI: texto + emoji + imagen con `compressToWebP({maxBytes:700KB})`.
- [x] Reply con preview cancelable.
- [x] Upload a `chat_media_web_new_version/{nid}/{chatId}/{huella}.{ext}`.

### F4 — Habilitar colaboradores en grupo ✅
- [x] `GrupoMiembrosPanel.tsx` — modal abierto desde botón "Miembros" en el
  header del grupo.
- [x] Sección "Colaboradores del negocio" con toggle Habilitar/Quitar por
  cada colaborador activo (lee `useColaboradores`).
- [x] Llama `fnHabilitarColaboradorEnGrupo` / `fnQuitarColaboradorDeGrupo`
  con loading per-row.

### F5 — Iniciar chat directo ✅
- [x] Botón "Nuevo" en header del sidebar.
- [x] `NuevoChatDirectoModal.tsx` con selector: admins-delegados (uid resuelto)
  + colaboradores habilitados. Excluye al propio uid. Búsqueda por texto.
- [x] `asegurarChatDirecto({uidA, uidB})` en service: calcula `pairId =
  sort([uidA, uidB]).join("__")`, crea meta si no existe, abre el chat.

### F6 — Telemetría admin (ultimaApertura) ✅
- [x] Sección "En el grupo" del `GrupoMiembrosPanel` muestra
  `estadoPorMiembro[memberId].ultimaApertura` formateada ("hace X min")
  por cada miembro del grupo.
- [x] Resuelve nombres legibles: nodo → `nodos.nombre`, admin → email de
  whitelist, colaborador → nombre del colaborador.

### F7 — Login admin con Google + whitelist ✅
- [x] `Login.tsx`: botón "Continuar con Google" arriba del form legacy.
- [x] Tras `signInWithPopup`, llama `fnVerificarAdminWhitelist({negocioId})`.
- [x] Si permission-denied → `signOut` + mensaje "Cuenta no autorizada".
- [x] Si OK → `currentUser.getIdToken(true)` para refrescar claims.
- [x] Email+pass legacy queda como fallback en la mitad inferior del form.

### F8 — Cleanup ✅
- [x] Borrado `admin-web/src/routes/mensajes/MensajesPage.tsx` + carpeta.
- [x] Borrado `admin-web/src/features/mensajes-admin/` entero.
- [x] Ruta `/mensajes` removida de `App.tsx`.
- [x] Item "Mensajes" del AppShell ya reemplazado por "Chat" en F1.

---

## Fase G — Migración Electron `gomu-chat`

Esto se planea por separado. Borrador inicial:

- [ ] El cliente Electron sigue funcionando con su schema viejo en
  paralelo.
- [ ] Crear ventana de "iniciar sesión": Google sign-in (delegado) o
  username+password (colaborador).
- [ ] Reescribir el lector/escritor de chat para apuntar a
  `chat_grupos_w/*` y `chat_directos_w/*` scoped al `negocioId` que el
  user obtiene de sus claims.
- [ ] Mantener LAN file transfer y system tray (no aplica a clientes
  web).

---

## Fase H — Cierre de rules

Cuando todos los clientes funcionen contra el schema nuevo:

- [ ] Diseñar reglas por path:
  - `chat_grupos_w/{nodoId}/meta` — read si soy miembro; write sólo CFs.
  - `chat_grupos_w/{nodoId}/dias/{ymd}` — read si miembro; write si
    miembro y el `arrayUnion` añade un mensaje cuyo `remitenteId` ===
    yo.
  - `chat_directos_w/{pairId}/...` — análogo, miembro = uno de los dos
    pairIds.
  - `chat_typing_w/{chatId}` — write sólo mi propia key.
  - `colaboradores_w/{cid}` — read sólo admins; write sólo CFs.
  - `chat_whitelist_admin_w/{emailKey}` — read sólo admins; write sólo
    CFs.
  - `meta.estadoPorMiembro[me]` — write sólo "yo".
- [ ] Considerar cerrar también las rules pendientes de
  `13-rules-pendientes-produccion.md` si vale la pena un single-PR.
- [ ] QA en `firebase emulators` antes de deploy.

---

## Apéndice — convenciones del repo a respetar

- `functions/index.js` v2 monolítico. **No** dividir en archivos sin
  refactor explícito.
- Helpers `requireAuth/requireSuperAdmin/requireAdminOrSuper` ya están
  arriba del archivo.
- `admin.firestore.FieldValue.serverTimestamp()` para timestamps server.
- En `shared/src/`: TypeScript estricto, evitar `any`.
- En clientes: imports `import {paths, type X} from "@shared"`.
- **No** crear archivos nuevos en `mensajes-admin/` (admin-web) — esa
  carpeta se reescribe entera en Fase F. La carpeta `mensajes/` original
  de nodo-web ya fue reemplazada por `chat-grupo/` en Fase E.
