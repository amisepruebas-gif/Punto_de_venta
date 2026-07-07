# Sitios bloqueados temporalmente — cómo reactivar

Fecha del bloqueo: 2026-04-27

## Sitio bloqueado

- **`https://amise-admin.web.app`** (panel administrador completo)
  - Todas las rutas: `/`, `/login`, `/ventas`, `/articulos`, `/cortes`, `/ajustes`, etc.
  - Hosting target: `admin` en `firebase.json` → sirve `admin-web/dist`.

## Sitios NO bloqueados (siguen funcionando)

- `nodo-web` (hosting target `nodo`).
- Backend: Firestore, Cloud Functions, Storage. El bloqueo es sólo de UI; alguien con la API podría seguir leyendo/escribiendo datos.

## Cambios hechos en el código

Archivo: `admin-web/src/App.tsx`

1. Flag global al inicio del componente:

   ```ts
   const BLOQUEADO_TEMP: boolean = true;
   ```

   Cuando es `true`, `App()` regresa una pantalla "Sitio no disponible" antes de cualquier ruta o auth.

2. Ruta `/ventas` reemplazada con un bloque inline (redundante mientras el flag global esté activo):

   ```tsx
   <Route path="ventas" element={<div>...Ventas no disponible...</div>} />
   ```

   Imports eliminados: `VentasPage`, `PinAdminVentasGate`.

## Cómo reactivar

### Opción A — reactivar todo el panel pero dejar `/ventas` bloqueado

1. En `admin-web/src/App.tsx`, cambiar:

   ```ts
   const BLOQUEADO_TEMP: boolean = true;
   ```

   por:

   ```ts
   const BLOQUEADO_TEMP: boolean = false;
   ```

2. Redesplegar:

   ```bash
   cd admin-web
   npm run deploy
   ```

### Opción B — reactivar todo, incluyendo `/ventas`

1. Hacer lo de la Opción A.
2. Restaurar la ruta `/ventas` original. Reagregar imports en `App.tsx`:

   ```ts
   import { VentasPage } from "./routes/ventas/VentasPage";
   import { PinAdminVentasGate } from "./features/ventas-admin/PinAdminVentasGate";
   ```

   Y reemplazar el bloque de la ruta `ventas` por:

   ```tsx
   <Route
     path="ventas"
     element={
       <PinAdminVentasGate>
         <VentasPage />
       </PinAdminVentasGate>
     }
   />
   ```

3. Redesplegar:

   ```bash
   cd admin-web
   npm run deploy
   ```

### Opción C — revertir todo desde git

```bash
git checkout -- admin-web/src/App.tsx
cd admin-web
npm run deploy
```

(Verifica antes con `git diff admin-web/src/App.tsx` que no haya otros cambios mezclados.)
