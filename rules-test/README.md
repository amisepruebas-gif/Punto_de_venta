# rules-test — pruebas de las reglas Firestore (emulador real)

Valida `../firestore.rules.candidata` contra el emulador de Firestore con TODOS los roles
reales (nodo, admin, mercancia, **superadmin sin negocioId**, colaborador, google-sin-claims, anon).

## Correr
```
npm install                 # instala @firebase/rules-unit-testing + firebase (una vez)
npx firebase emulators:exec --project demo-test --only firestore "node test.mjs"
```
Requiere Java (para el emulador) y firebase-tools. Debe imprimir `OK: N/N reglas verificadas`.

## Qué cubre (ver `test.mjs`)
- Árbol moderno (`negocios_web_new_version/**` + `system`) CERRADO al anónimo.
- El catch-all de raíz NO filtra al árbol moderno.
- **Superadmin sin negocioId = admin global** (fix del incidente, docs/auditoria 09).
- Raíz legacy ABIERTA como hoy (GOMU chat Electron + apps nativas no se rompen; docs/10).
- `system/auth_kick_switch` con read público (se lee pre-login en admin-web) y write bloqueado.

El archivo `test.mjs` lee la candidata por ruta ABSOLUTA; ajústala si mueves el repo.

## Storage (`storage.test.mjs`)

Valida `../storage.rules` contra el emulador de Storage. Se corre desde la **raíz** del repo
(usa el `firebase.json` de la raíz):
```
npx firebase emulators:exec --project demo-test --only storage "node rules-test/storage.test.mjs"
```
Debe imprimir `OK: N/N casos` (~30 s). Prueba cada rol real (anónimo, sin claims, revocado,
vendedor, nodo, colaborador, mercancía, admin, superadmin, y nodo/admin de otro negocio) contra
cada ruta del bucket y cada operación: leer, listar, subir, subir encima, cambiar metadatos y
borrar. Además el tipo y tamaño de lo que se sube y el flujo real de cada app (subir y pedir la URL).

- `REGLAS=<archivo>` prueba otra versión de las reglas. Los casos esperan lo que hacen las de esta
  rama, así que con otras reglas (p. ej. `git show main:storage.rules`) los que fallan son
  justo lo que cambia.
- `DETALLE=1` muestra el error de cada caso que falla.
- Los casos van uno por uno a propósito: en paralelo, el emulador pierde respuestas y se cuelga.
- En Storage, subir encima de un archivo también es `create`; `update` es solo metadatos.
