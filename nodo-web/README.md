# nodo-web

PWA para tablets — punto de venta Amise. Registra ventas, cortes de caja y
mensajes. Una tablet se registra una sola vez y queda vinculada a una sucursal.

## Desarrollo

```bash
npm install
npm run dev
```

Abre http://localhost:5173 (desde la tablet en la misma red, usa la IP del PC).

## Build y deploy

```bash
npm run build
npm run deploy   # firebase deploy --only hosting:nodo
```

## Stack

- React 18 + TypeScript + Vite 5
- Tailwind 3 + Shadcn UI (touch-friendly: botones h-12, inputs 16px sin zoom)
- Firebase SDK v10 + Firestore persistente (IndexedDB)
- vite-plugin-pwa (Workbox con denylist de Firestore para no romper WebChannel)
- @zxing/browser para escaneo de códigos de barras
- pdfmake para tickets

## Identidad del nodo

- `localStorage.amise_nodo_session` guarda `{ nodoId, sucursalId, negocioId, nombreNodo }`.
- Firebase Auth Anonymous persiste entre sesiones mientras el caché exista.
- Al perder caché → selector de sucursal + rebind a nodo existente (se log en `historial[]`).

## Iconos PWA

Reemplazar `public/icons/icon-{192,512,512-maskable}.png` con branding real.
