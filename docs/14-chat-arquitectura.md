# Chat — Arquitectura de identidades, permisos y conversaciones

> **Cuándo usar este doc**: al diseñar o tocar el sistema de mensajería
> entre `admin-web`, `nodo-web` y la app de escritorio Electron
> (`gomu-chat`). Define quién puede hablar con quién y bajo qué scope.
>
> Estado: **borrador inicial** — recoge el spec dictado por el dueño del
> negocio. Hay puntos abiertos al final del documento que deben cerrarse
> antes de implementar.

## Índice

1. [Tipos de identidad](#tipos-de-identidad)
2. [Tipos de conversación](#tipos-de-conversación)
3. [Matriz de comunicación permitida](#matriz-de-comunicación-permitida)
4. [Capacidades requeridas del mensaje](#capacidades-requeridas-del-mensaje)
5. [Cómo encaja con los roles existentes](#cómo-encaja-con-los-roles-existentes)
6. [Inconsistencias / preguntas abiertas](#inconsistencias--preguntas-abiertas)

---

## Tipos de identidad

Cuatro tipos de ID distintos en el sistema de chat. Cada tipo necesita un
identificador estable porque es lo que aparece como autor en cada mensaje
y como participante en cada conversación.

| # | Tipo | Multiplicidad | Auth method | Scope |
|---|---|---|---|---|
| 1 | `admin-real` | exactamente **1** | Google sign-in (Firebase Auth) | Negocio entero |
| 2 | `admin-delegado` | 0..N | Google sign-in (whitelist por email, modelo Electron) | Negocio entero — **mismas facultades** que admin-real |
| 3 | `nodo-sucursal` | 0..N por sucursal | Anonymous + custom token (Firebase Auth, ya existe) | Una sucursal específica — **sin password ni email** |
| 4 | `id-colaborador` | 0..N | Username + password generados por admin → Custom token | Sólo chat — sin permisos admin |

### 1. `admin-real`

- Es la cuenta original del propietario.
- Hoy: `jesuscentenoramirez@gmail.com`.
- De aquí emanan todas las configuraciones del negocio: sucursales, nodos,
  whitelists de delegados/colaboradores.
- En el código actual mapea al rol `superadmin` (ver `04-auth-y-roles.md`).

### 2. `admin-delegado`

- Email autorizado por el `admin-real` en una whitelist (modelo Electron).
- Se autentica con Google sign-in.
- **Tiene exactamente las mismas facultades que `admin-real`**, incluyendo
  la capacidad de habilitar colaboradores en chats grupales.
- En el código actual mapea al rol `admin`.
- **Pendiente**: hoy no hay UI de whitelist; los `admin` se crean con
  email+password vía CF `createUser`. Hay que migrar al modelo Electron
  (sólo email en whitelist + Google sign-in, sin password).

### 3. `nodo-sucursal`

- Una tablet/dispositivo en una sucursal específica.
- Cada sucursal puede tener N nodos.
- Cada nodo tiene su propio chat (su propio grupo).
- En el código actual ya existe como rol `nodo` con claims
  `{negocioId, sucursalId, nodoId}`.
- ID estable: el `nodoId` ya generado por `fnRegistrarNodo`.

### 4. `id-colaborador`

- **No** se identifica con email, sino con un **username + password**
  generados por el admin (real o delegado).
- Es exclusivamente un usuario de chat: **no** tiene facultades admin sobre
  el negocio.
- Se autentica con username+password contra una Cloud Function que valida
  el hash y emite un Custom Token con `role: "colaborador"`. Mismo patrón
  que `usuariosMercancia` (PIN-hash) ya usado en `mercancia-web`.
- Pensado para usarse desde la app de escritorio Electron (`gomu-chat`),
  pero la identidad es válida también si entra desde un cliente web.
- Una persona = una identidad de chat (igual que admin-delegado): si
  entra desde múltiples dispositivos, todos comparten el mismo
  `colaboradorId` y por lo tanto la misma cola de mensajes y mismos
  estados de lectura. Modelo Facebook.
- **Nuevo en el código**: este tipo no existe hoy en `auth-y-roles.md`. Hay
  que definirlo como un nuevo `role` en custom claims (`colaborador`) y
  un nuevo doc Firestore con la lista de colaboradores (`colaboradorId`,
  username, passwordHash, habilitado, fechaCreacion).

---

## Tipos de conversación

### Chat grupal — uno por nodo

- **Único tipo de chat grupal que existe hoy.**
- Un grupo por cada `nodo-sucursal`. Si una sucursal tiene 5 nodos, hay 5
  grupos en el negocio.
- Miembros de origen del grupo de `nodo-N`:
  - `admin-real`
  - todos los `admin-delegado` del negocio (entran automáticamente a
    todos los grupos)
  - `nodo-N` (el nodo dueño del grupo)
- Miembros adicionales opcionales:
  - **Cualquier admin** (real o delegado) puede habilitar a uno o más
    `id-colaborador` específicos a un grupo específico.
  - La habilitación es **per-grupo** (un colaborador habilitado en el
    grupo del nodo-A no entra automáticamente al del nodo-B).
  - **No hay límite** de cuántos colaboradores puede tener un grupo.
- Una vez habilitado, el colaborador participa al 100%: lee y escribe
  igual que cualquier otro miembro. La prohibición colaborador↔nodo
  aplica sólo a chats individuales 1-a-1 (ver siguiente sección);
  dentro del grupo donde fue habilitado el colaborador y el nodo se
  comunican normalmente.
- Vida útil del grupo: mientras exista el nodo (no se elimina al cambiar
  de turno; el chat persiste).

### Chat individual (1-a-1)

- Permitido únicamente entre identidades de tipo:
  - `admin-real`
  - `admin-delegado`
  - `id-colaborador`
- **Cualquier** par dentro de ese conjunto puede abrir un chat individual
  (admin-real ↔ admin-delegado, admin-delegado ↔ admin-delegado,
  admin-delegado ↔ colaborador, etc.).
- Los `nodo-sucursal` **no** participan en chats individuales — su único
  canal es el grupo de su nodo.

### Comunicación prohibida

- `id-colaborador` ↔ `nodo-sucursal` **directa 1-a-1**: prohibida por
  defecto. Sólo pueden cruzarse mensajes vía el grupo del nodo cuando el
  colaborador está habilitado en él.
- Cuando un admin habilita al colaborador en el grupo, **el candado se
  remueve** dentro de ese contexto: el colaborador puede mandar y leer
  mensajes en el grupo libremente.
- Sigue abierto a re-evaluación si en el futuro se quiere permitir
  individuales colaborador↔nodo.

---

## Matriz de comunicación permitida

Filas = quién inicia · Columnas = con quién.

|  | admin-real | admin-delegado | nodo-N | id-colaborador |
|---|:---:|:---:|:---:|:---:|
| **admin-real** | — | individual | grupo de nodo-N | individual |
| **admin-delegado** | individual | individual | grupo de nodo-N | individual |
| **nodo-N** | grupo de nodo-N | grupo de nodo-N | — | grupo (si está habilitado) |
| **id-colaborador** | individual | individual | grupo (si está habilitado) | individual |

Notas:
- "grupo de nodo-N" significa que la conversación está acotada al chat
  grupal específico de ese nodo, no a un canal ad-hoc.
- "individual" = chat 1-a-1 separado.
- La diagonal (uno consigo mismo) no aplica.

---

## Capacidades requeridas del mensaje

Todo el modelo de datos debe soportar:

- **Estado de entrega/lectura por mensaje**:
  - `enviado` (✓) — escrito en Firestore.
  - `entregado` (✓✓) — recibido por el(los) destinatario(s).
  - `leído` (✓✓ azul) — abierto/visualizado por el destinatario.
- **Telemetría adicional para administradores**:
  - Los admins (real + delegados) ven, además del check de leído estándar,
    el **timestamp de última apertura/lectura** del chat por parte del
    resto de miembros (otros admins, nodos, colaboradores).
  - Nodos y colaboradores **sólo ven** los checks estándar (recibido /
    leído). No tienen acceso a timestamps de última apertura del resto.
  - Implica un campo extra `ultimaAperturaPorMiembro: { [memberId]: ts }`
    a nivel de chat, con regla de lectura que filtre el campo por rol
    del que consulta (admins lo leen completo; otros, sólo lo suyo).
- **Emojis** — texto Unicode dentro del campo `texto`. No requiere campo
  extra. (El picker es UI; el dato es texto.)
- **Imágenes** — referencia a Firebase Storage:
  - `mediaUrl` — URL pública/firmada de descarga.
  - `mediaFileName` — nombre original.
  - `mediaSize` — bytes.
  - **Compresión cliente antes del upload**: WebP ≤ 700 KB vía
    `compressToWebP` en `nodo-web/src/lib/image.ts` (re-encode con
    quality decreciente + re-scale dimensional hasta caber).
  - **Visor lightbox** fullscreen con pinch-zoom + doble-tap + pan
    (Pointer Events, optimizado tablet) — vive en
    `nodo-web/src/features/chat-grupo/ImageLightbox.tsx`.
  - **Persistencia local automática**: NO se requiere botón "guardar".
    En APK, `ImageCache.java` intercepta requests a
    `firebasestorage.googleapis.com` con substring `media_web_new_version`
    y guarda en `/data/data/.../files/img-cache/<sha256>.bin` indefinido.
    En navegador, el Service Worker (Workbox `firebase-storage-img`,
    CacheFirst, 1000 entradas, 30 días) hace lo equivalente. Re-renders
    sirven desde disco sin re-descarga.
- **Reply con cita**:
  - `replyEncabezado` — nombre del autor citado (snapshot).
  - `replyTexto` — texto recortado del mensaje citado (snapshot).
  - `replyImagenUrl` — URL de imagen citada cuando aplique.
- **Indicador de escritura** — efímero, fuera del documento del mensaje.
  Modelo Electron: doc `datos/typing_{chatId}` con
  `{ uid: timestamp }`. A definir cómo se estructura en el modelo
  scope-por-negocio.
- **Carga progresiva** — cargar últimos N mensajes y permitir "ver
  anteriores" sin descargar el histórico completo.

---

## Cómo encaja con los roles existentes

### Mapeo a custom claims

| Tipo de identidad | Role en claims | Identificador de chat | Notas |
|---|---|---|---|
| admin-real | `superadmin` (existe) | `uid` (Firebase Auth) | Uno por negocio |
| admin-delegado | `admin` (existe) | `uid` | Una identidad por persona; multi-device comparten uid |
| nodo-sucursal | `nodo` (existe) | `nodoId` | Ya existe; sin password |
| id-colaborador | `colaborador` (**nuevo**) | `colaboradorId` (uid emitido por CF al crear) | Una identidad por persona; multi-device comparten id |

### Path Firestore final

```
negocios_web_new_version/{nid}/
  ├── chat_grupos_web_new_version/{nodoId}    ← doc principal = meta
  │                                                (miembros, ultimoMensaje,
  │                                                estadoPorMiembro,
  │                                                colaboradoresHabilitados)
  │   └── dias/{ymd}                          ← un doc por día con
  │                                                { mensajes: ChatMensaje[] }
  │
  ├── chat_directos_web_new_version/{pairId}  ← doc principal = meta
  │                                                pairId = sort(idA,idB).join("__")
  │   └── dias/{ymd}
  │
  ├── chat_whitelist_admin_web_new_version/{emailKey}
  │                                    ← email normalizado como id del doc
  │
  ├── colaboradores_web_new_version/{colaboradorId}
  │                                    ← username, passwordHash, habilitado
  │
  └── chat_typing_web_new_version/{chatId}
                                       ← map { memberId: epochMs }
```

Notas:
- El **doc principal del chat ES el meta** (sin sub-doc separado). Esto
  permite `collectionGroup` queries para "todos los chats donde este
  colaborador está habilitado" y simplifica las rules.
- `dias/{ymd}` es write-heavy (cada mensaje hace `arrayUnion`). Aceptable
  para la cardinalidad esperada (≤ algunos cientos de mensajes por día
  por chat).
- `chatId` para typing es el mismo `nodoId` (grupo) o `pairId` (directo).

### Diferencias contra el schema del Electron `gomu-chat`

| Aspecto | Electron actual | Web propuesta |
|---|---|---|
| Scope de negocio | sin scope (raíz `mensajes_n`) | dentro de `negocios_web_new_version/{nid}` |
| Chats individuales | `mensajes_ind_{a__b}` plano | bajo el negocio |
| Triggers | `datos/mensajes_ac`, `datos/mensajes_ind_*` | bajo el negocio |
| Identidad | `deviceId` libre | `uid` Firebase Auth (admin) o `nodoId` (nodo) |

Para que `gomu-chat` pueda seguir siendo cliente, hay dos rutas
(detalle en preguntas abiertas):
1. Migrar `gomu-chat` a leer/escribir el schema web.
2. Dual-write desde el cliente Electron a ambos paths durante una ventana
   de transición.

---

## Decisiones cerradas

- **Mapeo de roles**: admin-real = `superadmin` actual, admin-delegado =
  `admin` actual. Sólo cambia el nombre conceptual.
- **Auth admin-delegado**: se migra al modelo Electron (Google sign-in
  con whitelist de emails). Se deprecia el flujo email+password.
- **Facultades**: admin-real y admin-delegado tienen las mismas. Cualquier
  delegado puede crear/quitar otros delegados o colaboradores.
- **No hay 1-a-1 admin↔nodo**: el chat actual de `nodo-web` se reemplaza
  por el grupo del nodo (`admin-real + admin-delegado* + nodo-N`).
- **UI del chat del nodo (revisión 2026-05-11)**: la versión inicial
  (Fase E) montaba un `Sheet` lateral derecho (full-height). Se rediseñó
  a **modal centrado** estilo `pop_mensajes.xml` del nodo_1 Android:
  card flotante de ~420 px máx, alto 85vh con tope 680 px, sobre
  backdrop semi-transparente. El componente vive en
  `nodo-web/src/features/chat-grupo/ChatGrupoModal.tsx` (antes
  `ChatGrupoSheet.tsx`, renombrado). Decisión motivada por consistencia
  visual con el resto de popups POS y mejor experiencia en tablets
  horizontales donde el sheet ocupaba demasiado espacio.
- **Habilitación de colaboradores**: cualquier admin (real o delegado)
  puede hacerlo. Es per-grupo. Sin límite de cuántos.
- **Colaborador en grupo participa al 100%**: lee y escribe igual que
  cualquier miembro. La prohibición colaborador↔nodo es sólo para
  individuales 1-a-1.
- **Telemetría de lectura**: admins ven el timestamp de última apertura
  del chat por cada miembro (campo `ultimaApertura` por miembro en el
  meta del chat); nodos y colaboradores sólo ven los checks estándar
  (recibido/leído). Admins también ven los checks estándar.
- **Auth colaborador**: username + password generados por admin → CF
  valida hash → emite Firebase Custom Token con `role: "colaborador"`.
  Mismo patrón de PIN-hash usado hoy en `usuariosMercancia`.
- **Identidad multi-device**: una persona = una identidad de chat. Si
  abre desde 3 dispositivos, todos comparten `uid` (admin) o
  `colaboradorId` (colaborador). Modelo Facebook.
- **`gomu-chat` Electron coexiste**: la app sigue operativa; el plan de
  migración mueve su schema al modelo scoped por negocio (ver Schema
  abajo). La transferencia LAN entre PCs queda exclusiva de Electron.
- **Carga progresiva**: paginación **día por día** (un doc Firestore =
  un día completo), con botón "Ver anteriores" que carga el día previo
  no-vacío más cercano. Heurístico anti-bucle: tras **7 días vacíos
  consecutivos** se detiene. Decisión revisada (2026-05-11): la idea
  original de "70 mensajes por bloque" se descartó porque cruzar docs
  por count requiere cursor + lectura extra, y mentalmente "ver lo de
  ayer" es más natural que "ver 70 más". Si en el futuro un día
  específico tiene 500+ mensajes, se resuelve con lazy-render en el
  cliente, no cambiando la unidad de paginación.
- **Schema Firestore — un día por doc** con array `mensajes`. Mismo patrón
  costo-eficiente del Electron actual. El **doc principal del chat ES el
  meta** (miembros + estadoPorMiembro + ultimoMensaje), con la sub-
  colección `dias/{ymd}` para mensajes. Ver "Path Firestore final" más
  abajo para el shape exacto.

- **Indicador de escritura**: doc `typing_w_new_version/{chatId}` con map
  `{ memberId: epochMs }`. Cliente debounce: escribe cada >3s, ignora
  entries con timestamp >6s. Aplica tanto a grupales como a directos.
- **Sin silenciar**: ningún tipo de usuario puede silenciar chats. Las
  notificaciones siempre disparan (tab parpadeo + Web Notification +
  service worker badge en PWA, native en Electron).
- **Sin migración de histórico**: el chat actual del Electron y los
  mensajes existentes en `nodo-web`/`admin-web` se descartan. Se arranca
  limpio con el nuevo schema.

---

## Próximos pasos

1. Sellar el schema Firestore final y los tipos en
   `shared/src/schema.ts`.
2. Definir las reglas de seguridad en `firestore.rules` que bloqueen las
   comunicaciones prohibidas (especialmente colaborador↔nodo individual).
3. Cloud Function que maneje:
   - Whitelist add/remove (admin / colaborador).
   - Login de colaborador (verificar password, emitir custom token).
   - Trigger de notifications (FCM o badge).
   - Mantenimiento de `typing_*` viejos.
4. Implementar el cliente:
   - Reusar lo que ya hay en `nodo-web/src/features/mensajes/` y
     `admin-web/src/features/mensajes-admin/` como base, expandiendo a
     1-a-1 e incorporando read receipts/typing/imágenes/reply.
5. Plan de migración de `gomu-chat` Electron al schema nuevo.
