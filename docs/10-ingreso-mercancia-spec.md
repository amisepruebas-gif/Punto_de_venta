# Ingreso de mercancía — Spec + Plan de migración

> Doc autogenerado a partir de las decisiones de producto del 2026-04-25
> (con complemento del mismo día). Aún **no implementado**. Sirve como
> contrato para futuros cambios coordinados entre `shared`, `admin-web` y
> `nodo-web`.

---

## 1. Reglas de negocio (texto del usuario, normalizado)

### 1.1 Categoría / subcategoría

- Cada artículo **puede o no** pertenecer a una categoría. Es opcional.
- Si pertenece a una subcategoría, **forzosamente** tiene que pertenecer a una
  categoría (la subcategoría está jerárquicamente anidada bajo una categoría).
- **Las categorías son universales**: se comparten para todo el catálogo del
  negocio. **No puede haber dos categorías con el mismo nombre** (case-insensitive).
- **Las subcategorías también son universales y únicas por nombre** dentro del
  conjunto global de subcategorías. Una subcategoría pertenece a una sola categoría.
- Estas dos colecciones viven en Firestore (la estructura concreta queda como
  decisión de implementación, ver §3.1).

### 1.2 Etiquetas

- Cada artículo puede tener un set de **etiquetas** (tags) con fines de búsqueda
  y segmentación.
- Las etiquetas son strings libres a nivel de artículo; pueden repetirse entre
  artículos (eso es justo lo que las hace útiles para agrupar).
- Sustituyen / amplían el campo actual `hashtags: string` que era una cadena
  única separada por algún delimitador.

### 1.3 Subvariaciones con código propio (= reemplazan al artículo padre)

Esquema actual de IDs:
- Cada artículo tiene un id de **8 dígitos** que **siempre empieza con `123`**.
- Los 5 dígitos restantes son secuenciales con padding de ceros: `12300001`,
  `12300011`, `12300154`, etc. Definido en
  `shared/src/ids.ts` → `ARTICULO_ID_INICIAL = "12300001"`.

Nueva regla cuando un artículo tiene subvariaciones:

1. Tomar el id original, p.ej. `12300011`.
2. Quitar el prefijo `123` → quedan los 5 dígitos `00011`.
3. Quitar los ceros a la izquierda → queda `11`.
4. Cada subvariación recibe un código:

   ```
   v-{núcleo-sin-padding}-{aleatorio-3-alfanum}
   ```

   Ejemplos para el padre `12300011`:
   - Subvariación A → `v-11-6Ad`
   - Subvariación B → `v-11-x9P`
   - Subvariación C → `v-11-ZzQ`

5. El código original del padre (`12300011`) **queda inhabilitado** —
   no se puede vender, escanear, ni agregar al carrito directamente. Solo
   sirve como agrupador/header. Las ventas, ingresos, búsquedas etc. operan
   sobre los `v-11-XXX`.

   El padre sigue existiendo como entidad (para guardar el nombre, sigla,
   categoría, etiquetas, etc. compartidas), pero su `id` deja de ser un
   código escaneable.

6. Si el artículo **no tiene** subvariaciones, su id de 8 dígitos sigue siendo
   válido y escaneable como hoy.

#### Particularidades del random de 3 caracteres

- Alfabeto: `[A-Za-z0-9]` — **62 caracteres**.
- Espacio total: `62³ = 238 328` por núcleo. Suficiente para los casos
  prácticos (un mismo padre tiene a lo más decenas de subvariaciones), pero
  hay que **detectar y reintentar colisiones** dentro del mismo padre.
- Se generan al momento de guardar (commit a Firestore), no en el form local,
  para evitar fugas de IDs no usados.

### 1.4 Complemento del 2026-04-25 — embebido en el padre + lectura

> Estas reglas refinan §1.3 y reemplazan algunas decisiones tentativas de §3.

#### a) Las subvariaciones viven en el mismo doc del artículo padre

**No** se crea un doc separado por subvariación, ni una colección
`indice_subvariaciones`. El array `subvariaciones` queda embebido en el doc
del artículo padre. Razón: simplifica writes, atomicidad y la regla "padre
inhabilitado" se mantiene por presencia del campo, no por consultas cruzadas.

#### b) Precio único a nivel padre (no hay precio por subvariación)

`precioVenta` (y campos derivados como `descuento`, `mayoreo`, `3x2`,
`promoBandera`) viven sólo en el padre. Todas las subvariaciones comparten
el mismo precio. La subvariación únicamente guarda datos propios:

- `nombre`
- `referencia` (texto libre)
- `imagenUrl?`
- `cantidad?` (existencia/stock individual cuando exista sistema de stock)

#### c) Algoritmo de lectura de código de barras (POS / nodo-web)

```
escanear(codigo):
  if codigo no empieza con "v-":
    return byId.get(codigo)         // flujo viejo, padre escaneable

  núcleo = primer segmento entre los dos guiones, p.ej. "v-11-6Ad" → "11"
  rand   = segundo segmento, p.ej. "6Ad"

  // Reconstruir id del padre:
  padding = "00000".slice(núcleo.length)   // 5 - len(núcleo) ceros a la izq
  idPadre = "123" + padding + núcleo       // p.ej. "123" + "000" + "11"

  padre = byId.get(idPadre)
  if !padre || !padre.subvariaciones:
    return miss

  sv = padre.subvariaciones.find(s => s.codigo === codigo)
  // o equivalente: filtrar por rand si guardamos sólo el suffix
  if !sv: return miss

  return { padre, sv, precio: padre.precioVenta }
```

Casos a manejar:

- **Padre con `subvariaciones?.length > 0` escaneado por su id 8-dig**:
  rechazar — "Este artículo tiene variaciones; escanea la del color/talla
  específico". Replica la inhabilitación del padre.
- **Núcleo válido pero rand inexistente**: miss → mensaje "código no
  encontrado".
- **Padre sin `subvariaciones`** pero escaneado un `v-NN-XXX`: miss.

#### d) Lectura en admin-web (dispositivo_1)

Distinto al POS. **No hay lookup por `v-NN-XXX`**. La regla es:

```
if (articulo.subvariaciones?.length > 0) {
  // renderizar las subvariaciones como filas en la lista, agrupadas
  // bajo el padre. El padre actúa como header del grupo.
} else {
  // renderizar el artículo único como hoy
}
```

Esto aplica al listado de artículos y al flujo de ingreso de mercancía:
cuando un padre tiene variaciones, lo que se ingresa/edita es cada
subvariación individualmente (existencia, foto, nombre, referencia), no el
padre.

El padre sigue editándose como entidad para los campos compartidos
(precio, sigla raíz, categoría, subcategoría, etiquetas, promociones,
imagen genérica).

---

## 2. Análisis del impacto sobre el código existente

Estado actual relevante:

| Campo / lugar | Estado hoy |
|---|---|
| `Articulo.genero?: string` + `Articulo.subgenero?: string` | Strings libres, no normalizados — antecedente "tipo categoría" pero sin restricción de unicidad ni doc independiente. |
| `Articulo.hashtags?: string` | Una sola cadena, no array. |
| `Articulo.subvariaciones?: ArticuloSubvariacion[]` | Array embebido en el artículo padre. `ArticuloSubvariacion = { id: number, nombre, imagenUrl? }` donde `id` es el **índice** (0, 1, 2…), no un código escaneable. |
| `ARTICULO_ID_INICIAL = "12300001"` | `shared/src/ids.ts:35`. |
| `siguienteId(...)` en `articuloService.ts:34-52` y/o `shared/src/ids.ts:40` | Genera el id 8-dig por contador transaccional. Ningún path para `v-NN-XXX`. |
| Búsqueda en POS — `useArticulos` | Construye `byId: Map<string, Articulo>` y `bySigla: Map<string, Articulo>` (`nodo-web/src/features/articulos/useArticulos.ts:42-54`). No conoce `subvariaciones` como entidades indexadas. |
| Scanner — `useBarcodeBusqueda` | `byId.get(limpio)` y `bySigla.get(limpio.toLowerCase())` (`nodo-web/src/features/ventas/useBarcodeBusqueda.ts:11-26`). Si llega `v-11-6Ad` cae en miss. |
| Carrito — `carritoStore.agregar` | Persiste `id: art.id` directo en el `CarritoItem` (`nodo-web/src/features/ventas/carritoStore.ts:74`). No distingue padre/subvariación. |
| Reportes — `BuscarPorArticuloPage`, `MasVendidosPage` | Comparan `a.id === articulo.id`. Si las ventas legacy usaron el id padre y las nuevas usan `v-NN-XXX`, los reportes se rompen para ese artículo. |
| Sync `articulos_ac` | Marca huella global; no se altera por subvariaciones, basta con que las subvariaciones queden dentro del mismo doc Articulo o como subdoc. |

---

## 3. Cambios que hay que hacer

### 3.1 `shared/src/schema.ts` — tipos

```ts
// Universales por negocio
export type Categoria = {
  categoriaId: string;          // slug auto: lowercase(nombre).replaceAll(/[^a-z0-9]+/g, "-")
  nombre: string;               // único por negocio (case-insensitive)
  fechaCreacion: string;
};

export type Subcategoria = {
  subcategoriaId: string;       // slug auto, único globalmente entre subcats
  nombre: string;               // único por negocio (case-insensitive)
  categoriaId: string;          // FK obligatoria a Categoria
  fechaCreacion: string;
};

// Reemplazo del esquema actual de subvariación. Vive embebida en el padre.
// Ningún campo de precio aquí — el precio único está en el padre (`precioVenta`).
export type ArticuloSubvariacion = {
  /** Código escaneable propio. Reemplaza al `id: number` de hoy. */
  codigo: string;               // "v-11-6Ad"
  nombre: string;
  referencia?: string;          // texto libre adicional (color, modelo, etc.)
  imagenUrl?: string;
  /** Existencia individual (cuando el negocio rastrea stock). */
  cantidad?: string;
};

export type Articulo = {
  id: string;                   // sigue siendo "123XXXXX" (8 dig)
  nombre: string;
  sigla: string;
  precioVenta: string;          // único; aplica a todas las subvariaciones
  // …
  /**
   * Si `subvariaciones?.length > 0` el padre queda inhabilitado al escaneo
   * directo. No se necesita campo booleano separado: la presencia del array
   * es suficiente (tanto en POS como en admin-web).
   */
  subvariaciones?: ArticuloSubvariacion[];
  /** Catálogo universal — si no aplica, omitir. */
  categoriaId?: string;
  subcategoriaId?: string;       // requiere categoriaId
  /** Reemplaza el viejo `hashtags: string`. */
  etiquetas?: string[];
  // hashtags?: string;          // ← deprecar (mantener readonly para migración)
};
```

### 3.2 Firestore — colecciones

Bajo `negocios_web_new_version/{negocioId}/`:

```
categorias/{categoriaId}              // doc Categoria
subcategorias/{subcategoriaId}        // doc Subcategoria (con categoriaId)
articulos_n/{articuloId}              // existente — extendido con campos nuevos.
                                      // Las subvariaciones viven EMBEBIDAS en
                                      // el array `subvariaciones` del padre.
```

**Nota sobre el lookup por `v-NN-XXX`** (decidido en §1.4-c): no se usa una
colección puente. La reconstrucción del id padre es determinística desde el
núcleo del código → el lookup es un `byId.get()` directo + búsqueda lineal
en el array `subvariaciones` (típicamente <50 elementos) para encontrar la
subvariación por su `codigo`. Performance suficiente para POS offline.

**Regla de unicidad** sobre `categorias` y `subcategorias`:
- En `crearCategoria`/`crearSubcategoria`, usar el **nombre normalizado** como
  `categoriaId` (slug). El doc se rechaza por la `transaction` si ya existe.
- Subcategoría adicional: validar que `categoriaId` existe.

### 3.3 `admin-web` — UI

- Página nueva: `/categorias` con CRUD de categorías y, anidado, subcategorías.
  - Listado simple, no pueden eliminarse si hay artículos asociados.
- En `ArticuloEditPage.tsx`:
  - Reemplazar inputs `genero` / `subgenero` por **selects** que leen las
    colecciones `Categoria` / `Subcategoria`. Subcategoría se habilita solo
    si hay categoría seleccionada y se filtra a las subcats de esa categoría.
  - Sustituir `hashtags` (input string) por **chips de etiquetas** (array).
  - En `SubvariacionesEditor.tsx`:
    - Cuando se crea o se agregan subvariaciones, **se calcula y muestra**
      el `codigo` (read-only, `v-NN-XXX`) generado al guardar.
    - Aviso visual: "Al guardar con subvariaciones, el código del artículo
      padre `12300011` queda inhabilitado. Las ventas se hacen con los
      códigos `v-11-XXX`."
    - Cada subvariación expone su propio `cantidad` (stock individual). El
      `precioVenta` queda solo en el padre (compartido entre todas las
      variaciones).
    - Por subvariación: `nombre`, `referencia` (texto libre), `imagenUrl?`,
      `cantidad?`.
- `ArticulosPage.tsx` (listado e ingreso de mercancía):
  - Regla de render: `if (articulo.subvariaciones?.length > 0)` el render
    sustituye el item del padre por sus variaciones (cada subvariación es
    una fila propia mostrando código `v-NN-XXX`, nombre, referencia,
    cantidad, imagen). El padre queda visualmente como header/agrupador.
  - Si el padre **no** tiene subvariaciones, se renderiza como una sola
    fila igual que hoy.
  - Filtros por categoría, subcategoría y etiqueta.
- `articuloService.ts`:
  - Al crear: si `subvariaciones.length > 0`, generar codigos `v-{núcleo}-{rand}`
    con reintento por colisión, `tieneSubvariaciones=true`, y opcionalmente
    poblar `indice_subvariaciones/{codigo}`.
  - Al actualizar: respetar codigos existentes, asignar codigos nuevos solo
    a subvariaciones agregadas. Borrado de una subvariación borra su entry
    del índice.
  - Al eliminar el artículo: eliminar todos los `indice_subvariaciones/*` del
    padre.
- Catálogo en lista (`ArticulosPage.tsx`): filtros por categoría, subcategoría
  y etiqueta; mostrar badge "Con subvariaciones" cuando aplique.

### 3.4 `nodo-web` — POS

- `useArticulos.ts`:
  - Mantener `byId` para todos los padres (con o sin subvariaciones).
  - **No** se mantiene un map `bySubvariacion`: el lookup por `v-NN-XXX` se
    resuelve reconstruyendo el id padre (§1.4-c) y buscando dentro del
    array embebido. Solo el `byId` actual basta.
  - **Añadir `searchIndex: SearchEntry[]`** (Array) dentro del mismo
    `onSnapshot` callback que construye `byId/bySigla`. **Derivado** de
    `byId`: la fuente de verdad de los datos del artículo sigue siendo
    `byId`; el `searchIndex` solo guarda lo mínimo para filtrar y mostrar
    sugerencias.

    Forma de cada entrada (mínima, sin duplicar el artículo entero):

    ```ts
    type SearchEntry = {
      // Para localizar el artículo completo en byId al click
      kind: "articulo" | "variacion";
      idPadre: string;                  // id 8-dig del padre (en ambos kinds)
      subvariacionCodigo?: string;      // "v-11-6Ad" si kind === "variacion"

      // Mínimo para renderizar la sugerencia y filtrar por texto
      titulo: string;                   // padre.nombre  ó  `${padre.nombre} — ${sv.nombre}`
      blob: string;                     // lowercase de `titulo + sigla + referencia + etiquetas`
    };
    ```

    Reglas de poblado por artículo:
    - Si `articulo.subvariaciones?.length > 0`: el padre **no entra**;
      entran sus subvariaciones (en el orden del array embebido).
    - Si no tiene subvariaciones: el padre entra como `kind: "articulo"`.
    - Orden global: **ascendente por `idPadre`**. Las variaciones de un
      mismo padre quedan agrupadas seguidas en el orden del array embebido.

    En el click sobre una sugerencia, el `BuscadorArticulo` busca
    `byId.get(idPadre)` para obtener el artículo completo (precio,
    cantidad, imagen, descuento, promociones, etc.) y llama a
    `agregar(padre, { subvariacionCodigo, subvariacionNombre })`.

    Ventajas:
    - Cero duplicación de datos pesados (precio/cantidad/imagen/promos).
    - Sincronización automática: al rebuildearse `byId` por un snapshot,
      el `searchIndex` se rebuildea en el mismo paso.
    - Cierra el agujero del autocomplete sin lógica extra de validación.
- `useBarcodeBusqueda.ts`:
  - Algoritmo:
    1. Si el código empieza con `v-`, parsearlo: `[_, núcleo, rand] = codigo.split("-")`.
    2. Reconstruir `idPadre = "123" + núcleo.padStart(5, "0")`.
    3. `padre = byId.get(idPadre)`.
    4. Si `padre.subvariaciones` existe, buscar `sv` con `sv.codigo === codigo`.
    5. Si OK → devolver `{ padre, sv }`.
  - Si llega un id 8-dig que tiene `subvariaciones?.length > 0`, **rechazar**
    con mensaje "Este artículo tiene variaciones; escanea la del color/talla
    específico". (= regla de "padre inhabilitado".)
- `BuscadorArticulo.tsx`:
  - El autocomplete filtra contra `searchIndex` (no contra `articulos`).
  - Por construcción del índice, el padre con variaciones **nunca** aparece
    en las sugerencias; aparecen sus variaciones individuales. Al click en
    una sugerencia tipo `variacion`, se llama directo a
    `agregar(padre, { subvariacionCodigo, subvariacionNombre })` sin pasar
    por modal.
  - Si la sugerencia es tipo `articulo` (artículo simple), `agregar(padre)`
    como hoy.
  - Filtros opcionales por categoría, subcategoría y etiqueta arriba del
    autocomplete o como facetas.
- `carritoStore.ts`:
  - Extender `CarritoItem` con `subvariacionCodigo?` y `subvariacionNombre?`.
  - El `key` de carrito debe usar `subvariacionCodigo` cuando exista para
    que dos variantes del mismo padre no se fusionen.
  - El `precio` del item se toma siempre del padre (`padre.precioVenta`).
- `ConfirmarVentaModal.tsx`, `TicketModal.tsx`, `VentaArticulo`:
  - Persistir `subvariacionCodigo` + `subvariacionNombre` en la venta.
  - Renderizar el código de subvariación junto al nombre del artículo en
    los tickets y previews.

### 3.5 `admin-web` — Módulo Ingreso de Mercancía

Página nueva: `/ingreso-mercancia`.

Funcionalidad:

- Scanner de cámara (reusar `BarcodeScanner` de nodo-web migrado a admin-web,
  o crear su gemelo).
- Input manual de código por si el scanner falla.
- Pipeline al detectar un código:

  ```
  if codigo empieza con "v-":
    parsear → idPadre + codigoSubvariacion
    padre = byId[idPadre]
    sv    = padre.subvariaciones.find(s => s.codigo === codigo)
    si sv → cargar pantalla de ingreso con la subvariación
  else (8 dígitos):
    padre = byId[codigo]
    si padre.subvariaciones?.length > 0:
      mostrar lista de variaciones del padre, pedir al usuario elegir
      (o rechazar pidiendo escanear la variación específica)
    sino:
      cargar pantalla de ingreso con el artículo
  ```

- Pantalla de ingreso muestra:
  - Foto, nombre, código actual.
  - `cantidad` actual.
  - Input "Sumar al stock" (número positivo).
  - Botón "Confirmar ingreso" → suma al `cantidad` correspondiente
    (en padre si artículo simple, en subvariación si aplica).
  - Log de la operación opcional en una colección `ingresos_mercancia/{id}`
    con timestamp, usuario, articuloId, subvariacionCodigo, delta.

- Permite cadenas de scans rápidos (kiosk-mode): tras confirmar uno, vuelve
  al scanner sin salir de la página.

### 3.6 `shared/src/schema.ts` — `VentaArticulo`

```ts
export type VentaArticulo = {
  id: string;                    // id del padre 123XXXXX (siempre)
  subvariacionCodigo?: string;   // "v-11-6Ad" si aplica
  subvariacionNombre?: string;
  // … resto igual
};
```

Razón de mantener `id` del padre: los reportes históricos siguen funcionando
agrupados por artículo padre, y se puede rebanar adicionalmente por
`subvariacionCodigo`.

---

## 4. Migración de datos existentes

1. **Categorías / subcategorías**: crear seed-script que recorra todos los
   artículos, deduplique `genero` y `subgenero` (case-insensitive), y los
   inserte en `categorias` + `subcategorias`. Después actualizar cada
   `Articulo` con `categoriaId` y `subcategoriaId`.

2. **Etiquetas**: si `hashtags` es una cadena `"#promo #verano"`, parsearla
   a `etiquetas: ["promo", "verano"]` (split por espacios o comas, normalizar
   case y quitar `#`).

3. **Subvariaciones**: el schema viejo guarda `ArticuloSubvariacion = { id: number, nombre, imagenUrl }`.
   Para cada artículo con `subvariaciones?.length > 0`:
   - Marcar `tieneSubvariaciones = true`.
   - Para cada subvariación generar `codigo: v-{núcleo}-{rand}`.
   - Si las ventas históricas se hicieron contra el id padre, **no hay forma
     determinística de reasignarlas** — quedan apuntando al padre. Se puede
     anotar en el reporte "ventas legacy sin subvariación".

4. **Índice `indice_subvariaciones`**: poblarlo durante el mismo seed.

Hacerlo con una **Cloud Function ad-hoc** (no migrarlo desde el cliente) para
garantizar consistencia y evitar parpadeos durante la transición.

---

## 5. Plan de implementación por fases

| Fase | Entregable | Riesgo |
|---|---|---|
| 1 | Tipos en `shared` + colecciones nuevas en Firestore (vacías). Reglas Firestore para `categorias` / `subcategorias`. | Bajo. |
| 2 | admin-web: CRUD de categorías y subcategorías. UI sin tocar artículos todavía. | Bajo. |
| 3 | admin-web: artículo edita categoría/subcategoría/etiquetas. Sin subvariaciones aún. Migración seed corre como CF y backfillea. | Medio — toca artículos en producción. |
| 4 | admin-web: subvariaciones con códigos `v-NN-XXX`. nodo-web sigue ignorándolas (compat). | Medio. |
| 5 | nodo-web: resolver dual padre/subvariación. Modal de selección. Bloqueo del id padre cuando `tieneSubvariaciones=true`. | Alto — POS productivo. |
| 6 | Reportes y tickets reflejan subvariaciones. Borrar `hashtags` legacy del schema. | Bajo. |

---

## 6. Decisiones (estado tras complemento + ronda del 2026-04-25)

| # | Pregunta | Estado |
|---|---|---|
| 1 | Precio por subvariación vs único en padre | ✅ Precio único en el padre. |
| 2 | Subvariaciones embebidas vs índice puente | ✅ Embebidas en el padre. Sin índice puente. |
| 3 | Stock individual por subvariación | ✅ `cantidad` por subvariación cuando aplique sistema de stock. |
| 4 | Algoritmo de resolución de `v-NN-XXX` en POS | ✅ Padding + reconstrucción de id padre + búsqueda lineal en array embebido. |
| 5 | Render de admin-web cuando hay subvariaciones | ✅ Regla de presencia (`subvariaciones?.length > 0`) → variaciones reemplazan al padre como filas. |
| 6 | Etiquetas: libres o universales | ✅ Libres (`string[]` por artículo). Sin colección dedicada. |
| 7 | Sigla / referencia: ¿comparte sigla la variación con el padre? | ✅ `sigla` solo en padre; cada variación tiene su `referencia` propia. |
| 8 | Ventas legacy con `id` padre y sin subvariación | ✅ Quedan como están. El `id` capturado en la venta puede tener o no sufijo de variación según el momento; los reportes agrupan por padre. |
| 9 | "Ingreso de mercancía" tipo Android (scan + sumar stock) | ⏳ Pendiente. La spec actual cubre captura desde el form del artículo. Módulo separado de scan-and-add se diseña aparte si se decide hacerlo. |
| 10 | ¿Padding del núcleo cuando es muy corto (`v-1-XXX`)? | ✅ Sin padding. El código no es para lectura visual. |
| 11 | ¿Generación del random server-side o local? | ✅ **Local**. El espacio del random sólo necesita ser único dentro de las variaciones del mismo padre. Que dos padres distintos coincidan en `dFc` es irrelevante porque cada uno se resuelve por su núcleo. La probabilidad de colisión local con un solo super-admin editando un mismo padre es insignificante. |
| 12 | Borrar categoría/subcategoría con artículos asociados | ✅ **Permitido**. Los artículos quedan **huérfanos** (su `categoriaId` / `subcategoriaId` apunta a un slug ya inexistente). La UI debe representar los huérfanos como "(sin categoría)" sin reventar. No se hace cascade-delete sobre artículos. |
| 13 | Render de reportes con subvariaciones | ✅ Árbol de búsqueda por padre. Si el padre tiene variaciones, el reporte despliega sus variaciones para el agrupamiento. La venta guarda el `id` con o sin variación; los reportes pueden filtrar por cualquiera de los dos niveles. |
| 14 | Protección de "padre inhabilitado" en todas las rutas de agregar al carrito | ✅ **Vía `searchIndex` pre-armado** (decisión #15). Los padres con variaciones nunca aparecen como resultados de búsqueda; en su lugar aparecen sus variaciones. La validación en escaneo (`useBarcodeBusqueda.ts`) sigue como red de seguridad. |
| 15 | Estructura del `searchIndex` para el POS | ✅ **Lista (Array) derivada de `byId`**, construida en el mismo `onSnapshot` callback (no como `useMemo` aparte). No duplica los datos completos del artículo: cada entrada tiene **solo lo necesario para filtrar y mostrar la sugerencia**; el resto se lee de `byId` al momento del click. Reglas de poblado: si el artículo no tiene variaciones → entra una sola entrada. Si tiene variaciones → el padre **no entra**, entran sus variaciones, cada una con `nombre` del padre + `nombre`/`referencia` propios concatenados para el `String.includes`. **Orden**: ascendente por id del padre (las variaciones de un mismo padre quedan agrupadas, ordenadas según el array embebido). Esto cierra el agujero del autocomplete: nunca se puede llegar a un padre inhabilitado desde la búsqueda. |
| 16 | Ingreso de mercancía tipo Android (scan + sumar stock) en admin-web | ✅ **Incluido en el scope.** Se diseña como módulo separado dentro de admin-web (página `/ingreso-mercancia`) con: scanner de cámara/USB, lookup por id padre o por `v-NN-XXX`, vista de la subvariación correspondiente, input para sumar al `cantidad`, log de cada ingreso. Mismas reglas: padre con variaciones rechaza el scan directo. |

---

## 7. Huecos detectados / riesgos

> Análisis del agente del 2026-04-25 después de leer el código actual y la
> spec con su complemento.

### 7.1 Sin bloqueadores de diseño

La modificación es factible y consistente con el resto del sistema. La parte
más sensible es la **migración de IDs en subvariaciones existentes** (de
`id: number` a `codigo: "v-NN-XXX"`) y la **inhabilitación del padre**, ambos
manejables con la Cloud Function de seed de §4.

### 7.2 Decisiones implícitas resueltas + las que quedan abiertas

1. **Numeración del núcleo** — sin padding. El código no es para lectura
   visual. ✅
2. **Conflicto entre `Articulo.cantidad` legacy y `cantidad` por subvariación**
   ✅ resuelto:
   - **En migración**: el `cantidad` del padre se sobreescribe con la suma
     de `cantidad` de sus variaciones (snapshot informativo).
   - **A partir de la primera edición posterior**: cuando
     `subvariaciones?.length > 0`, el campo `cantidad` del padre se ignora
     en lecturas y nunca se actualiza desde admin-web. La UI muestra solo
     `cantidad` por subvariación.
   - **Cuando no hay subvariaciones**: `cantidad` del padre sigue siendo la
     existencia del artículo, igual que hoy.
   - El POS, al consumir stock al vender, decrementa
     `subvariaciones[i].cantidad` si la venta llevó subvariación, y
     `padre.cantidad` si no la llevó (legacy o artículo simple).
3. **Slug de categoría/subcategoría** — scoping per-negocio. Sin conflicto
   entre negocios distintos. ✅
4. **Renombrar una categoría/subcategoría**: el `categoriaId` (slug) es
   estable; el `nombre` mostrado puede cambiar y los artículos no requieren
   backfill. ✅
5. **Borrar categoría/subcategoría con artículos asociados** — permitido,
   los artículos quedan huérfanos (decisión #12 de §6). ✅
6. **Random `rand-3` local** — sin coordinación cross-padre. La generación
   client-side es aceptable porque la unicidad sólo importa dentro del
   array de un mismo padre. ✅
7. **Reportes** — árbol por padre. Si el padre tiene variaciones, el
   reporte despliega sus variaciones para el detalle. ✅
8. **Protección "padre inhabilitado" en BuscadorArticulo** — se valida
   tanto en autocomplete como en scanner. Cualquier ruta que termine
   llamando a `agregar()` debe pasar por el `SubvariacionPickerModal`
   primero si el artículo tiene variaciones. ✅
9. **Construcción del `searchIndex` en el mismo `onSnapshot`**: el hook
   actual `useArticulos.ts:36-58` ya reconstruye `byId/bySigla` desde cero
   en cada snapshot — no hay memoización fina. Cuando agreguemos el
   `searchIndex` (decisión #15) hay que **construirlo dentro del mismo
   callback**, no como `useMemo` separado con dependencia `[articulos]` u
   `[articulos.length]`, porque cambios en variaciones embebidas no alteran
   `length` y un memo mal hecho serviría datos viejos.
10. **Módulo de Ingreso de Mercancía**: confirmado en scope (§3.5).
    Mismas reglas: padre con variaciones rechaza el scan directo del id
    8-dig; `v-NN-XXX` resuelve a la subvariación correspondiente.

### 7.3 Conclusión

- La modificación se puede hacer sin problemas técnicos serios.
- Riesgos abiertos:
  - Verificar la memoización de `useArticulos` para que cambios en el array
    `subvariaciones` invaliden el caché y reconstruyan `byId` (§7.2-9).
  - Decidir si se necesita el módulo de scan-and-add tipo Android para
    "ingreso de mercancía" (§7.2-10 y §6 #9).
- Recomiendo **fase 1-2 (categorías + tipos en `shared`) primero**, seguido
  por **fase 3-4 (admin-web full)**, y dejar **fase 5 (POS)** para el final
  con una bandera `negocio.usaSubvariacionesV2` que active la nueva ruta de
  resolución solo cuando el negocio ya migró sus artículos. Así un negocio
  no-migrado sigue operando con la ruta vieja sin riesgo.
