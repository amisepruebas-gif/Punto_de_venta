# 13 — Rules pendientes para producción

## Estado actual (DESARROLLO)

`firestore.rules` está **completamente abierto** (`storage.rules` ya no: está cerrado por ruta
desde el 4-nov-2026; ver la sección Storage):

```
allow read, write: if true;
```

Esto se hizo para no romper apps legacy que comparten el mismo proyecto Firebase y usan colecciones de raíz (`ventas_n`, `mensajes_n`, `datos`, `corte_1`, `articulos_n`, `apartados`, `/negocios/{nid}/…`) con un modelo de autenticación distinto al del namespace nuevo `_web_new_version`.

⚠️ **Mientras estas reglas estén abiertas, cualquier persona en internet con la URL del proyecto puede leer y escribir en toda la base de datos.** Solo es aceptable durante el desarrollo bajo dominios de prueba (`amise-nodo.web.app`, `amise-admin.web.app`, `localhost`).

## Plan de hardening — reaplicar antes de producción

El trabajo de Fases 1, 2 y 3 ya fue probado y funcionaba en una versión anterior de las reglas. Cuando se quite la dependencia de las apps legacy (o cuando estas se migren al namespace nuevo), restaurar lo siguiente.

### Fase 1 — Aislamiento de sucursales

- En `negocios_web_new_version/{nid}/sucursales_data_web_new_version/{sid}/{subcol=**}`:
  - `allow read: if isSuperAdmin() || isBusinessMember(nid) || isNodo(nid, sid);`
  - `allow write: if isSuperAdmin() || isBusinessAdmin(nid) || isNodo(nid, sid);`
  
  Esto cierra el riesgo de que un nodo de sucursal A lea ventas / cortes / apartados de sucursal B del mismo negocio. (Antes la rule usaba `isAnyNodo(nid)` que solo validaba el negocio, no la sucursal).

### Fase 2 — Collection group `items` (necesario para `useVentasAdmin` y `useVentasMes`)

```
match /{path=**}/items/{itemId} {
  allow read: if isSuperAdmin()
              || (
                request.auth != null
                && resource != null
                && request.auth.token.negocioId == resource.data.negocioId
                && (
                  request.auth.token.role == 'admin'
                  || request.auth.token.role == 'superadmin'
                  || (
                    request.auth.token.role == 'nodo'
                    && request.auth.token.sucursalId == resource.data.sucursalId
                  )
                )
              );
  // Las escrituras NO se definen aquí (allow write: omitido).
  // Pasan vía la rule nested de sucursales_data_.../{subcol=**}.
}
```

Esta es la rule a nivel de collection group que Firestore exige para autorizar `collectionGroup("items")` en admin-web. Sin ella, las consultas de reportes fallan con `Missing or insufficient permissions`.

⚠️ Esta rule fue la que **causó conflicto con las apps legacy** (Android viejo) en el ciclo de desarrollo. Antes de reactivarla, confirmar que las apps legacy ya no usan `collectionGroup("items")` o que están migradas al namespace nuevo.

### Fase 3A — Decremento de stock al vender (nodos pueden hacer update parcial de artículos)

```
match /negocios_web_new_version/{nid}/articulos_n_web_new_version/{artId} {
  allow read: if isSuperAdmin() || isBusinessMember(nid) || isAnyNodo(nid);
  allow create, delete: if isSuperAdmin() || isBusinessAdmin(nid);
  allow update: if isSuperAdmin()
                || isBusinessAdmin(nid)
                || (isAnyNodo(nid)
                    && request.resource.data.diff(resource.data).affectedKeys()
                       .hasOnly(['cantidad', 'subvariaciones']));
}
```

Permite a los nodos modificar **solo** los campos `cantidad` y `subvariaciones` del artículo durante la transacción de venta o apartado. Cualquier otro campo (precio, nombre, imagen, etc.) sigue bloqueado a admin. Sin esta rule, el decremento de stock atómico falla porque las rules previas bloqueaban todo `write` desde rol `nodo`.

### Fase 3B — `mercancia-web` (acceso por PIN, scope sucursal)

App nueva (Fase 6 del producto, 2026-04-28) que permite a personal operativo
hacer CRUD de mercancía sólo con un PIN de 5 dígitos. El admin gestiona la
lista de usuarios desde `admin-web/usuarios-mercancia`.

Mientras las reglas estén abiertas, la app valida el PIN client-side leyendo
`negocios_web_new_version/{nid}/sucursales_data_web_new_version/{sid}/usuariosMercancia_web_new_version/{uid}`.
**Esto NO es seguridad real** — solo gating de UX.

Plan al cerrar reglas:

1. **Cloud Function `loginMercanciaConPin`** que recibe `{ negocioId, sucursalId, pin }`,
   busca el doc por `pinHash`, verifica `habilitado === true` y devuelve un
   custom token de Firebase Auth con claims:

   ```
   { role: "mercancia", negocioId, sucursalId, mercanciaUid }
   ```

2. **Reglas Firestore para la colección de usuarios**:

   ```
   match /negocios_web_new_version/{nid}/sucursales_data_web_new_version/{sid}/usuariosMercancia_web_new_version/{uid} {
     // Solo el admin del negocio (no la propia mercancia user) gestiona la lista.
     allow read, write: if isSuperAdmin() || isBusinessAdmin(nid);
   }
   ```

   El cliente de `mercancia-web` ya no lee directo: pasa por la CF.

3. **Reglas para artículos / categorías / etc. con rol `mercancia`**:

   ```
   match /negocios_web_new_version/{nid}/articulos_n_web_new_version/{artId} {
     allow read, create, update, delete:
       if isSuperAdmin()
       || isBusinessAdmin(nid)
       || (request.auth.token.role == 'mercancia'
           && request.auth.token.negocioId == nid);
   }
   ```

   Mismo patrón para `categorias_web_new_version`, `subcategorias_web_new_version`,
   doc `tallas` en `datos_web_new_version`.

4. **PIN único por sucursal** se valida en CF antes de crear/actualizar (no en
   reglas; las reglas no pueden hacer queries cruzadas).

5. **Rate limit en la CF** para evitar fuerza bruta (5 dígitos = 100k combinaciones,
   trivial sin rate limit). Usar `firebase-functions/v2` con bloqueo después de 5
   intentos en 1 min por IP.

### Storage — reglas cerradas (publicadas el 4 y 5-nov-2026)

- **Publicado (5-nov-2026 11:39, ruleset `ef9fdcd5-0092-4f83-b4b7-0016cbd07024`)**: cierre de
  `chat_media/` (el chat de escritorio viejo ya no se usa). Pruebas: 1033/1033; contra el anterior
  cambian 31 casos, todos de `chat_media/` y todos "ahora NO, antes sí".
  - Verificado sin sesión: leer, subir, listar y borrar en `chat_media/` → 403.
  - No se pudo comprobar lo que debe dar 200: ese día la cuenta de facturación del proyecto estaba
    suspendida por falta de pago y Storage respondía 402 a todo (y las functions, 503).
- **Anterior (4-nov-2026 22:52, ruleset `a9d01545-ad91-4db7-8967-faddefcb0040`)**: las mismas reglas
  con `chat_media/` abierto para subir sin sesión. Probadas con `rules-test/storage.test.mjs`
  (1034/1034); contra las de antes fallaban 751 casos, todos "ahora NO, antes sí".
  - Verificado en producción sin sesión (13/13): leer imágenes de artículos, carpetas viejas y el
    chat de escritorio, sí; leer el chat nuevo, listar, subir y borrar, no. Las URLs con token
    siguen sirviendo.
  - Probado con sesión el mismo día: admin-web, mercancia-web y el chat de nodo-web suben bien.
- **Antes de eso (4-nov 18:24, ruleset `6418349f-b2f3-4861-afff-3e3467eb3f7e`)**: todo abierto,
  salvo borrar imágenes de artículos (solo staff).

Quién escribe hoy (código revisado y listado del bucket de producción, 4-nov-2026):

| Ruta | Quién | Sesión | Qué hace |
|---|---|---|---|
| `media_web_new_version/articulos/{id}.webp` y `{id}_{codigo}.webp` | admin-web, mercancia-web | admin/superadmin; mercancía (PIN → token con `role`) | sube, reemplaza, borra, pide la URL |
| `chat_media_web_new_version/{negocio}/{chat}/{huella}.webp` | nodo-web (chat de su nodo), admin-web (grupos y directos) | nodo, admin, superadmin | sube y pide la URL |
| `media/articulos/{id}.{ext}` | GOMU web (`amisetienda-c7eab.web.app`) y chat de escritorio v1.6.2 | GOMU web: Google; escritorio: ninguna | sube y borra; hoy vacía (0 archivos) |
| `chat_media/{chat}/{archivo}` | chat de escritorio GOMU v1.6.2 (Electron), ya no se usa | **ninguna** | subía cualquier archivo y pedía la URL; último: 30-abr-2026 |
| `mensajes_media/`, carpetas viejas con ID, `fotos_articulos/`, `contnet_init_index/`, `web_index_y_vinculo/` | nadie hoy (apps viejas, 2020–2025) | — | solo se leen por URL |
| cualquiera | functions (`migrarSubvariacionesLegacy`) y `tools/recomprimir-imagenes` | Admin SDK | no pasan por reglas |

La tienda amise.mx (otro proyecto) solo muestra URLs con token, que no pasan por reglas.
Ninguna app lista archivos. En Storage, subir encima de un archivo también es `create`
(`update` es solo metadatos).

Qué dejan las reglas nuevas:
- **Artículos** (las dos rutas): leer por nombre, cualquiera. Subir, reemplazar, borrar y
  listar: solo staff (admin, superadmin, mercancía), solo imágenes de menos de 5 MB.
- **Chat nuevo**: solo los del negocio del token (`negocioId`): admin, nodo y colaborador; el
  superadmin, todos. Solo imágenes de menos de 5 MB. Borrar: el admin del negocio.
- **Chat de escritorio viejo** (`chat_media/`): cerrado. Nadie sube, lee por SDK, lista ni
  borra; sus archivos solo se ven con su URL con token.
- **Todo lo demás**: nadie sube, reemplaza, borra ni lista. Leer por nombre sigue como hoy,
  menos en los chats.

Pendiente:
- Cuando vuelva la facturación: comprobar sin sesión que leer una imagen de artículo y una
  carpeta vieja por nombre da 200, y que las apps suben imágenes.
- GOMU de escritorio v2 (en desarrollo) todavía sube a `chat_media/`: al terminarlo debe subir al
  chat nuevo (`chat_media_web_new_version/...`), como dice `docs/17-fase-G-electron-gomu-chat.md`.
- Publicar reglas de Storage solo desde main o desde una rama que las traiga (si no, se revierten).

## Riesgos abiertos del set de fases (de la auditoría)

Cuando se cierren las reglas, recuerda que del audit original quedan riesgos pendientes que NO se cubren con reglas — viven en código:

- **Sin rate limiting / quota dura** en la Cloud Function `quitarFondoImagen` (Gemini). En la consola de Google Cloud → APIs → Quotas se puede poner un cap diario para mitigar abuso.
- **Sin tipo de cambio dinámico** en `costosNanobanana.ts` — usa fallback hardcoded `19`. Considerar leer de FX API o de un campo en Ajustes.

## Helpers que estaban en las rules (preservar al restaurar)

```
function isAuthenticated() { return request.auth != null; }
function isSuperAdmin()    { return isAuthenticated() && request.auth.token.role == 'superadmin'; }
function isBusinessMember(nid) { return isAuthenticated() && request.auth.token.negocioId == nid; }
function isBusinessAdmin(nid)  {
  return isBusinessMember(nid)
    && (request.auth.token.role == 'admin' || request.auth.token.role == 'superadmin');
}
function isNodo(nid, sid) {
  return isAuthenticated()
    && request.auth.token.role == 'nodo'
    && request.auth.token.negocioId == nid
    && request.auth.token.sucursalId == sid;
}
function isAnyNodo(nid) {
  return isAuthenticated()
    && request.auth.token.role == 'nodo'
    && request.auth.token.negocioId == nid;
}
```

## Checklist antes de pasar a producción

- [ ] Confirmar que apps legacy se migraron al namespace `_web_new_version` o que ya no se usan.
- [ ] Restaurar reglas Firestore con Fases 1, 2, 3A.
- [x] Reglas de Storage cerradas por ruta, publicadas el 4-nov-2026; cierre de `chat_media/` el 5-nov (sección Storage).
- [ ] Configurar cuota dura del Gemini API en Google Cloud Console.
- [ ] Verificar que `useVentasAdmin` (admin-web) y `useVentasMes` (nodo-web) siguen funcionando — son los que dependen de la rule de collection group `items`.
- [ ] Probar un flujo end-to-end: venta normal, venta desde apartado, cancelación de apartado, ingreso de mercancía.
- [ ] Probar lectura cross-sucursal — un nodo de sucursal A no debe ver datos de sucursal B.
- [ ] Probar que un usuario sin claims (cuenta nueva) no puede leer ningún dato del negocio.
