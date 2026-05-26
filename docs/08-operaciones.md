# Operaciones (runbook)

> **Cuándo usar este doc**: tareas de día a día operando la plataforma ya
> en producción. Cada sección es un playbook autocontenido.

## Índice

1. [Alta de un nuevo nodo (tablet)](#alta-de-un-nuevo-nodo)
2. [Revocar un nodo perdido o robado](#revocar-un-nodo)
3. [Re-vincular un tablet que perdió caché](#re-vincular-un-tablet)
4. [Crear una sucursal nueva](#crear-una-sucursal-nueva)
5. [Agregar un vendedor al equipo](#agregar-un-vendedor-al-equipo)
6. [Crear un grupo de tallas](#crear-un-grupo-de-tallas)
7. [Editar un artículo](#editar-un-artículo)
8. [Consultar ventas de un día / rango](#consultar-ventas)
9. [Migrar datos legacy de Android](#migrar-datos-legacy)
10. [Ver logs de Cloud Functions](#ver-logs-de-cloud-functions)
11. [Ver uso de Firestore / costos](#ver-uso-de-firestore)
12. [Enviar notificación push al equipo](#enviar-notificación-push)

---

## Alta de un nuevo nodo

### Pre-requisito

Tener al menos una sucursal creada. Si es el primer nodo del negocio, se
creará la primera sucursal durante el first-run.

### Pasos

1. Entregar la tablet al responsable.
2. Abrir el navegador (Chrome o similar) y navegar a
   `https://amise-nodo.web.app` (o dominio custom).
3. Instalar como PWA (Chrome: ícono "Instalar" en barra de dirección).
4. Abrir la app.
5. Pantalla de first-run:
   - Si hay sucursales: elegir una.
   - Si no (o si quieres nueva): pulsar "+ Nueva sucursal" y rellenar
     (nombre, dirección, teléfono).
6. Rellenar "Nombre del nodo" (ej. "Caja 1") y "Quien registra" (nombre
   del responsable).
7. "Registrar nodo".

### Resultado

- Doc `nodos_web_new_version/{nodoId}` creado en Firestore.
- Anonymous auth user creado, persistente en IndexedDB.
- Tablet lista para vender.

Admin ve el nuevo nodo en `/nodos` del panel admin con su historial.

---

## Revocar un nodo

### Cuándo

- Tablet robada o perdida.
- Tablet dañada reemplazada por otra.
- Terminación de contrato de la sucursal.

### Pasos (desde admin-web)

1. Login en `https://amise-admin.web.app`.
2. Sidebar → "Nodos".
3. (Opcional) Filtrar por sucursal.
4. En la fila del nodo objetivo → botón "Revocar" (icono ban).
5. Confirmar en el diálogo.

### Efecto inmediato

- `nodo.estado = "revocado"` en Firestore.
- Refresh tokens del authUid revocados.
- authUid con claim `{role: "revocado"}`.
- Entry en `historial` registrada con el UID del admin que lo revocó.

### Efecto diferido (⚠️ hasta 1h)

Los ID tokens vigentes del tablet revocado siguen siendo válidos hasta su
expiración (max 1h). Durante esa ventana puede seguir escribiendo ventas.
Trazabilidad: las ventas post-revocación llevan el mismo `nodoId` → son
identificables con query.

Si necesitas cerrar inmediatamente: apagar físicamente el tablet, cerrar
Wi-Fi, o invalidar las rules cambiando el role del tablet (hacky).

---

## Re-vincular un tablet

### Escenario

El vendedor reporta que la tablet "arranca como primera vez" (pantalla de
first-run). Esto pasa cuando:

- El usuario limpió los datos del navegador.
- Cambió de navegador.
- Reinstaló la PWA.

El doc del nodo sigue existiendo en Firestore; hay que re-vincular.

### Pasos (desde el tablet)

1. En la pantalla de first-run, pulsar "Tablet recuperada — vincular a
   nodo existente".
2. Elegir la sucursal.
3. Lista de nodos activos — elegir el correcto (pregúntale al responsable
   cuál era su nombre de nodo).
4. Rellenar "Tu nombre (para el log)".
5. "Vincular".

### Resultado

- Se crea un authUid NUEVO para la tablet.
- El authUid anterior se borra de Firebase Auth (FIX A4).
- Se agrega una entry `historial[{tipo: "rebind", ...}]` al doc del nodo.
- Los claims son los mismos del nodo original → sigue teniendo permiso
  sobre su sucursal.

### Auditar rebinds sospechosos

Desde admin-web `/nodos` → click en "Historial" de un nodo → ver todas las
re-vinculaciones con fecha, user agent y quién las hizo.

---

## Crear una sucursal nueva

### Cuándo

El negocio abre una nueva sede física.

### Pasos

1. Admin-web → `/sucursales`.
2. Botón "+ Nueva sucursal".
3. Rellenar nombre, dirección, teléfono (opcional).
4. "Crear".

### Después

- Los tablets que harán first-run en la nueva sucursal ya verán esta
  opción en el selector.
- No necesitas crear nodos en anticipación — se crean via first-run.

### Desactivar (no borrar)

No existe un botón "borrar sucursal" (preserva integridad referencial con
ventas históricas). Si una sucursal ya no opera:

1. `/sucursales` → botón "Desactivar" en la tarjeta.
2. La sucursal queda oculta del selector de first-run del nodo.
3. Los nodos que ya estaban vinculados **siguen funcionando** (pueden
   cobrar). Si quieres bloquearlos, revoca los nodos.

---

## Agregar un vendedor al equipo

### Contexto

Los "vendedores" que aparecen como opción `enTurno` en cada venta NO son
users Firebase. Son entries de `datos_web_new_version/equipoDeTrabajo`.

### Pasos

1. Admin-web → `/equipo`.
2. Escribir nombre en el input → "Agregar".
3. (Opcional) Click en el toggle "Vendedor" → se convierte en "Admin"
   (flag informativo, no tiene efecto en permisos hoy).

### En los nodos

Los nodos tienen un `onSnapshot` al equipo, así que el nuevo vendedor
aparece automáticamente en el `SelectorVendedor` sin reload.

### Quitar del equipo

Botón basura en la fila. Confirma. Se remueve con `deleteField()` — no se
puede recuperar (las ventas viejas mantienen el nombre en `enTurno` como
string libre).

---

## Crear un grupo de tallas

### Pasos

1. Admin-web → `/tallas`.
2. Input "Nombre del grupo" (ej. "Camisetas") → "Crear grupo".
3. En el nuevo grupo, input de talla (ej. "S", "M", "L") → Enter.
4. Agrega las que necesites.

### Usar el grupo en un artículo

1. Ir a un artículo en edición.
2. Sección "Promociones y tallas" → campo "Grupo de tallas" → escribir el
   nombre del grupo.
3. Guardar.

En los nodos, al vender el artículo se mostrará un selector con las tallas
del grupo.

---

## Editar un artículo

### Pasos

1. Admin-web → `/articulos`.
2. Buscar (nombre, sigla, ID o referencia).
3. Click en la tarjeta → abre formulario.
4. Modificar campos.
5. "Guardar cambios".

### Cambios que quieres entender

- **Imagen**: click "Cambiar" para subir nueva (se comprime a WebP
  automáticamente). Click "Quitar" para borrar (la imagen anterior se
  borra de Storage best-effort).
- **Subvariaciones**: sección específica. Cada variante tiene nombre +
  imagen opcional.
- **Stock**: campo "Cantidad". Es stock único del negocio (no por
  sucursal) — decisión de diseño.

### Sync a los nodos

Al guardar, el servicio también actualiza `datos_web_new_version/articulos_ac.huella`.
Los nodos escuchan directamente la colección via `onSnapshot`, por lo que
detectan el cambio **sin necesidad del trigger** — pero escribir la huella
es barato y mantiene el contrato del schema.

---

## Consultar ventas

### Historial (rango)

1. `/ventas`.
2. Seleccionar rango: Hoy / 7 días / 30 días / Custom.
3. (Opcional) Filtrar por sucursal.
4. (Opcional) Filtrar por forma de pago.
5. La tabla muestra hasta 200 ventas (con indicador si hay más).

### Detalle de una venta específica

Click en "Ver" en cualquier fila → `/ventas/:id` con desglose completo.

### Buscar por ID específico

Si tienes el `ventaId`:

```
https://amise-admin.web.app/ventas/{ventaId}
```

Nota: la página busca entre las últimas 500 ventas. Si la venta es vieja
(antes de las 500 más recientes), no la encontrará. Workaround: filtrar
por fecha en `/ventas` para acotarla.

### KPIs rápidos del día

Dashboard principal (`/`) muestra ventas de hoy actualizadas en vivo
(cada vez que un nodo cobra, el KPI sube sin reload).

---

## Migrar datos legacy

### Pre-requisitos

- Tener al menos una sucursal creada en el namespace nuevo (para mapear
  las ventas/cortes/apartados legacy). Crear una "Sucursal Legacy" si se
  necesita.
- Ser superadmin.

### Pasos

1. Admin-web → `/ajustes/migracion`.
2. Seleccionar **sucursal destino** (donde se mapean ventas/cortes).
3. (Opcional) Elegir solo un tipo en el primer run.
4. **Dry-run** primero — reporta conteos sin escribir.
5. Revisar el summary. Si se ve sano → "Migrar ahora".
6. Confirmar en el diálogo.

### Resultado

- Docs copiados al namespace `_web_new_version` con field `_migradoEn`.
- Log del run en `datos_web_new_version/_migracionesLegacy` (visible en
  Firestore Console).
- Si hay errores → lista en la UI + en logs de la CF.

### Re-ejecutar

Es idempotente (usa `huella` como ID destino). Puedes correr varias veces
sin duplicar.

Excepción: ventas legacy sin `huella` pueden duplicarse en re-runs
(edge case I1 de deuda técnica). Aceptable si el dataset legacy es pequeño.

---

## Ver logs de Cloud Functions

### Tiempo real

```bash
firebase functions:log                       # todas, últimos 100
firebase functions:log --only registrarNodo  # filtrar
firebase functions:log -n 50                 # últimas 50
```

### En Firebase Console

https://console.firebase.google.com/project/amisetienda-c7eab/functions/logs

- Filtros por función, severidad, texto.
- Retención ~30 días.
- Click en un log entry para stack trace completo.

### Debugging

Las CFs escriben `console.log`/`console.error`/`console.warn` — aparecen en
los logs. Las excepciones `HttpsError` también se registran con el message.

---

## Ver uso de Firestore

Dashboard Firebase:
https://console.firebase.google.com/project/amisetienda-c7eab/firestore/usage

Métricas clave:

- **Document reads** / día — la mayor causa de costo.
- **Document writes** — ventas/cortes/mensajes (bajo volumen normal).
- **Storage** — total de docs almacenados.

Si las reads crecen:

- Verificar que `onSnapshot` tenga deps correctas (re-listeners).
- Considerar paginación en vistas admin.
- Revisar si hay `collectionGroup` queries que leen demasiado.

---

## Enviar notificación push

### Estado actual

La CF `enviar` publica a topic `negocio_{negocioId}_web`, pero **los nodos
aún no están subscritos al topic** (FCM setup incompleto en nodo-web —
ver deuda técnica). Por lo tanto, llamadas a `enviar` no llegan a ningún
dispositivo hoy.

### Cuando esté conectado (futuro)

El admin podría mandar un mensaje push a todos los tablets del negocio
desde una UI `/mensajes/push` (no implementada).

### Mientras tanto

Usa el chat `/mensajes`. Los tablets que tienen la app abierta ven los
mensajes en vivo. Los que están cerrados los verán al abrirla.
