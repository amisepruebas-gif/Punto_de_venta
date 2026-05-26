# Plan de pruebas — Chat fase E (chat de grupo del nodo)

> **Para qué sirve este doc**: guía de validación humana para confirmar
> que el chat grupal del nodo (Fase E) quedó sólido antes de pasar a
> Fase F (UI de chats en admin-web). Cada paso explica **qué se prueba**
> y **por qué importa** para detectar regresiones después.
>
> Fecha de la fase: 2026-05-04. **Revisión 2026-05-11**: rediseño visual
> del chat a modal centrado tipo `pop_mensajes` del nodo_1 + compresión
> de imágenes a ≤ 700 KB + back-handler interno para lightbox + fixes
> de cleanup. Componente renombrado de `ChatGrupoSheet.tsx` a
> `ChatGrupoModal.tsx`.
>
> Versiones desplegadas:
> - `https://amise-admin.web.app` (gestión de equipo chat)
> - `https://amise-nodo.web.app` (chat del nodo)
> - Cloud Functions: `asegurarChatGrupoNodo`, `eliminarColaborador` (hard-delete)

## Contexto rápido

- En esta fase **sólo el nodo** tiene UI de chat. El admin/delegado no.
- El admin puede gestionar la lista de delegados/colaboradores desde
  `amise-admin.web.app/equipo-chat`, pero todavía no ve los chats.
- Por eso hoy "te respondes a ti mismo" — eso es lo esperado.

## Antes de empezar

Abre estas pestañas:

| Pestaña | URL | Propósito |
|---|---|---|
| Admin | https://amise-admin.web.app | Gestión de equipo + ver `equipo-chat` |
| Nodo (POS) | https://amise-nodo.web.app | Donde está el chat |
| Firestore Console | https://console.firebase.google.com/project/amisetienda-c7eab/firestore | Validar la persistencia |
| Auth Console | https://console.firebase.google.com/project/amisetienda-c7eab/authentication/users | Validar borrado de auth users |

Refresca con **Ctrl+Shift+R** en ambas apps para forzar la versión nueva.

---

## TEST 1 — El botón flotante existe y abre el chat

### Pasos
1. Entra a `amise-nodo.web.app`.
2. Mira la esquina inferior derecha, sobre los billetes del PagoFooter.
3. Debe aparecer un círculo azul con icono de mensaje 💬.
4. Pulsa el botón.

### Criterio de éxito
- Se abre un **modal centrado** flotando sobre un backdrop oscuro
  semi-transparente, con título **"Chat del nodo"**. Estilo replica
  `pop_mensajes.xml` del nodo_1 Android.
- Card ~420 px máx de ancho, hasta 85vh de alto.
- Subtítulo: **"Grupo con admins"** (+ vendedor si está seleccionado).
- Campo de texto y botón ✈️ visibles abajo.
- Click fuera del card (sobre el backdrop) cierra el modal.

### Razón
- Valida que `FloatingChatButton` se conectó correctamente en
  `routes/Ventas.tsx`.
- Valida que `ChatGrupoModal` se monta sin errores (renombrado del
  legacy `ChatGrupoSheet`, antes `ChatSheet` legacy).

### Si falla
- Si no aparece el botón → posible cache PWA. Reinicia la app o desinstala
  y reinstala la PWA.
- Si aparece pero al pulsar no abre nada → abre la consola del navegador
  (F12), copia el error y reportalo.

---

## TEST 2 — Backfill del grupo en nodos pre-existentes

### Pasos
1. Antes de abrir el chat por primera vez en un nodo viejo, abre Firestore
   Console y verifica que **NO** existe
   `negocios_web_new_version/amise/chat_grupos_web_new_version/{tuNodoId}`.
2. Abre el chat (TEST 1).
3. Espera 1-2 segundos.
4. Refresca Firestore Console.

### Criterio de éxito
- El doc ahora existe.
- Tiene los campos:
  - `chatId` = tu nodoId
  - `tipo` = `"grupo"`
  - `nodoId` = tu nodoId
  - `miembros` = array que incluye al menos tu nodoId
  - `colaboradoresHabilitados` = `[]`
  - `estadoPorMiembro` = objeto vacío `{}` o con tu nodoId si ya
    enviaste algo
  - `fechaCreacion`, `fechaActividad` = timestamps recientes

### Razón
- La CF `asegurarChatGrupoNodo` es la responsable de hacer backfill de
  nodos registrados antes de que existiera el sistema de chat. Sin
  ella, esos nodos no tendrían un grupo y no podrían chatear.
- También se llamará en cada apertura del chat (es idempotente). Que
  no falle al ya existir confirma la idempotencia.

### Si falla
- Aparece franja roja sobre el chat con error → cópiame el mensaje.
  Suele ser problema de claims (el cliente debe ser nodo del negocio).

---

## TEST 3 — Enviar mensaje de texto

### Pasos
1. En el chat, escribe **"Hola, prueba 1"**.
2. Pulsa el botón ✈️.

### Criterio de éxito
- La burbuja aparece azul a la derecha (es tuya).
- Arriba aparece un separador con la fecha de hoy: **"4 de mayo de 2026"**.
- El campo de texto se limpia.
- En Firestore: aparece el doc
  `chat_grupos_w/{nodoId}/dias/20260504` con un array `mensajes` con un
  elemento que tiene `huella`, `remitenteId`, `remitenteTipo: "nodo"`,
  `texto`, `fechaISO`.
- En el meta del grupo: `ultimoMensaje` se actualizó con el snapshot.

### Razón
- Valida el flujo completo: cliente → `setDoc` con `arrayUnion` →
  Firestore.
- El doc del día se crea automáticamente si no existía (el `setDoc` con
  `merge:true` lo cubre).
- El meta refleja siempre el último mensaje para que la lista de chats
  (que se construye en Fase F) muestre preview sin leer el día completo.

---

## TEST 4 — Emojis

### Pasos
1. Pulsa el icono **😊** a la izquierda del input.
2. Aparece una grilla de emojis. Selecciona uno (ej. ❤️).
3. El emoji se inserta donde estaba el cursor en el texto.
4. Agrega texto y envía.

### Criterio de éxito
- El emoji aparece tal cual en la burbuja.
- En Firestore, el `texto` del mensaje contiene los caracteres Unicode
  (no códigos escapados).

### Razón
- Los emojis son texto Unicode estándar — el campo `texto` no requiere
  estructura especial. Esto valida que la cadena viaja sin transformaciones
  raras.

---

## TEST 5 — Subir imagen

### Pasos
1. Pulsa el icono **➕🖼** (segundo a la izquierda).
2. Selecciona una imagen del dispositivo.
3. Si tenías texto escrito, queda como pie de la imagen.
4. Espera 2-5 segundos (depende del tamaño y red).

### Criterio de éxito
- Aparece una burbuja con la imagen (max 256px de alto).
- Si había texto, debajo de la imagen.
- En Firestore: el mensaje tiene `mediaUrl` (URL HTTPS larga de Firebase
  Storage), `mediaFileName`, `mediaSize`.
- En Firebase Storage Console: aparece el archivo en
  `chat_media_web_new_version/{negocioId}/{nodoId}/{huella}.{ext}`.
- El `meta.ultimoMensaje.esMedia` está en `true`.

### Razón
- Valida la integración con Firebase Storage (upload + getDownloadURL).
- Valida que `mediaUrl` queda persistido y accesible — un mensaje sin
  esto se vería sin imagen al recargar.
- El path bajo `negocioId/nodoId/` permite reglas de seguridad por
  negocio cuando se cierren las rules.

---

## TEST 6 — Lightbox de imagen

### Pasos
1. Toca/click en la imagen de cualquier burbuja.
2. Se abre el viewer fullscreen.
3. Pellizca con dos dedos (touch) o doble-click (mouse) para zoom.
4. Pulsa la X o tap fuera para cerrar.

### Criterio de éxito
- La imagen se ve a tamaño completo.
- Zoom y pan funcionan suavemente.
- Cierra al pulsar X.

### Razón
- Las fotos térmicas/de tickets pueden ser pequeñas y necesitar zoom.
- El componente `ImageLightbox` se reutiliza tal cual del legacy — esto
  confirma que el move (de `features/mensajes/` a `features/chat-grupo/`)
  no rompió la interacción.

---

## TEST 7 — Reply con cita

### Pasos
1. En cualquier burbuja existente, busca el iconito de flecha curva ↪️
   en la esquina inferior derecha de la burbuja.
2. Pulsa el icono.
3. Sobre el input aparece una barra: **"Respondiendo a {Nombre}"** + el
   texto del mensaje original (recortado).
4. Escribe "Esta es una respuesta" y envía.

### Criterio de éxito
- La nueva burbuja muestra arriba un recuadrito con la cita
  (nombre + texto del mensaje original).
- En Firestore, el mensaje tiene los campos `replyHuella`,
  `replyRemitenteNombre`, `replyTexto` (y `replyImagenUrl` si la cita era
  una imagen).
- Si pulsas la **X** en la barra de respuesta antes de enviar, se cancela
  la respuesta y la barra desaparece.

### Razón
- Es el patrón estándar de chats modernos.
- Los campos reply son **snapshots**: si después se borra el mensaje
  original, la cita sigue completa porque guardamos copia del texto.

---

## TEST 8 — Paginación "Ver anteriores"

### Pasos
1. Con el chat abierto, mira arriba: hay un botón **"Ver anteriores"**.
2. Pulsa el botón.

### Criterio de éxito (en escenarios distintos)
- **Si no hay días previos** (caso normal hoy): el botón intenta cargar
  hacia atrás, no encuentra nada en 7 días seguidos, desaparece (o queda
  como `Cargando...` brevemente y luego no muestra mensajes).
- **Si tienes mensajes de días previos**: aparecen ordenados arriba,
  separados por la fecha del día.

### Razón
- Carga progresiva — para no descargar todo el histórico de una vez.
- Detener tras 7 días vacíos es un heurístico anti-bucle infinito.
- Tras Fase F y G entrarán mensajes reales y se podrán hacer pruebas más
  realistas.

---

## TEST 9 — Estado de apertura (telemetría admin)

### Pasos
1. Cierra y abre el chat varias veces.
2. En Firestore Console, abre el doc del meta del grupo.
3. Mira `estadoPorMiembro.{tuNodoId}.ultimaApertura`.

### Criterio de éxito
- El timestamp se actualiza cada vez que abres el chat.
- También aparece `estadoPorMiembro.{tuNodoId}.ultimoMensajeLeido` con
  la huella del último mensaje que viste.

### Razón
- Q1 cerrada en `14-chat-arquitectura.md`: los admins van a poder ver
  cuándo cada miembro abrió el chat por última vez. Esto valida que el
  campo se está poblando correctamente. La UI que lo expone vive en
  Fase F (admin-web).

---

## TEST 10 — Equipo chat (regresión, no debe romperse)

### Pasos
1. Ve a `amise-admin.web.app/equipo-chat`.
2. Verifica que la pestaña **Admins delegados** sigue mostrando los
   emails que agregaste anteriormente.
3. Verifica que la pestaña **Colaboradores** sigue listando los que
   creaste.

### Criterio de éxito
- Todo lo que estaba antes sigue ahí.
- Crear un colaborador nuevo sigue funcionando.

### Razón
- Asegura que la Fase E (tocar nodo-web + functions) no rompió
  componentes de Fase D (admin-web).

---

## TEST 11 — Eliminar colaborador es hard-delete

### Pasos
1. En `equipo-chat → Colaboradores`, crea un colaborador "test_borrar".
2. Pulsa **Eliminar** sobre él. Confirma el diálogo.

### Criterio de éxito
- El colaborador **desaparece de la lista** (NO queda gris "Deshabilitado"
  como antes del fix).
- En Firestore Console, el doc en `colaboradores_web_new_version`
  efectivamente **no existe**.
- En Firebase Auth Console (pestaña Authentication), el usuario tampoco
  existe.

### Razón
- El primer comportamiento (soft-delete) hacía que **Pausar** y
  **Eliminar** se vieran idénticos para el usuario, lo cual era confuso.
  Hard-delete con cleanup en grupos es el comportamiento UX correcto.
- Los mensajes históricos del colaborador no se rompen porque
  `remitenteNombre` se guarda como snapshot dentro de cada mensaje.

---

## TEST 12 — Imagen pesada se comprime a ≤ 700 KB (revisión 2026-05-11)

### Pasos
1. Abre el chat.
2. Pulsa el icono **➕🖼** y elige una imagen original > 2 MB (fotos de
   cámara típicas — 3-8 MB).
3. Mira el input mientras procesa.

### Criterio de éxito
- Mientras comprime, el placeholder del input dice
  **"Comprimiendo imagen…"** y los inputs (texto, emoji, imagen, send)
  quedan disabled.
- Tras 1-3 segundos termina y la burbuja aparece con la imagen.
- En Firebase Storage Console, abre el archivo subido: tipo
  **`image/webp`**, tamaño **≤ 700 KB**.
- El `mediaSize` en el mensaje refleja el tamaño post-compresión.

### Razón
- Sin esto cada imagen del POS subía con su tamaño original (varios MB),
  agotando la cuota mensual de Storage rápido y reventando ancho de
  banda en redes pobres. La compresión cliente garantiza un tope
  estricto antes de tocar la red.
- `compressToWebP` re-encode con quality decreciente + re-scale
  dimensional. Si la imagen original ya es pequeña, retorna casi
  inmediato sin re-encode visible.

---

## TEST 13 — Back físico Android cierra lightbox antes que modal (revisión 2026-05-11)

> Aplica sólo en APK. En navegador puro, el botón "back" del browser
> hace historial nativo y no aplica.

### Pasos
1. Abre el chat (modal centrado).
2. Toca una imagen → se abre el lightbox encima.
3. Pulsa el back físico de Android **una vez**.

### Criterio de éxito
- El **lightbox se cierra**.
- El **modal del chat sigue abierto**.
- Si pulsas back de nuevo, ahora sí cierra el modal del chat.

### Razón
- Sin el handler interno del chat, el back-handler de `Ventas.tsx`
  veía `chatOpen=true` y cerraba el chat entero, **incluyendo el
  lightbox encima**. UX inconsistente con el resto del app.
- El `useBackHandler` interno en `ChatGrupoModal` se queda encima del
  stack y consume primero el back cuando `open && lightboxUrl`.

---

## Tests fuera de alcance hoy

| Feature | Cuándo | Fase |
|---|---|---|
| Admin envía mensaje al grupo del nodo | Cuando admin tenga UI de chat | F |
| Chats directos 1-a-1 admin↔delegado | Cuando admin tenga UI de chat | F |
| Login de delegado por Google + whitelist | Junto con UI admin | F |
| Indicador "está escribiendo…" | Cliente lee `chat_typing_w` y muestra punto | F |
| Checkmarks ✓ / ✓✓ / ✓✓ azul | UI lee `marcarEntregado` + `ultimoMensajeLeido` por miembro | F |
| Notificaciones (sonido, badge) | Web Notifications API + service worker | F+ |
| Login de colaborador | Cliente colaborador (Electron) | G |
| Chat desde Electron `gomu-chat` | Migración de la app de escritorio | G |
| Cierre de Firestore rules | Cuando todos los clientes funcionen | H |

---

## Reporte tras pruebas

Vuélveme a contar para cada test:
- TEST 1: ✅ / ❌
- TEST 2: ✅ / ❌
- TEST 3: ✅ / ❌
- TEST 4: ✅ / ❌
- TEST 5: ✅ / ❌
- TEST 6: ✅ / ❌
- TEST 7: ✅ / ❌
- TEST 8: ✅ / ❌
- TEST 9: ✅ / ❌
- TEST 10: ✅ / ❌
- TEST 11: ✅ / ❌
- TEST 12: ✅ / ❌ (revisión 2026-05-11)
- TEST 13: ✅ / ❌ (revisión 2026-05-11)

Y mándame:
- Cualquier mensaje rojo / error que aparezca en pantalla.
- Si abres la consola del navegador con F12, errores en la pestaña
  **Console**.
- Screenshots de Firestore si algo se ve raro.

Con eso confirmamos Fase E y avanzamos a Fase F.
