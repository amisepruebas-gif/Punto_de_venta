# Fase G — Migración del cliente Electron `gomu-chat` al schema nuevo

> **Para qué sirve este doc**: registro vivo del trabajo de migración del
> cliente Electron `gomu-chat` (ubicado en
> `dispositivo_1/dispositivo_1/mensajes`) del schema legacy al schema
> scoped por negocio definido en `docs/14-chat-arquitectura.md`.
>
> Si retomas el trabajo en otra sesión, empieza por leer este MD para no
> perder contexto.

## Contexto

`gomu-chat` v1.6.2 es la app Windows desktop (Electron 33) que los
colaboradores usan para chatear. Hoy:

- Apunta al mismo proyecto Firebase (`amisetienda-c7eab`).
- Usa schema legacy: `mensajes_n`, `mensajes_ind_{a__b}`, `datos/`, etc.
  Sin scope por `negocioId`.
- "Auth" es solo elegir un `deviceId` libre al primer setup. Cualquiera
  con la app puede leer/escribir.
- Implementa un `ChatManager` (1100+ LOC) que replica el patrón legacy
  de `dispositivo_1.apk`: doc trigger con `huella_mensaje` + descarga
  selectiva por día + persistencia manual en electron-store.

El destino:

- Schema scoped: `negocios_w/{nid}/chat_grupos_w/...` y
  `.../chat_directos_w/...` (ya implementado en nodo-web + admin-web).
- Auth real vía `fnLoginColaborador` CF — emite Custom Token con
  `role:"colaborador"`, `negocioId`.
- Reemplazar `ChatManager` manual por `onSnapshot` directo (el SDK web
  hace la persistencia incremental con `persistentLocalCache`).

Decisiones cerradas (confirmadas con el usuario 2026-05-12):

1. Setup cambia a login real con `username + password` (credenciales que
   admin emite desde `/equipo-chat`). Elimina el "elige tu nombre".
2. Clean slate — los datos de electron-store del schema viejo se
   borran al primer arranque post-migración. Coincide con doc 14
   línea 296-298: "el chat actual del Electron y los mensajes
   existentes en nodo-web/admin-web se descartan".
3. **No tocar el original** `dispositivo_1/dispositivo_1/mensajes/` —
   sigue funcional en paralelo durante la migración. La nueva versión
   vive en `dispositivo_1/dispositivo_1/mensajes-v2/`.
4. **Conservar** el flujo LAN de transferencia de archivos (exclusivo
   de Electron, valioso para archivos pesados). Solo adaptamos el
   metadata al schema nuevo.
5. **Conservar** el módulo Checador (timecard) — feature separada, no
   se toca.
6. **Conservar** el auto-update server (`update-server/`).

## Inventario inicial

Estructura actual del proyecto (en la copia `mensajes-v2/`):

| Archivo | LOC | Rol |
|---|---|---|
| `main.js` | 1095 | Proceso principal Electron — ventanas, IPC, app lifecycle |
| `preload.js` | 1014 | Bridge contextBridge entre main y renderer |
| `firebase-config.js` | 19 | Credenciales — apunta a `amisetienda-c7eab` |
| `renderer/app.js` | 4517 | UI completa del chat |
| `renderer/index.html` | 690 | Markup |
| `renderer/styles.css` | 1954 | Estilos |
| `update-server/` | — | Server de auto-update |

Mapa de secciones de `renderer/app.js`:

| Líneas | Sección | Acción Fase G |
|---|---|---|
| 1-118 | Constantes, theme, emoji picker | Preservar |
| 120-330 | **`ChatManager` clase + listeners legacy** | **Reemplazar (G4)** |
| 332-505 | Estado local de chats, switchChat, renderContacts | **Reescribir (G3, G4)** |
| 508-797 | Imágenes: detección, agrupamiento, render | Preservar UI; adaptar fuente de datos |
| 799-840 | Image viewer / lightbox | Preservar |
| 844-1019 | `enviarMensaje`, `enviarImagen`, LAN/Cloud paths | **Reescribir (G5)** |
| 1021-1033 | Reply + emoji picker | Preservar |
| 1037-1063 | Typing signal | **Adaptar al path nuevo (G6)** |
| 1068-1093 | Helpers (`generarID`, `parseFechaFromID`, `getMostRecentDate`…) | **Borrar (G8)** — ya no aplica al schema nuevo |
| 1095-1290 | UI helpers, bindEvents | Preservar; ajustar handlers donde apliquen |
| 1290+ | Checador | Preservar tal cual |

## Sub-fases con checklist

### G1 — Inventario + plan ✅
- [x] Copia del proyecto en `dispositivo_1/dispositivo_1/mensajes-v2/`
- [x] Mapeo estructural de `app.js`
- [x] Identificación de `ChatManager` como pieza central a reemplazar
- [x] Confirmación de decisiones con el usuario
- [x] Este doc

### G2 — Auth como colaborador ✅
- [x] Inspeccionar el setup actual (`startApp`, `init`, `handleSetup` en `app.js`) y entender qué guarda en electron-store
- [x] Diseñar el nuevo flujo de login: pantalla de setup pide `negocioId` + `username` + `password`
- [x] Wire `signInWithCustomToken` con el token devuelto por `loginColaborador` (CF callable)
- [x] Manejo de errores: usuario invalid, password incorrecto, colaborador deshabilitado (`humanizeLoginError`)
- [x] Refresh de claims tras login + autosignin vía la persistencia nativa de Firebase Auth (IndexedDB) + cache de `colaborador_last_login` para autofill del UI
- [x] Logout: `signOut(auth)` desde botón en panel de Ajustes; `onChange` callback dispara `location.reload()` para limpieza completa de estado
- [x] Actualizar `index.html` setup screen con los 3 inputs

**Implementación**:
- `mensajes-v2/preload.js`: añadidos imports `firebase/auth` + `firebase/functions`. Inicializa `authInst`, `fnsInst`, y `loginColaboradorFn = httpsCallable(fnsInst, 'loginColaborador')`. Nuevo bridge `gomu.colaborador` con `{ login, signOut, onChange, current }`. Usa `onIdTokenChanged` (no `onAuthStateChanged`) para captar refreshes de claims.
- `mensajes-v2/renderer/index.html`: setup-screen reescrita con 3 inputs (negocio, usuario, password) + `setup-error` inline. Nueva sección "Sesión de chat" en Ajustes con `colaborador-info` + botón "Cerrar sesión".
- `mensajes-v2/renderer/styles.css`: estilo `.setup-error` (rojo translúcido), `.setup-container` ensanchado a 320px.
- `mensajes-v2/renderer/app.js`: `currentColaborador` global; `init()` espera el primer `onChange` (con failsafe 5s) — si hay sesión persistida arranca app; si no, muestra setup. Re-arranque automático si cambia de UID o si se cierra sesión. `handleSetup()` ahora llama `gomu.colaborador.login(...)`. `humanizeLoginError()` traduce errores comunes. Clean slate del schema legacy una sola vez (`schemaG_migrated` flag).

**Riesgo conocido** (a validar en `npm start`): `require('firebase/auth')` en el preload de Electron resuelve al bundle `node` (`@firebase/auth/dist/node/index.js`) por la condition map de package.json. Si la persistencia browser (IndexedDB) no se inicializa correctamente desde ese bundle, el usuario tendrá que re-loguear en cada reinicio (no bloqueante — sigue funcional). Si falla del todo el `signInWithCustomToken`, ajustar a path directo `require('@firebase/auth/dist/browser-cjs/index.js')`.

### G3 — Lista de chats
- [ ] `renderContacts` reemplazado por `renderChatList` que escucha:
  - `negocios_w/{nid}/chat_grupos_w` con `where("miembros", "array-contains", colaboradorId)`
  - `negocios_w/{nid}/chat_directos_w` con `where("miembros", "array-contains", colaboradorId)`
- [ ] Resolver nombres legibles para items:
  - Grupos: nombre del nodo (lookup en `nodos_w` por nodoId)
  - Directos: nombre del otro miembro (lookup en `chat_whitelist_admin_w` para admins, `colaboradores_w` para otros colaboradores)
- [ ] Mostrar preview del último mensaje (`ultimoMensaje.textoPreview`) y badge de no-leídos
- [ ] Click → `switchChat(chatId, tipo)`

### G4 — ChatManager nuevo (mensaje listener)
- [ ] Borrar la clase `ChatManager` actual
- [ ] Reemplazar por hook simple per-chat: `onSnapshot` al meta + `onSnapshot` al día actual + on-demand `getDoc` a días anteriores ("Ver anteriores")
- [ ] Mismo patrón que `useChatActivo.ts` de admin-web
- [ ] Aprovechar persistencia offline del Firestore SDK (configurar `enableIndexedDbPersistence` para Electron) en lugar de `gomu.store` manual
- [ ] Borrar electron-store keys del schema viejo al primer arranque (`chat_msgs_*`, `chat_fechas_*`, `chat_huella_*`)
- [ ] Adaptar `renderChat`, `msgEl`, `clusterEl` al shape `ChatMensaje` del schema nuevo (`huella`, `remitenteId`, `remitenteTipo`, `remitenteNombre`, `fechaISO`, `texto`, `mediaUrl`, `mediaFileName`, `mediaSize`, `replyHuella`, `replyRemitenteNombre`, `replyTexto`, `replyImagenUrl`)

### G5 — Send (texto + imagen)
- [ ] `enviarMensajeTextoColaborador({negocioId, chatId, tipo, ...})` con `remitenteTipo: "colaborador"`
- [ ] `arrayUnion` al `chat_grupos_w/{chatId}/dias/{ymd}` o `chat_directos_w/{pairId}/dias/{ymd}`
- [ ] Actualizar `meta.ultimoMensaje` snapshot
- [ ] `enviarMensajeImagenColaborador`: compress a WebP ≤700KB (igual que admin-web/nodo-web) + upload a `chat_media_web_new_version/{nid}/{chatId}/{huella}.{ext}` + persist mensaje con `mediaUrl`
- [ ] Reply: incluir `replyHuella + replyRemitenteNombre + replyTexto + replyImagenUrl` cuando hay reply activo
- [ ] Marcar apertura: `meta.estadoPorMiembro[colaboradorId].ultimaApertura/ultimoMensajeLeido`

### G6 — Features secundarias
- [ ] Typing indicator: escribir `chat_typing_w/{chatId}` con `{[colaboradorId]: Date.now()}` cada >3s. Leer y filtrar entries >6s. Adaptar el `sendTypingSignal/clearTypingSignal/updateTypingUI` existente.
- [ ] Reply preview cancelable — preservar el actual, solo cambiar lo que persiste
- [ ] Notify (Web Notification API ya está en `gomu.notify`) — adaptar al payload del mensaje nuevo
- [ ] Lightbox — preservar tal cual (no depende del schema)
- [ ] Sonido al recibir mensaje — preservar (`playSound()`)

### G7 — LAN transfer (preservar pero adaptar)
- [ ] El flujo `sendOneViaLan` se mantiene — funcional para archivos pesados peer-to-peer
- [ ] Adaptar el metadata del mensaje LAN al schema nuevo (referencias al colaboradorId, no deviceId)
- [ ] Path del archivo recibido: configurable como antes (`updateReceivePath`)

### G8 — Cleanup
- [ ] Borrar helpers ya no usados: `parseFechaFromID`, `getMostRecentDate`, `getOldestDate`, `getAllDates`, `getDatesAfter`, `sortJSON`
- [ ] Borrar referencias a `mensajes_n`, `mensajes_ind_*`, `datos/mensajes_ac`
- [ ] Actualizar `README.md` del proyecto Electron
- [ ] Verificar que `dev.bat` y `build` siguen funcionando
- [ ] Bump version en `package.json` a `2.0.0` (breaking change con el schema legacy)

## Archivos críticos esperados a modificar

- `mensajes-v2/firebase-config.js` — sin cambio (mismo proyecto)
- `mensajes-v2/main.js` — posiblemente ajustes IPC si auth requiere helpers nativos (probable mínimo)
- `mensajes-v2/preload.js` — ajustar funciones expuestas (`gomu.*`) — algunas legacy ya no aplican
- `mensajes-v2/renderer/app.js` — **mayor reescritura**: ChatManager, send, contacts, init
- `mensajes-v2/renderer/index.html` — setup screen con `username + password`
- `mensajes-v2/renderer/styles.css` — ajustes menores
- `mensajes-v2/package.json` — version bump, posible nueva dep `firebase` con paths web

## Validación al final de cada sub-fase

- `npm install` corre limpio
- `npm start` abre la app
- Setup completa con un colaborador válido (creado en admin-web `/equipo-chat`)
- Lista de chats aparece correctamente
- Mensajes se envían y reciben en tiempo real
- Imagen sube y se ve
- LAN transfer funciona si hay otro PC con la misma versión

## Riesgos conocidos

1. **Persistencia offline en Electron**: Firestore web SDK normalmente
   está pensada para browser. En Electron renderer puede tener quirks
   (multi-tab manager, IndexedDB en sandboxed renderer). Validar al
   inicio de G4.
2. **Login con Google no aplica**: el colaborador no usa Google. Solo
   custom token via `fnLoginColaborador`. Verificar que el Custom Token
   funciona con `initializeAuth` en Electron.
3. **CSP en Electron**: si el renderer tiene Content-Security-Policy
   restrictiva, Firebase SDK puede chocar. Revisar `main.js` para CSP.
4. **Versiones del SDK**: el `package.json` dice `firebase ^10.14.1`.
   Compatible con todo lo que usa nodo-web/admin-web.
