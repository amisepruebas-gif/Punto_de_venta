# admin-web

> **Cuándo usar este doc**: para trabajar en el panel administrador.
> Cubre las 13 rutas + features destacadas.

## Índice

1. [Estructura del paquete](#estructura-del-paquete)
2. [AppShell: sidebar + drawer móvil](#appshell)
3. [Rutas y features](#rutas-y-features)
4. [useNegocio + multi-tenant](#usenegocio)
5. [Catálogo de artículos (Fase 3)](#catálogo-de-artículos)
6. [Queries admin: collectionGroup](#queries-admin-collectiongroup)
7. [Dashboard en vivo](#dashboard-en-vivo)
8. [Migración legacy UI](#migración-legacy-ui)

---

## Estructura del paquete

```
admin-web/
├── src/
│   ├── main.tsx                    QueryClient + Router + StrictMode
│   ├── App.tsx                     Login guard + role guard + routing
│   ├── firebase/
│   │   ├── config.ts               ignoreUndefinedProperties + persistent cache
│   │   └── callables.ts            wrappers tipados de CFs
│   ├── hooks/
│   │   ├── useAuth.ts              onAuthStateChanged + claims
│   │   └── useNegocio.ts           doc del negocio + fallback "amise"
│   ├── components/
│   │   ├── AppShell.tsx            sidebar (desktop) + drawer (mobile)
│   │   └── ui/                     shadcn: button, input, label, textarea, card, checkbox
│   ├── routes/
│   │   ├── Login.tsx
│   │   ├── Dashboard.tsx           KPIs en vivo
│   │   ├── articulos/
│   │   │   ├── ArticulosPage.tsx
│   │   │   └── ArticuloEditPage.tsx
│   │   ├── sucursales/SucursalesPage.tsx
│   │   ├── nodos/NodosPage.tsx
│   │   ├── equipo/EquipoPage.tsx
│   │   ├── tallas/TallasPage.tsx
│   │   ├── ventas/
│   │   │   ├── VentasPage.tsx
│   │   │   └── VentaDetailPage.tsx
│   │   ├── cortes/CortesPage.tsx
│   │   ├── apartados/ApartadosPage.tsx
│   │   ├── reportes/
│   │   │   ├── MasVendidosPage.tsx
│   │   │   └── BuscarPorArticuloPage.tsx
│   │   ├── mensajes/MensajesPage.tsx
│   │   └── ajustes/MigracionPage.tsx
│   ├── features/
│   │   ├── articulos/
│   │   │   ├── articuloService.ts        CRUD + contador atómico + sync huella
│   │   │   ├── useArticulos.ts           onSnapshot
│   │   │   ├── ImageUpload.tsx           preview + WebP compression
│   │   │   └── SubvariacionesEditor.tsx  array editor con imágenes
│   │   ├── sucursales/
│   │   │   ├── sucursalService.ts
│   │   │   └── useSucursales.ts
│   │   ├── nodos/useNodos.ts
│   │   ├── equipo/
│   │   │   ├── equipoService.ts          setAdminFlag con deleteField
│   │   │   └── useEquipo.ts
│   │   ├── tallas/
│   │   │   ├── tallasService.ts
│   │   │   └── useTallas.ts
│   │   ├── ventas-admin/useVentasAdmin.ts
│   │   ├── cortes-admin/useCortesAdmin.ts
│   │   ├── apartados-admin/useApartadosAdmin.ts
│   │   └── mensajes-admin/
│   │       ├── mensajeAdminService.ts
│   │       └── useMensajesAdmin.ts
│   ├── lib/
│   │   ├── utils.ts                cn()
│   │   └── image.ts                compressToWebP
│   └── styles/globals.css
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json                   paths @/*, @shared/*
└── firebase.json                   hosting target "admin"
```

---

## AppShell

`src/components/AppShell.tsx` — layout compartido con `<Outlet />`.

### Desktop (>= md)

Sidebar de 240px a la izquierda con:

- Logo/nombre del negocio
- Nav links (13 activos + 1 "Próx.")
- Footer con email + role + botón "Cerrar sesión"

### Mobile (< md)

Topbar de 48px con:

- Botón hamburger (abre drawer full-height con mismos items)
- Título del negocio
- (spacer)

El drawer se cierra automáticamente al navegar (`useEffect([loc.pathname])`).

### Items del NAV

```tsx
[
  { to: "/",                         label: "Dashboard",     icon: LayoutDashboard },
  { to: "/articulos",                label: "Artículos",     icon: Package },
  { to: "/ventas",                   label: "Ventas",        icon: ShoppingBag },
  { to: "/cortes",                   label: "Cortes",        icon: ScrollText },
  { to: "/apartados",                label: "Apartados",     icon: Bookmark },
  { to: "/reportes/mas-vendidos",    label: "Más vendidos",  icon: BarChart3 },
  { to: "/reportes/articulo",        label: "Por artículo",  icon: Package },
  { to: "/mensajes",                 label: "Mensajes",      icon: MessageSquare },
  { to: "/tallas",                   label: "Tallas",        icon: Ruler },
  { to: "/sucursales",               label: "Sucursales",    icon: Building2 },
  { to: "/nodos",                    label: "Nodos",         icon: Smartphone },
  { to: "/equipo",                   label: "Equipo",        icon: Users },
  { to: "/ajustes/migracion",        label: "Migración…",    icon: Settings },
];
```

---

## Rutas y features

| Ruta | Descripción | Service/hook principal |
|---|---|---|
| `/` | Dashboard con KPIs | `useVentasHoyRT`, `useCortesActivos`, `useArticulos` |
| `/articulos` | Lista con buscador | `useArticulos` |
| `/articulos/nuevo` | Crear | `crearArticulo` |
| `/articulos/:id` | Editar | `actualizarArticulo` + `useArticulo(id)` |
| `/ventas` | Historial filtrable | `useVentasAdmin(filters)` |
| `/ventas/:id` | Detalle | `useVentasAdmin({limite:500})` + find |
| `/cortes` | Por sucursal+día | `useCortesDia(sid, date)` |
| `/apartados` | Por sucursal | `useApartadosSucursal(sid)` |
| `/reportes/mas-vendidos` | Top 30 N días | `useVentasAdmin({desde})` + agregación |
| `/reportes/articulo` | Consulta por ID/sigla | `useVentasAdmin({desde})` + filter |
| `/mensajes` | Chat general | `useMensajesAdmin` + `enviarMensajeAdmin` |
| `/tallas` | Grupos editables | `useTallas` + `tallasService` |
| `/sucursales` | CRUD | `useSucursales` + `sucursalService` |
| `/nodos` | Ver + revocar | `useNodos` + `fnRevocarNodo` |
| `/equipo` | CRUD inline | `useEquipo` + `equipoService` + `setAdminFlag` |
| `/ajustes/migracion` | Migración legacy | `fnMigrarDataLegacy` |

---

## useNegocio

El admin trabaja en el contexto de UN negocio. El hook `useNegocio()`
resuelve el `negocioId` desde los claims, con fallback crítico:

```ts
// hooks/useNegocio.ts
const NEGOCIO_DEFAULT = import.meta.env.VITE_NEGOCIO_ID || "amise";

export function useNegocio() {
  const { user } = useAuth();
  const claimNegocioId = user?.claims.negocioId ?? null;
  const esSuperadmin = user?.claims.role === "superadmin";

  // FIX C11: superadmin sin claim asignado → defaults a "amise"
  const negocioId = claimNegocioId ?? (esSuperadmin ? NEGOCIO_DEFAULT : null);

  // onSnapshot al doc del negocio
  ...
  return { negocio, negocioId, loading };
}
```

Sin este fallback, el superadmin (que por diseño no tiene `negocioId` en
su claim — manda todos los negocios) no podría ver datos. Multi-negocio
con selector se agrega en fase futura.

---

## Catálogo de artículos

### `articuloService.ts`

**Crear** con contador atómico:

```ts
async function siguienteId(negocioId: string): Promise<string> {
  const ref = doc(db, `${paths.negocio(negocioId)}/datos_web_new_version/_contadorArticulos`);
  let nuevo = "";
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const prev = snap.exists() ? snap.data().ultimoId : undefined;
    const base = prev && /^\d+$/.test(prev)
      ? parseInt(prev, 10) + 1
      : parseInt(ARTICULO_ID_INICIAL, 10);   // "12300001"
    nuevo = String(base);
    tx.set(ref, { ultimoId: nuevo }, { merge: true });
  });
  return nuevo;
}
```

Preserva la secuencia del Android legacy (base `12300001`).

**Upload imagen** (principal + subvariaciones):

```ts
async function uploadImagenPrincipal(negocioId, articuloId, file) {
  const blob = await compressToWebP(file);          // canvas toBlob
  const path = `media_web_new_version/articulos/${articuloId}.webp`;
  await uploadBytes(storageRef(storage, path), blob, { contentType: "image/webp" });
  return await getDownloadURL(storageRef(storage, path));
}
```

`compressToWebP()` en `src/lib/image.ts` usa `createImageBitmap` + canvas.
Max dimension 1600px, quality 0.82 → típicamente 60% más pequeño que el JPG
original.

**Sync protocol**:

```ts
async function marcarArticuloEnSync(negocioId) {
  // FIX C4: solo escribir la huella (no flags por nodo).
  // Los nodos usan onSnapshot directo sobre articulos_n_w/* sin necesidad
  // del protocolo de ack.
  await setDoc(acRef, { huella: generarID() }, { merge: true });
}
```

### `ArticuloEditPage.tsx`

Form con 5 secciones:

1. **Información básica**: nombre, sigla, referencia, género, subgénero,
   hashtags.
2. **Precios e inventario**: preciCompra, precioVenta, cantidad. Live recalc
   de utilidad/utilidadTotal.
3. **Imagen**: `ImageUpload` con preview, compresión al subir, **flag
   `imagenRemoved`** para distinguir "no cambió" vs "quitó" (FIX D3).
4. **Subvariaciones**: `SubvariacionesEditor` con array editable + imagen
   por variante.
5. **Promociones y tallas**: grupo de tallas (texto por ahora), checkboxes
   3×2/seña/promoBandera, mayoreo/cantMayoreo/descuento.

**FIX D2**: `useRef` de "initializedId" evita reset del form si llega un
snapshot update remoto mientras el user edita. Solo inicializa una vez
por artículo.

---

## Queries admin: collectionGroup

El admin consulta ventas/cortes de múltiples sucursales. Estrategia:

1. Cada venta y corte lleva el campo `negocioId` en el doc (agregado en
   Fase 5).
2. Queries usan `collectionGroup("items")` que matchea TODAS las subcols
   llamadas `items` bajo cualquier path.
3. Filtros con `where("negocioId", "==", negocioId)` garantizan que las
   rules dejen pasar los reads.

### Ejemplo — `useVentasAdmin`

```ts
const q = query(
  collectionGroup(db, "items"),
  where("negocioId", "==", negocioId),
  ...(sid ? [where("sucursalId", "==", sid)] : []),
  ...(vend ? [where("enTurno", "==", vend)] : []),
  ...(desdeISO ? [where("fechaISO", ">=", desdeISO)] : []),
  orderBy("fechaISO", "desc"),
  limit(500),
);
const snap = await getDocs(q);
snap.forEach(d => {
  const v = d.data() as Venta;
  if (Array.isArray(v.articulos)) arr.push(v);    // filtro: cortes no tienen articulos[]
});
```

**Índices** requeridos (ver `firestore.indexes.json`):

- `{negocioId ASC, fechaISO DESC}` — sin sucursal/vendedor
- `{negocioId ASC, sucursalId ASC, fechaISO DESC}` — con sucursal
- `{negocioId ASC, enTurno ASC, fechaISO DESC}` — con vendedor

### `useCortesActivos`

```ts
const q = query(
  collectionGroup(db, "items"),
  where("estado", "==", "corte_enCurso"),
  where("negocioId", "==", negocioId),
);
```

Los docs `venta` NO tienen `estado` (no match) → solo los cortes pasan el
filtro. Índice: `{estado ASC, negocioId ASC}`.

---

## Dashboard en vivo

`routes/Dashboard.tsx` usa 4 hooks que refrescan en tiempo real (o casi):

- `useVentasHoyRT()` — `onSnapshot collectionGroup(items)` con
  `fechaISO >= hoy 00:00`. Se re-renderiza con cada venta nueva.
- `useArticulos()` — `onSnapshot` al catálogo, para contar stock bajo.
- `useSucursales()` — para mapear sucursalId → nombre.
- `useCortesActivos()` — **getDocs una vez** (no RT). Admin refresca la
  página para ver cambios. Documentado en H8.

KPIs:

1. **Ventas hoy**: suma `montoCobro` + count + breakdown por sucursal.
2. **Cortes en curso**: count.
3. **Catálogo**: count + artículos con `cantidad < 5` (alert).
4. **Sucursales**: activas / total.

Alert destacado si hay stock bajo (`border-destructive` + icono).

---

## Migración legacy UI

`routes/ajustes/MigracionPage.tsx` invoca `fnMigrarDataLegacy`.

Flujo:

1. Admin elige sucursal destino + tipo opcional + pulsa "Dry-run".
2. CF corre en modo `dryRun: true`, retorna conteos sin escribir.
3. Admin revisa, pulsa "Migrar ahora" (confirm dialog).
4. CF corre en modo real, escribe + log en
   `datos_web_new_version/_migracionesLegacy[timestamp]`.
5. UI muestra resultados por tipo + errores.

Idempotente: re-runs no duplican (usa `huella` del doc original como ID
destino).

Ver [`03-cloud-functions.md`](03-cloud-functions.md) §"Migración legacy"
para el mapping completo.
