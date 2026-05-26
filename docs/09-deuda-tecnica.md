# Deuda técnica

> **Cuándo usar este doc**: al priorizar pulido post-MVP. Lista consolidada
> de cosas documentadas como "pendiente" durante la implementación, con
> severidad, impacto, y plan de resolución.
>
> Fuente de verdad: `_NOTAS_TRABAJO.md` (eliminado al cerrar migración).
> Este doc persiste como registro histórico.

## Índice

1. [Glosario de severidad](#glosario-de-severidad)
2. [Crítica](#crítica)
3. [Alta](#alta)
4. [Media](#media)
5. [Baja / notas](#baja--notas)
6. [Ya resuelto (histórico)](#ya-resuelto)

---

## Glosario de severidad

- **CRÍTICA**: causa pérdida de datos, degradación grande de UX, o corre
  en producción con bugs activos. Resolver antes de onboarding masivo.
- **ALTA**: bug real con workaround existente, o riesgo potencial que
  podría escalar. Resolver en las próximas 1-2 sprints.
- **MEDIA**: mejora de UX / performance / mantenibilidad. Priorizar según
  feedback de usuarios.
- **BAJA / NOTA**: mejoras cosméticas, refactors, o decisiones a
  re-evaluar. Sin urgencia.

---

## Crítica

_(Ninguna abierta al momento de escribir este doc — todas las CRÍTICAS
detectadas en auditoría se resolvieron antes de cerrar la fase
correspondiente.)_

---

## Alta

### F5 — Token TTL 1h post-revocación

**Ubicación**: `functions/index.js` `revocarNodo` + rules.

**Descripción**: `revokeRefreshTokens` invalida los refresh tokens, pero
los ID tokens vigentes siguen siendo válidos hasta que expiren (máximo 1
hora). Un nodo revocado puede seguir escribiendo ventas durante esa
ventana.

**Impacto**: cliente con mala intención tras la revocación tiene hasta 1h
para causar daño. En práctica, las ventas escritas en esa ventana son
trazables al `nodoId` revocado.

**Mitigación implementada**: ninguna runtime. Documentado en
[`04-auth-y-roles.md`](04-auth-y-roles.md).

**Plan**:

- Opción A (server-side): regla Firestore que valida `get(nodoRef).estado == "activo"` en cada write del nodo. Costo: 1 read extra por write.
- Opción B (client-side): `onSnapshot` al propio doc del nodo. Si `estado == "revocado"`, bloquear writes locales y mostrar mensaje. No protege contra clientes maliciosos modificados, pero sí contra el 99% de casos (tablet normal).
- **Recomendado**: Opción B como mitigación inmediata + Opción A en rules como defensa en profundidad.

### I1 — migración legacy edge case

**Ubicación**: `functions/index.js migrarDataLegacy`.

**Descripción**: si una venta legacy no tiene `huella` ni `id_registro`, el
ID destino se genera como `legacy_${summary.ventas}`. Ese contador reinicia
cada run → re-ejecutar podría duplicar esos docs.

**Impacto**: bajo — las ventas Android **típicamente** sí tienen `huella`
(generada por `editar_articulos.generarID()`). Solo afecta registros
corruptos del legacy.

**Plan**: antes de correr la migración real en producción, hacer dry-run
por tipo y verificar que el count coincida con el conteo esperado en el
Android. Si hay discrepancia, investigar los docs sin huella manualmente.

---

## Media

### D3 — Bug resuelto, nota para UI futuras

**Ubicación**: `admin-web/features/articulos/ImageUpload` + service.

**Descripción original**: era imposible "quitar" una imagen existente.

**Estado**: **RESUELTO** via callback `onRemove` + flag `imagenRemoved`.

**Nota**: el patrón `onFile(File|null) + onRemove()` es la receta para
distinguir "no cambió" vs "borró". Si se agrega otro campo tipo "imagen
opcional" en admin-web, seguir el mismo patrón.

### F1 — Edit inline pisa valor remoto (resuelto)

**Ubicación**: `EquipoPage.EditableNombre`, `TallasPage.GrupoEditor`.

**Descripción**: `useState(inicial)` solo se evaluaba en mount. Si otro
admin editaba el nombre mientras tú tenías la lista abierta, tu input
seguía con el valor viejo.

**Estado**: **RESUELTO** via `useEffect + useRef` que sync cuando el input
no tiene focus.

**Nota**: para cualquier "edit inline", usar este patrón. Considerar
extraer a un hook `useSyncedInput(value, { onCommit })`.

### G3 — VentaDetailPage carga 500 docs

**Ubicación**: `admin-web/routes/ventas/VentaDetailPage.tsx`.

**Descripción**: para mostrar una venta específica via deep-link, se
cargan las últimas 500 ventas y se busca por `ventaId`. Costoso en
Firestore reads si el user accede vistas de detalle frecuentemente.

**Impacto**: $/reads. Si el admin ve 10 detalles al día → 5000 reads
extra. Con el pricing default, eso es 5k reads ≈ $0.002 — poco.

**Plan**:

- Agregar `ventaId` como field indexado + query `collectionGroup("items") where ventaId == X limit 1`.
- Requeriría un nuevo índice simple.
- Postpone hasta que sea problema medible.

### H3 — Admin ventas sin paginación

**Ubicación**: `admin-web/features/ventas-admin/useVentasAdmin.ts`.

**Descripción**: el hook devuelve máximo `limite: 500` (o 5000 en
reportes). Sin cursor pagination. Si un admin quiere ver el año completo
(~300 ventas × 360 días = 108k docs), no puede.

**Impacto**: bajo para negocios pequeños, bloqueador para grandes.

**Plan**: implementar cursor pagination con `startAfter(lastDoc)` + botón
"Cargar más" cuando la UI lo requiera.

### H6 — useMensajesAdmin race (resuelto)

**Ubicación**: `admin-web/features/mensajes-admin/useMensajesAdmin.ts`.

**Descripción**: `previos` se cargaba async con `.then()` pero el state
solo se actualizaba dentro del onSnapshot de hoy. Si hoy no cambiaba, los
previos no entraban al state.

**Estado**: **RESUELTO** — await previos ANTES de setup del onSnapshot.

### H7 — Layout chat admin (resuelto)

**Ubicación**: `admin-web/routes/mensajes/MensajesPage.tsx`.

**Descripción**: `height: calc(100vh - 3rem)` chocaba con el
`overflow-y-auto` del main del AppShell.

**Estado**: **RESUELTO** — usando `max-h: 65vh` + composer sticky bottom.

### H8 — Dashboard cortes no es realtime

**Ubicación**: `admin-web/features/cortes-admin/useCortesAdmin.ts`.

**Descripción**: `useCortesActivos` hace `getDocs` una vez en mount. Nuevo
corte iniciado no aparece hasta que el admin refresca.

**Impacto**: bajo. Los cortes cambian poco (1-2 por día por sucursal).

**Plan**: cambiar a `onSnapshot`. Trivial. Hazlo si alguien lo pide.

### Timestamp vs string type mismatch

**Ubicación**: `shared/src/schema.ts` — `Nodo.fechaRegistro`,
`Sucursal.fechaCreacion`, `Negocio.fechaCreacion`, etc.

**Descripción**: los types dicen `string` pero el servidor escribe
`admin.firestore.FieldValue.serverTimestamp()` que queda como
`Timestamp` de Firestore.

**Impacto**: al leer en cliente, `typeof fecha === "object"`, no string.
UI que asume string rompería.

**Estado actual**: el admin-web muestra `fecha_inicio`/`fecha_fin` sin
formateo especial, y los valores están en formato string ISO-MX
(escritos client-side). Los Timestamps del server solo afectan
`fechaRegistro`/`fechaCreacion` que se muestran raw (raramente se
renderizan).

**Plan**: hook de normalización `useDateField(value)` que acepta
`string | Timestamp | undefined` y retorna `Date | null`. Usar en todas
las UIs que renderen estos campos.

### SW precache oversize (nodo-web)

**Ubicación**: `nodo-web/vite.config.ts`.

**Descripción**: el Service Worker precachea 3.4 MB de assets estáticos,
incluyendo los chunks lazy de pdfmake (~1.2 MB) y zxing (~400 kB).

**Impacto**: first install PWA descarga 3.4 MB, aunque la mayoría no se use
inmediatamente.

**Plan**: agregar al `workbox.globIgnores` los chunks de pdfmake y zxing.
Se cargarán via network cuando el user abra el scanner o el ticket por
primera vez. Típico: pdfmake y zxing NO son críticos offline.

```ts
workbox: {
  globPatterns: ["**/*.{js,css,html,svg,webp,woff2}"],
  globIgnores: ["**/pdfmake-*.js", "**/vfs_fonts-*.js", "**/@zxing*"],
}
```

Reduce precache a ~900 kB. Trade-off: si el user está offline la primera
vez que abre el scanner/ticket, falla.

---

## Baja / notas

### B5 — abrirPDF memory leak menor

**Ubicación**: `nodo-web/src/features/ventas/ticketService.ts`.

**Descripción**: cuando el popup está bloqueado, se crea un `<a>` temporal
con `document.createElement` que no se remueve.

**Impacto**: leak de ~100 bytes por ticket cuando popup bloqueado. Aceptable.

### notificar_de_reibido — pase de lista no implementado

**Descripción**: el protocolo Android de "pase de lista" de mensajes usa
`notificar_de_reibido/{deviceId}.huella_mensaje` para trackear qué
dispositivo leyó hasta qué huella. No está implementado en la web.

**Impacto**: no hay tracking de "leído por X tablets". Chat funciona sin
esto.

**Plan**: implementar si/cuando el admin quiera saber qué dispositivos
leyeron qué.

### Abonos no crean venta

**Descripción**: al agregar un abono a un apartado, solo se actualiza el
array `abonos` del doc del apartado. NO se crea una venta en `ventas_n`
para ese abono. Decisión pragmática.

**Impacto**: los reportes de ventas no incluyen los abonos como ingreso.
Admin tiene que sumar manualmente (o implementar un reporte específico
de abonos).

**Plan**: decisión pendiente — ¿debe un abono aparecer en los reportes de
ventas del día? Si sí, crear también una venta virtual al agregar abono.

### FCM push no conectado en nodo-web

**Ubicación**: `functions/enviar` exists, pero el nodo-web no hace
`getToken(messaging)` ni se subscribe al topic.

**Impacto**: las notificaciones push desde admin nunca llegan a tablets.

**Plan**:

1. Agregar `firebase/messaging` al nodo-web.
2. `getToken()` tras first-run, guardar en `nodos_web_new_version/{nodoId}.fcmToken`.
3. Subscribirse al topic `negocio_{negocioId}_web` (requiere Cloud Function
   porque subscribe-to-topic solo se hace server-side con Admin SDK).
4. En admin-web, UI `/mensajes/push` para enviar notificaciones ad-hoc.

### C2 — ID secuencial de artículo con hueco

**Ubicación**: `admin-web/features/articulos/articuloService.siguienteId`.

**Descripción**: la transacción incrementa el contador ANTES de escribir el
artículo. Si la escritura del artículo falla después, el ID queda
consumido → hueco en la secuencia.

**Impacto**: ninguno funcional (la unicidad se preserva). Estético —
admins OCD podrían notar artículos con IDs no consecutivos.

**Plan**: ignorar. El costo de hacer la transacción cover ambas ops es
alto.

### C8 — Subvariaciones sin límite client-side

**Ubicación**: `admin-web/routes/articulos/ArticuloEditPage.tsx`.

**Descripción**: el array de subvariaciones no tiene tope en la UI. Si
agregas 100 con imagen cada una, el doc puede exceder el límite Firestore
de 1 MB por documento.

**Impacto**: muy raro en uso normal (típicamente 2-5 subvariaciones).

**Plan**: agregar un límite de 20 en UI con mensaje. Trivial.

### C12 — Admin lista sin paginación

**Ubicación**: `admin-web/routes/articulos/ArticulosPage.tsx`.

**Descripción**: la lista de artículos renderea TODOS. Si el catálogo
crece a 5000, la UI se pone lenta.

**Impacto**: baja para negocios pequeños.

**Plan**: virtual scrolling con `@tanstack/react-virtual` cuando sea
problema.

### E2 — useEquipo duplicado

**Ubicación**: `admin-web/features/equipo/useEquipo.ts` y
`nodo-web/src/features/equipo/useEquipo.ts` son casi idénticos.

**Plan**: consolidar al `shared/` package. Requiere poder importar React
hooks desde shared — check que el bundler lo maneje. Trivial si sí,
skip si no.

### G5 — useMensajes admin vs nodo duplicado

Misma situación que E2 — ambos hooks de mensajes comparten 90% de la
lógica.

---

## Ya resuelto

Lista de auditorías aplicadas exitosamente durante la implementación:

### Auditoría A (Fase 0-1)

- **A1 (CRÍTICO)**: rules con match inválido para mensajes. ✅
- **A2 (ALTO)**: nodos podían pisar datos de config del negocio. ✅
- **A3 (MEDIO)**: create de sucursales abierto. ✅
- **A4 (ALTO)**: rebind no revocaba authUid viejo. ✅
- **A5 (MEDIO)**: admin-web sin role guard. ✅
- **A6 (MEDIO)**: persistencia Storage no se solicitaba. ✅
- **A7-A9 (BAJO)**: polish menor. ✅

### Auditoría B (Fase 2)

- **B1 (CRÍTICO)**: corteService collectionGroup cross-negocio. ✅
- **B2 (ALTO)**: race mensaje primer del día. ✅
- **B3 (MEDIO)**: BarcodeScanner reinicia video stream. ✅
- **B4 (BAJO)**: índice huérfano. ✅

### Auditoría C (Fase 3)

- **C1 (BAJO)**: línea hidden rara. ✅
- **C4 (ALTO)**: flags por nodo en articulos_ac sin consumidor. ✅
- **C11 (CRÍTICO)**: useNegocio sin fallback para superadmin. ✅

### Auditoría D (Fase 3 2a pasada)

- **D1 (CRÍTICO)**: `ignoreUndefinedProperties` faltante. ✅
- **D2 (ALTO)**: form resetea durante edición con snapshot. ✅
- **D3 (ALTO)**: no se podía quitar imagen. ✅
- **D4 (MEDIO)**: AppShell sin nav móvil. ✅
- **D5 (NOTA)**: consistencia Firebase config. ✅

### Auditoría E (Fase 4)

- **E1 (ALTO)**: `setAdminFlag` con `deleteField`. ✅

### Auditoría F (Fase 4 2a pasada)

- **F1 (MEDIO)**: edit inline pisa valor remoto. ✅

### Auditoría G (Fase 5)

- **G1 (ALTO)**: índice compuesto para useCortesActivos. ✅

### Auditoría H (Fase 5 2a pasada)

- **H4 (MEDIO)**: sucursalId inicial async. ✅
- **H6 (MEDIO)**: race mensajes admin. ✅
- **H7 (MEDIO)**: layout chat. ✅

### Auditoría I (Fase 6)

- (Nada crítico — solo documentación de I1 y I2.)
