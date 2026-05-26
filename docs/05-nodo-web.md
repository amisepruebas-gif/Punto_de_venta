# nodo-web

> **Cuándo usar este doc**: para trabajar en la PWA del vendedor. Cubre la
> arquitectura del front, cómo se escribe una venta, cómo funciona el
> offline y cada feature.

## Índice

1. [Estructura del paquete](#estructura-del-paquete)
2. [Boot flow](#boot-flow)
3. [Identidad persistente](#identidad-persistente)
4. [Ventas (crítico)](#ventas)
5. [Cortes de caja](#cortes-de-caja)
6. [Mensajes](#mensajes)
7. [Apartados y abonos](#apartados-y-abonos)
8. [Barcode scanner](#barcode-scanner)
9. [Ticket PDF + share](#ticket-pdf--share)
10. [PWA y offline](#pwa-y-offline)

---

## Estructura del paquete

```
nodo-web/
├── src/
│   ├── main.tsx                Router + QueryClient + StrictMode
│   ├── App.tsx                 Route guards: /first-run vs /
│   ├── config.ts               NEGOCIO_ID ("amise")
│   ├── firebase/
│   │   ├── config.ts           initializeFirestore con persistent cache
│   │   ├── auth.ts             signInWithCustomToken helper
│   │   └── callable.ts         wrappers tipados de CFs
│   ├── hooks/
│   │   └── useNodoSession.ts   localStorage + onAuthStateChanged
│   ├── routes/
│   │   ├── FirstRun.tsx        wrapper del form de registro
│   │   └── Ventas.tsx          pantalla principal — integra TODO
│   ├── features/
│   │   ├── first-run/
│   │   │   ├── useRegistroNodo.ts
│   │   │   └── FormRegistro.tsx
│   │   ├── sucursal/
│   │   │   └── useSucursal.ts  ← doc de la sucursal del nodo
│   │   ├── articulos/
│   │   │   └── useArticulos.ts ← onSnapshot catálogo
│   │   ├── equipo/
│   │   │   └── useEquipo.ts    ← selector vendedor
│   │   ├── ventas/
│   │   │   ├── ventaService.ts        crearVenta con transacción
│   │   │   ├── carritoStore.ts        Zustand
│   │   │   ├── BuscadorArticulo.tsx
│   │   │   ├── BarcodeScanner.tsx
│   │   │   ├── useBarcodeBusqueda.ts
│   │   │   ├── CarritoPanel.tsx
│   │   │   ├── SelectorVendedor.tsx
│   │   │   ├── PagoModal.tsx
│   │   │   ├── TicketModal.tsx
│   │   │   └── ticketService.ts       pdfmake lazy
│   │   ├── cortes/
│   │   │   ├── corteService.ts
│   │   │   ├── useCorteActivo.ts
│   │   │   └── CorteModal.tsx
│   │   ├── chat-grupo/
│   │   │   ├── chatGrupoService.ts
│   │   │   ├── useChatGrupoNodo.ts
│   │   │   ├── ChatGrupoModal.tsx
│   │   │   ├── FloatingChatButton.tsx
│   │   │   └── ImageLightbox.tsx
│   │   └── apartados/
│   │       ├── apartadoService.ts
│   │       ├── useApartados.ts
│   │       ├── ApartadoModal.tsx
│   │       └── ApartadosSheet.tsx
│   ├── components/ui/          shadcn primitives (Button, Input)
│   ├── lib/utils.ts            cn()
│   ├── styles/globals.css      Tailwind + dark mode vars
│   └── vite-env.d.ts           incluye declare global BarcodeDetector
├── public/
│   └── icons/                  PWA icons (placeholder)
├── index.html                  viewport con user-scalable=no
├── vite.config.ts              PWA plugin con denylist Firestore
├── tailwind.config.ts
├── tsconfig.json               tsPaths "@/*" y "@shared/*"
└── firebase.json               hosting target "nodo"
```

---

## Boot flow

```
main.tsx
  ↓
App.tsx:
  useNodoSession() lee localStorage.amise_nodo_session + onAuthStateChanged
  ↓
  loading → "Cargando…"
  ↓
  nodoId present → <Ventas />
  nodoId absent  → <FirstRun />
```

Cuando Firebase Auth restaura la sesión desde IndexedDB, `onAuthStateChanged`
dispara y setea `loading=false`. Si no hay auth user pero sí session local,
quedará en un estado inconsistente — el nodo-web hoy asume que si la
session local existe, también existe el auth restore. En la práctica,
ambos se pierden juntos (clear cache).

---

## Identidad persistente

Ver [`04-auth-y-roles.md`](04-auth-y-roles.md) §"Flujos de registro" para
el detalle completo. Resumen:

- **Primer arranque**: `FormRegistro` → `fnRegistrarNodo` → anonymous user
  + claims + custom token → `signInWithCustomToken` → guarda
  `localStorage.amise_nodo_session`.
- **Arranques siguientes**: IndexedDB tiene el user auth, localStorage tiene
  la session → UI carga a `Ventas` directo.
- **Al perder caché**: `FormRegistro` → toggle "Tablet recuperada" → selector
  de nodos activos → `fnRebindNodo` → nuevo auth user (el anterior se
  borra) → mismos claims.

Useful hooks:

```tsx
const { negocioId, sucursalId, nodoId, session, setSession } = useNodoSession();
```

`setSession(null)` → logout (limpia localStorage + Firebase Auth signOut).

---

## Ventas

El flujo crítico. La clase `Venta` (ver
[`02-firestore-schema.md`](02-firestore-schema.md)) se escribe con
**transacción atómica** sobre el contador del día.

### Store del carrito — `carritoStore.ts`

Zustand simple. State:

```ts
{
  items: CarritoItem[],     // { key, id, cantidad, precio, nombrePublico, ... }
  enTurno: string | null,   // nombre del vendedor seleccionado
  vendedorIdUsuario: string | null,
}
```

Actions:

```ts
agregar(articulo, { talla?, cantidad? })
incrementar(key)
decrementar(key)  // filtra key cuando llega a 0
quitar(key)
limpiar()
setVendedor(nombre, idUsuario)
setDescuento(key, descuento)
```

`key = articuloId + "__" + talla` — permite duplicados del mismo artículo
con distintas tallas.

### UI — `Ventas.tsx`

Layout:

```
┌──────────────────────────────────────────────────────────┐
│  Amise · Caja 1        [💬] [🔖] [Corte en curso] [Salir] │ header
├──────────────────────────────────────────────────────────┤
│ Vendedor: [Carlos*] [María] [Luis]                        │ SelectorVendedor
├─────────────────────────┬────────────────────────────────┤
│                         │                                │
│   Buscar / Escanear     │        Carrito                 │
│   [grid de cards]       │        [items]                 │
│                         │                                │
│                         │        Total $500              │
│                         │        [Apartar] [Cobrar]      │
└─────────────────────────┴────────────────────────────────┘
```

### `ventaService.crearVenta()`

La función crítica. Implementación completa en
`nodo-web/src/features/ventas/ventaService.ts`.

```ts
async function crearVenta(input: NuevaVentaInput): Promise<VentaResult> {
  const now = new Date();
  const { y, m, d } = ymdMX(now);
  const ymd = ymdPaddedMX(now);        // "2026-04-24"
  const huella = generarID();
  const ventaId = huella;

  const contadorRef = doc(db, paths.contadorDia(negocioId, sucursalId, ymd));
  const ventaRef = doc(db, paths.ventaItem(negocioId, sucursalId, y, m, d, ventaId));

  let numeroDeVenta = "";
  let offline = false;

  try {
    // Happy path — online
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(contadorRef);
      const prev = snap.exists() ? snap.data().ultimoNumeroVenta ?? -1 : -1;
      numeroDeVenta = String(prev + 1);
      const v = buildVenta({ ...input, numeroDeVenta, huella, ventaId, ... });
      tx.set(ventaRef, v);
      tx.set(contadorRef, { ultimoNumeroVenta: prev + 1, actualizado: serverTimestamp() }, { merge: true });
    });
  } catch (err) {
    // Fallback offline — sin transacción
    offline = true;
    numeroDeVenta = `OFFLINE-${nodoId.slice(0, 6)}-${Date.now()}`;
    const v = buildVenta({ ...input, numeroDeVenta, ... });
    await setDoc(ventaRef, v);   // Firestore encola offline; se escribe al reconectar
  }

  const venta = buildVenta({ ...input, numeroDeVenta, ... });

  // Trigger huella (best-effort)
  await setDoc(huellaRef, { huella_venta: generarID() }, { merge: true }).catch(...);

  return { venta, path: ventaRef.path, offline };
}
```

**Garantías**:

- Online: numeración monotónica por sucursal+día. Dos ventas concurrentes
  nunca obtienen el mismo número.
- Offline: la venta se guarda con `numeroDeVenta = "OFFLINE-xxx-ts"` y se
  encola en la outbox de Firestore.
- **Reconciliación**: la CF `reconciliarVentasOffline` (v2 trigger onCreate)
  detecta el prefijo y renombra a número real (ver
  [`03-cloud-functions.md`](03-cloud-functions.md)).

### `PagoModal.tsx`

UI modal con botones por método de pago. `pagoDividido` permite 3 montos
(efectivo + transferencia + tarjeta) que sumen el total. Al confirmar:

1. Llama `crearVenta()`.
2. Limpia el carrito.
3. Llama `onSuccess(venta, offline)` → el padre `Ventas.tsx` abre
   `TicketModal`.

---

## Cortes de caja

Un corte es un doc en `corte_1_web_new_version/{y}/{m}/{d}/items/{corteId}`.

### Estados

```
corte_enCurso  → corte_finalizado
```

No existe "corte_iniciar" como estado separado; el primer estado al crear
es `corte_enCurso` directamente.

### `corteService.ts`

```ts
// Iniciar
await iniciarCorte({ negocioId, sucursalId, nodoId, usuarioCreador, nombre_corte });
// Internamente: runTransaction sobre contador.ultimoNumeroCorte + tx.set corte

// Finalizar
await finalizarCorte({ negocioId, sucursalId, corte, y, m, d });
// Internamente:
//   1. calcularTotales(negocioId, sucursalId, nodoId, corte.fecha_inicio, y, m, d)
//      → query directo a ventas_n/.../items con where nodoId, filtrar client-side por fecha
//   2. updateDoc del corte con estado="corte_finalizado" + totales + fecha_fin
//   3. Trigger huella_venta (best-effort)
```

### `useCorteActivo.ts`

`onSnapshot` al query:

```ts
query(
  collection(db, `${paths.corteDia(neg, suc, y, m, d)}/items`),
  where("nodoId", "==", nodoId),
  where("estado", "==", "corte_enCurso"),
)
```

Solo hay 1 corte activo por nodo por día. Si el hook no encuentra uno, la UI
muestra "Iniciar corte". Si sí, muestra "Corte en curso".

---

## Mensajes

Chat general del negocio (no 1:1 por ahora).

### `mensajeService.enviarMensaje()`

```ts
const docRef = doc(db, paths.mensajesDia(negocioId, y, m, d));
const snap = await getDoc(docRef);
const primeraDelDia = !snap.exists();

const mensaje: Mensaje = {
  texto, hora: horaMX(), usuario, id: nodoId, corte: "",
  huella: generarID(), sucursalId,
};

if (primeraDelDia) {
  mensaje.nuevoDia = d;
  if (d === "1") mensaje.inicioDeMes = m;
  if (m === "1" && d === "1") mensaje.inicioAño = y;
}

// FIX B2: atómico. arrayUnion + merge:true crea o appendea.
await setDoc(docRef, { mensajes: arrayUnion(mensaje) }, { merge: true });

// Trigger
await setDoc(huellaRef, { huella_mensaje: mensaje.huella }, { merge: true });
```

Preserva flags de protocolo (`nuevoDia`, `inicioDeMes`, `inicioAño`) solo
en el primer mensaje del día/mes/año. El admin-web los usa para renderizar
separadores en la UI.

### `useMensajes.ts`

Carga progresiva día por día:

- Hoy: `onSnapshot` en vivo sobre `chat_grupos_w/{nodoId}/dias/{ymd}`.
- Días previos: `getDoc` a demanda vía botón "Ver anteriores"
  (heurístico anti-bucle: tras 7 días vacíos consecutivos detiene).
- Meta del grupo: `onSnapshot` sobre `chat_grupos_w/{nodoId}`.

UI: `ChatGrupoModal.tsx` — modal centrado tipo `pop_mensajes` del
nodo_1 Android (card ~420 px máx, alto 85vh con tope 680 px, sobre
backdrop semi-transparente). Soporta:
- Texto + emojis (Unicode directo)
- Imagen con compresión cliente a WebP ≤ 700 KB (`compressToWebP`)
- Reply con cita (snapshot del mensaje citado)
- Lightbox fullscreen con pinch-zoom + doble-tap + pan
- Estado de apertura por miembro (telemetría para admin)
- Back-handler interno: lightbox cierra primero, modal después

Detalle de arquitectura del chat: ver `14-chat-arquitectura.md`,
`15-chat-implementacion.md`, `16-chat-testing-fase-e.md`.

---

## Apartados y abonos

Botón "Apartar" en `CarritoPanel` abre `ApartadoModal`:

```
crearApartado({
  negocioId, sucursalId, nodoId, cliente, telefonoCliente?,
  articulos, totalApartado, señaInicial
})
```

Crea `apartados_web_new_version/{apId}` con:

```ts
{
  apartadoId, cliente, telefonoCliente?, articulos: [...],
  seña: señaInicial,
  totalApartado,
  abonos: [{ fecha, monto: señaInicial, estado:"pagado", tipo:"seña" }],
  estado: señaInicial >= totalApartado ? "completo"
        : señaInicial > 0 ? "parcial"
        : "pendiente",
  fechaCreacion, sucursalId, nodoId, huella,
}
```

**Nota**: el apartado **NO crea una venta asociada**. El ingreso de la seña
queda solo en el doc del apartado. Decisión pendiente para Fase 5+ si el
admin quiere ver los abonos en el reporte de ventas. Ver
[`09-deuda-tecnica.md`](09-deuda-tecnica.md).

### Abonos posteriores

Botón "Apartados" (bookmark icon) abre `ApartadosSheet` con la lista de
pendientes/parciales. Al elegir uno, ver detalle + opción de abonar:

```
agregarAbono({ negocioId, sucursalId, apartado, monto, tipo: "abono" | "saldo" })
→ arrayUnion(abono) + recalcula estado
```

### Cancelar

```
cancelarApartado(negocioId, sucursalId, apartadoId)
→ update estado="cancelado"
```

---

## Barcode scanner

`BarcodeScanner.tsx` + `useBarcodeBusqueda.ts`.

Motor preferente: **BarcodeDetector API nativa** (Chrome Android, Edge
Android). Declaración de tipos global en
`nodo-web/src/vite-env.d.ts`.

Fallback: `@zxing/browser` — import **dinámico** para no pesar el bundle
principal si el scanner no se usa.

```tsx
const BD = typeof BarcodeDetector !== "undefined" ? BarcodeDetector : null;

if (BD) {
  const detector = new BD({ formats: ["ean_13", "ean_8", "code_128", ...] });
  const tick = async () => {
    const res = await detector.detect(videoRef.current);
    if (res[0]?.rawValue) onDetected(res[0].rawValue);
    ...
  };
  requestAnimationFrame(tick);
} else {
  const { BrowserMultiFormatReader } = await import("@zxing/browser");
  const reader = new BrowserMultiFormatReader();
  reader.decodeFromStream(stream, videoRef.current, result => {...});
}
```

**FIX B3**: `useEffect` depende solo de `[open]` (no `onDetected`); se usa
un `useRef` para el callback para evitar reinicio del video stream en cada
render del padre.

Tras detectar, `useBarcodeBusqueda.escanear(codigo)` busca por `id` o
`sigla` (case-insensitive) en el catálogo y agrega al carrito.

---

## Ticket PDF + share

`ticketService.ts` usa `pdfmake` con import **dinámico** (lazy chunk).

```ts
const pdfMake = (await import("pdfmake/build/pdfmake")).default;
const pdfFonts = (await import("pdfmake/build/vfs_fonts")).default;
pdfMake.vfs = pdfFonts.vfs ?? pdfFonts.pdfMake?.vfs;

pdfMake.createPdf(docDefinition).getBlob((blob) => resolve(blob));
```

El docDefinition tiene pageSize 80mm (ticket térmico). Contenido:

- Negocio + sucursal (nombre + dirección)
- Número de venta + fecha
- Vendedor
- Tabla de artículos (cant × nombre × precio × subtotal)
- Totales (subtotal, total, método, recibido, cambio)
- Badge "APARTADO" si aplica
- "Gracias por su compra"

### Compartir

```ts
abrirPDF(blob)          // window.open blob URL → diálogo impresión nativo
compartirPDF(blob)      // navigator.share({ files: [pdf] }) → WhatsApp/email
```

`navigator.canShare({files: [...]})` detecta soporte (Chrome Android +
iOS Safari 15+). En desktop Chrome típicamente retorna `false`.

---

## PWA y offline

### Manifest

`vite.config.ts` → `VitePWA(...)` genera `manifest.webmanifest` con:

- `display: "standalone"` (instala como app)
- `orientation: "any"`
- `theme_color: "#0a0a0a"`
- Icons 192, 512, 512-maskable

### Service Worker

Workbox generate mode. Precache de `.{js,css,html,svg,webp,woff2}`.

**Denylist crítica**:

```js
navigateFallbackDenylist: [
  /^\/__\/auth/,
  /firestore\.googleapis\.com/,
  /firebaseinstallations\.googleapis\.com/,
  /identitytoolkit\.googleapis\.com/,
  /securetoken\.googleapis\.com/,
  /firebasestorage\.googleapis\.com/,
],
```

Sin esto, el SW interceptaría los WebChannel streams de Firestore y los
onSnapshot se rompen.

### Persistencia

```ts
export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,  // FIX D1
  localCache: persistentLocalCache({
    cacheSizeBytes: CACHE_SIZE_UNLIMITED,
    tabManager: persistentMultipleTabManager(),
  }),
});
```

Tras el first-run, `requestPersistentStorage()` pide al navegador que no
evictee IndexedDB:

```ts
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  if (await navigator.storage.persisted()) return true;
  return await navigator.storage.persist();
}
```

En Chrome, si la app está instalada como PWA, `persist()` se concede sin
prompt. En iOS Safari, no existe la API — depende de que el user agregue
a Home Screen.

### Bundle sizes

Build output actual:

- Entry JS: 843 kB (219 kB gz) — incluye React + Firebase + app logic
- `pdfmake` chunk lazy: ~1.2 MB (584 kB gz) — solo carga al abrir ticket
- `vfs_fonts` chunk lazy: ~855 kB (466 kB gz) — idem
- `@zxing/browser` chunk lazy: ~415 kB (109 kB gz) — solo al abrir scanner
- Precache SW: 3.4 MB total

El usuario descarga los ~850 kB del entry inicial; lo demás solo si usa
esas features.
