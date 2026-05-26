# Amise Web — nodo + admin

Punto de venta (PWA tablet) + panel super-administrador (web PC/móvil) sobre
Firebase. Reemplaza dos apps Android legacy (`nodo_1`, `dispositivo_1`) con
soporte multi-sucursal/multi-nodo desde el día uno.

- **Proyecto Firebase**: `amisetienda-c7eab`
- **Sitios Hosting**: `amise-admin.web.app` + `amise-nodo.web.app`
- **Negocio default**: `amise`
- **Super admin inicial**: `jesuscentenoramirez@gmail.com`
- **Stack**: React 18 + TypeScript + Vite 5 + Tailwind 3 + Shadcn UI + Firebase SDK v10

---

## Estructura del repo

```
dispositivo_1/
├── README.md                   ← este doc
├── docs/                       ← documentación técnica
│   ├── 01-arquitectura.md
│   ├── 02-firestore-schema.md
│   ├── 03-cloud-functions.md
│   ├── 04-auth-y-roles.md
│   ├── 05-nodo-web.md
│   ├── 06-admin-web.md
│   ├── 07-deploy.md
│   ├── 08-operaciones.md
│   └── 09-deuda-tecnica.md
├── nodo-web/                   ← PWA tablet vendedor
├── admin-web/                  ← Panel super-admin
├── shared/                     ← Tipos TS + utilidades compartidas
├── functions/                  ← Cloud Functions (Node 20)
├── firestore.rules
├── firestore.indexes.json
├── storage.rules
├── firebase.json               ← multi-site hosting + functions + rules
├── .firebaserc                 ← targets amise-admin / amise-nodo
│
├── nodo_1/                     ← Android legacy (DEPRECATED, read-only fuente)
├── dispositivo_1/              ← Android legacy (DEPRECATED, read-only fuente)
├── MIGRACION_WEB_PLAN.md       ← plan de implementación (histórico)
└── MIGRACION_WEB_PREPLAN.md    ← análisis previo (histórico)
```

## Quickstart

### Pre-requisitos

- Node 20+
- Firebase CLI (`npm i -g firebase-tools`)
- Login: `firebase login`
- Acceso al proyecto `amisetienda-c7eab`

### Primera vez

```bash
# Instalar deps en cada subproyecto
(cd shared && echo "shared es source-only, sin install")
(cd functions && npm install)
(cd admin-web && npm install)
(cd nodo-web && npm install)

# Seed inicial: crea negocio "amise" + rol superadmin
# (primero crear el usuario manual en Firebase Console → Auth)
cd functions && npm run setup
```

### Dev local

```bash
# En terminales separadas:
cd admin-web && npm run dev   # → http://localhost:5174
cd nodo-web  && npm run dev   # → http://localhost:5173
```

### Build + deploy

Ver [`docs/07-deploy.md`](docs/07-deploy.md) para el runbook completo. En corto:

```bash
firebase deploy --only firestore:rules,storage,firestore:indexes,functions
(cd admin-web && npm run deploy)
(cd nodo-web  && npm run deploy)
```

---

## Rutas de documentación

| Doc | Cuándo leerlo |
|---|---|
| [`docs/01-arquitectura.md`](docs/01-arquitectura.md) | Entendimiento inicial del sistema — empieza aquí |
| [`docs/02-firestore-schema.md`](docs/02-firestore-schema.md) | Cuando necesites conocer la estructura exacta de los datos |
| [`docs/03-cloud-functions.md`](docs/03-cloud-functions.md) | Al tocar alguna Cloud Function o diagnosticar llamadas |
| [`docs/04-auth-y-roles.md`](docs/04-auth-y-roles.md) | Al trabajar con registro de usuarios/tablets, rules o custom claims |
| [`docs/05-nodo-web.md`](docs/05-nodo-web.md) | Para trabajar en la PWA del vendedor (tablet) |
| [`docs/06-admin-web.md`](docs/06-admin-web.md) | Para trabajar en el panel administrador |
| [`docs/07-deploy.md`](docs/07-deploy.md) | Para publicar a producción o entornos staging |
| [`docs/08-operaciones.md`](docs/08-operaciones.md) | Tareas de día a día: alta de nodos, revocaciones, migración |
| [`docs/09-deuda-tecnica.md`](docs/09-deuda-tecnica.md) | Al priorizar pulido post-MVP |

## Licencia y propiedad

Proyecto privado de Amise. No distribuible públicamente.
