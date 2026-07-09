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
