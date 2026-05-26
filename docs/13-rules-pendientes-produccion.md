# 13 — Rules pendientes para producción

## Estado actual (DESARROLLO)

`firestore.rules` y `storage.rules` están **completamente abiertos**:

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

### Storage — endurecer cuando se vuelva a producción

Versión previa validaba imágenes:

```
function isAuthenticated()  { return request.auth != null; }
function isImage()          { return request.resource.contentType.matches('image/.*'); }
function under5MB()         { return request.resource.size < 5 * 1024 * 1024; }

match /b/{bucket}/o {
  match /media_web_new_version/articulos/{fileName} {
    allow read:   if isAuthenticated();
    allow write:  if isAuthenticated() && isImage() && under5MB();
    allow delete: if isAuthenticated();
  }
  match /mensajes_media/{negocioId}/{fileName} {
    allow read:   if isAuthenticated();
    allow write:  if isAuthenticated() && isImage() && under5MB();
    allow delete: if isAuthenticated();
  }
  match /media/articulos/{fileName} {  // legacy, read-only durante migración
    allow read:   if isAuthenticated();
    allow write:  if false;
    allow delete: if false;
  }
  match /{allPaths=**} {                // fail-closed por default
    allow read, write: if false;
  }
}
```

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
- [ ] Restaurar reglas Storage con isAuthenticated + isImage + under5MB.
- [ ] Configurar cuota dura del Gemini API en Google Cloud Console.
- [ ] Verificar que `useVentasAdmin` (admin-web) y `useVentasMes` (nodo-web) siguen funcionando — son los que dependen de la rule de collection group `items`.
- [ ] Probar un flujo end-to-end: venta normal, venta desde apartado, cancelación de apartado, ingreso de mercancía.
- [ ] Probar lectura cross-sucursal — un nodo de sucursal A no debe ver datos de sucursal B.
- [ ] Probar que un usuario sin claims (cuenta nueva) no puede leer ningún dato del negocio.
