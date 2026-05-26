# Deploy a producción

> **Cuándo usar este doc**: para publicar por primera vez o hacer un deploy
> subsecuente.

## Índice

1. [Prerequisitos](#prerequisitos)
2. [Setup inicial (una sola vez)](#setup-inicial-una-sola-vez)
3. [Deploy de Firestore rules + indexes](#deploy-de-firestore-rules--indexes)
4. [Deploy de Cloud Functions](#deploy-de-cloud-functions)
5. [Deploy de Hosting (admin + nodo)](#deploy-de-hosting)
6. [Dominios custom](#dominios-custom)
7. [Orden recomendado de deploy](#orden-recomendado)
8. [Rollback](#rollback)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisitos

- **Node 20** (para `functions/`).
- **Firebase CLI**:
  ```bash
  npm install -g firebase-tools
  firebase login
  ```
- **Acceso al proyecto** `amisetienda-c7eab` (ser owner/editor).
- `cd dispositivo_1/` (la raíz del repo) para todos los comandos.

Verifica:

```bash
firebase projects:list       # debe aparecer amisetienda-c7eab
firebase use amisetienda-c7eab
```

---

## Setup inicial (una sola vez)

### 1. Crear el super-admin en Firebase Auth

Manual, **vía Firebase Console**:

1. Abrir https://console.firebase.google.com/project/amisetienda-c7eab/authentication/users
2. "Add user"
3. Email: `jesuscentenoramirez@gmail.com`
4. Password: temporal (cambiará en primer login)
5. Crear.

### 2. Ejecutar el seed inicial

```bash
cd functions
npm install
npm run setup
```

El script `setup-initial.js` hace:

1. OAuth via `firebase-tools` refresh token (no requiere service account).
2. Lookup del user recién creado por email.
3. Asigna custom claim `{ role: "superadmin" }` via Identity Toolkit REST API.
4. Crea doc `usuarios/{uid}`.
5. Crea `planes/basico`.
6. Crea `negocios_web_new_version/amise`.
7. Crea `datos_web_new_version/_init` placeholder.

Output esperado:

```
==============================
  SETUP COMPLETO
==============================
Super admin: jesuscentenoramirez@gmail.com
UID:         ykRmWwwwYdVnuvhqYjYRfSJ4Vv02
Negocio ID:  amise
```

### 3. Crear los sitios Hosting (si no existen)

Los sitios Hosting son separados del "default" del proyecto. Crear ambos:

```bash
firebase hosting:sites:create amise-admin
firebase hosting:sites:create amise-nodo
```

Si uno de los nombres está tomado, elige otro (ej. `amise-admin-2`) y
**actualiza `.firebaserc`**:

```json
{
  "projects": { "default": "amisetienda-c7eab" },
  "targets": {
    "amisetienda-c7eab": {
      "hosting": {
        "admin": ["amise-admin"],
        "nodo": ["amise-nodo"]
      }
    }
  }
}
```

Verificar:

```bash
firebase hosting:sites:list
```

### 4. Verificar targets

```bash
firebase target:apply hosting admin amise-admin
firebase target:apply hosting nodo amise-nodo
```

(Esto solo es necesario si `.firebaserc` no los tiene — ya los tiene, pero
este comando es idempotente por si acaso).

---

## Deploy de Firestore rules + indexes

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

Los archivos que se suben:

- `firestore.rules`
- `firestore.indexes.json`
- `storage.rules`

**Importante**: los índices pueden tardar **varios minutos** en construirse
(especialmente para colectionGroup). Durante la construcción, las queries
que los necesitan fallan con error "requires an index". Espera a que el
Firebase Console los marque como "Enabled".

Check: https://console.firebase.google.com/project/amisetienda-c7eab/firestore/indexes

---

## Deploy de Cloud Functions

```bash
firebase deploy --only functions
```

Primera vez: instalará APIs necesarias (Cloud Build, Artifact Registry),
puede tardar 5-10 min.

Subsequent: 1-2 min si solo hay cambios menores.

Deploys selectivos (más rápido):

```bash
firebase deploy --only functions:registrarNodo
firebase deploy --only functions:migrarDataLegacy,functions:reconciliarVentasOffline
```

### Verificar funciones desplegadas

```bash
firebase functions:list
```

O en Console:
https://console.firebase.google.com/project/amisetienda-c7eab/functions/list

---

## Deploy de Hosting

### admin-web

```bash
cd admin-web
npm run build      # tsc -b && vite build
npm run deploy     # firebase deploy --only hosting:admin
```

El `npm run deploy` corre `npm run build && firebase deploy --only hosting:admin`.

Output: URL del deploy (ej. `https://amise-admin.web.app`).

### nodo-web

```bash
cd nodo-web
npm run build
npm run deploy
```

Output: `https://amise-nodo.web.app`.

### Ambos a la vez (desde raíz)

```bash
firebase deploy --only hosting
```

---

## Dominios custom

Cuando tengas dominios reales (ej. `admin.amise.com`, `nodo.amise.com`):

1. En Firebase Console → Hosting → sitio `amise-admin` → **Add custom
   domain** → sigue las instrucciones DNS.
2. Esperar verificación (puede tardar 1-24h según propagación DNS).
3. **CRÍTICO**: agregar los dominios custom a Firebase Auth **Authorized
   domains**:
   - https://console.firebase.google.com/project/amisetienda-c7eab/authentication/settings
   - "Add domain" → `admin.amise.com` y `nodo.amise.com`.
   - Sin esto, el `signInWithEmailAndPassword` / `signInWithCustomToken`
     fallará con `auth/unauthorized-domain`.
4. Actualizar el `firebaseConfig.authDomain` si quieres — aunque no es
   estrictamente necesario (el `authDomain` por default
   `amisetienda-c7eab.firebaseapp.com` sigue funcionando).

---

## Orden recomendado

Para un deploy completo (cambios en todo):

```bash
# 1. Rules + indexes (esperar que índices construyan si son nuevos)
firebase deploy --only firestore:rules,firestore:indexes,storage

# 2. Functions
firebase deploy --only functions

# 3. Hosting (después de que functions respondan)
firebase deploy --only hosting
```

Para cambios parciales:

- **Solo UI nodo-web** → solo `hosting:nodo`.
- **Solo UI admin-web** → solo `hosting:admin`.
- **Solo backend rules** → solo `firestore:rules` (rápido, no afecta UIs).
- **Cambio en una función** → solo `functions:NOMBRE`.

---

## Rollback

### Rollback de Hosting

Firebase Hosting mantiene historial de releases. Rollback vía Console:

1. Console → Hosting → seleccionar sitio.
2. En la lista de releases → click "⋮" en el release objetivo → "Rollback".

O CLI (menos flexible):

```bash
firebase hosting:clone SOURCE_SITE:SOURCE_VERSION TARGET_SITE:TARGET_CHANNEL
```

### Rollback de Functions

No hay "rollback nativo". Alternativas:

- Revertir el commit en git + re-deploy.
- Deploy de una versión anterior del branch: `git checkout <sha> && firebase deploy --only functions`.

### Rollback de Firestore rules

```bash
# Las rules anteriores quedan en la history de Firestore. Deploy la versión git anterior.
git show HEAD~1:firestore.rules > firestore.rules
firebase deploy --only firestore:rules
```

---

## Troubleshooting

### "Error: HTTP Error: 403, Access ..."

Te falta permiso en el proyecto. Pide al owner que te agregue como
`Editor` o `Firebase Admin`.

### "Failed to get Firebase project amisetienda-c7eab"

El proyecto no está seleccionado:

```bash
firebase use amisetienda-c7eab
```

### Functions deploy falla con "Cloud Build API not enabled"

Primera vez. Ir a:
https://console.developers.google.com/apis/api/cloudbuild.googleapis.com/overview?project=amisetienda-c7eab
y habilitar. Espera 1-2 min, reintenta.

### Queries fallan con "The query requires an index"

El índice no se ha construido aún. El error incluye un link para crearlo
manualmente. Alternativamente, verifica que `firestore.indexes.json` tenga
el índice y re-deploy:

```bash
firebase deploy --only firestore:indexes
```

Luego espera a que Console muestre "Enabled".

### Hosting deploy sube archivos viejos

El build no se corrió. Asegúrate de `npm run build` antes de `firebase
deploy`. El script `npm run deploy` lo hace automáticamente.

### "auth/unauthorized-domain" al loguear

El dominio donde está servida la app no está en Firebase Auth → Authorized
domains. Agregar en Console. Para `*.web.app` del proyecto, ya está
auto-authorized.

### Service Worker sirve versión vieja tras deploy

El SW puede tardar hasta 24h en actualizarse si el user no cierra el
browser. Headers del `firebase.json` ya fuerzan `no-cache` en `sw.js` y
`registerSW.js`. Si persiste:

1. Abrir DevTools → Application → Service Workers → "Unregister" + reload.
2. O en producción, usar `registerType: "autoUpdate"` del vite-plugin-pwa
   (ya configurado).

### Functions timeout (9 min exceeded) durante migración

Si `migrarDataLegacy` tiene muchos datos, puede exceder 540s. Solución:
correr en modo `solo: "articulos"` primero, luego `solo: "ventas"`, etc.

### Emergencia: bloquear todo

```bash
# Hacer las rules totalmente restrictivas
echo 'rules_version="2"; service cloud.firestore { match /{d}/{p=**} { allow read,write: if false; } }' > firestore.rules
firebase deploy --only firestore:rules
```

Luego reviértir cuando se resuelva.
