# admin-web

Panel super-admin Amise — CRUD artículos, ventas, cortes, reportes.

## Desarrollo

```bash
npm install
npm run dev
```

Abre http://localhost:5174

## Build y deploy

```bash
npm run build
npm run deploy     # firebase deploy --only hosting:admin
```

## Stack

- React 18 + TypeScript + Vite 5
- Tailwind 3 + Shadcn UI (Radix)
- TanStack Query + Zustand
- Firebase SDK v10 (Auth + Firestore + Storage + Functions)
- React Router v6

## Estructura

```
src/
├── main.tsx            entry
├── App.tsx             router + auth guard
├── routes/             páginas
├── features/           lógica por dominio (Fases 3-5)
├── components/ui/      shadcn primitives
├── hooks/              useAuth, etc.
├── firebase/           config + wrappers
├── lib/                utils
└── styles/             globals Tailwind
```

Los tipos y constantes de colecciones vienen de `@shared` (carpeta `../shared`).
