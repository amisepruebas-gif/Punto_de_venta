# Ingreso de Mercancía — Plan de Fases

> Plan ejecutable derivado de [`10-ingreso-mercancia-spec.md`](./10-ingreso-mercancia-spec.md)
> y refinado tras la auditoría contra el proyecto real (ver
> `_discrepancias-ingreso-mercancia.md`, ya aplicadas).
> Cada fase es atómica, deployable independientemente, y deja el sistema en
> un estado funcional. Las fases se aplican en orden estricto.

---

## Convención

Cada fase declara:

- **Objetivo** — qué entrega esta fase.
- **Tocar** — archivos que se crean/modifican.
- **Criterio de aceptación** — cómo validamos que terminó bien.
- **Dependencias** — qué fases previas tienen que estar.
- **Riesgo** — bajo / medio / alto.
- **Bandera de retorno** — cómo deshacer si algo sale mal.

---

## Fase 1 — Tipos en `shared` + helpers + reglas base

**Objetivo**

Modelar en TypeScript todos los conceptos nuevos, las constantes/paths de
Firestore, y los permisos base de las nuevas colecciones, **sin tocar UI ni
runtime**. Al final de la fase, el código compila en los 3 paquetes y los
admins pueden leer/escribir las nuevas colecciones de categorías aunque
todavía no haya UI para hacerlo.

**Tocar**

- `shared/src/schema.ts`:
  - Añadir tipos `Categoria`, `Subcategoria` (universales por negocio,
    `categoriaId`/`subcategoriaId` = slug determinístico).
  - **`ArticuloSubvariacion` con tipo dual transitorio** (clave para no
    romper consumers existentes que usan `id: number`):
    ```ts
    export type ArticuloSubvariacion = {
      // legacy — deprecar cuando termine fase 4
      /** @deprecated usar `codigo` */
      id?: number;
      // v2
      codigo?: string;          // "v-11-6Ad"
      nombre: string;
      referencia?: string;
      imagenUrl?: string;
      cantidad?: string;
    };
    ```
  - Extender `Articulo` con: `categoriaId?`, `subcategoriaId?`, `etiquetas?: string[]`.
  - Mantener `genero?` / `subgenero?` / `hashtags?` con `@deprecated`
    (la migración los lee, los nuevos campos los reemplazan, fase 6 los borra).
  - Extender `VentaArticulo` con: `subvariacionCodigo?`, `subvariacionNombre?`.
  - Extender `Negocio` con `usaSubvariacionesV2?: boolean` (default `false`,
    encendido per-negocio en Fase 5).
- `shared/src/ids.ts` — helpers puros (sin side-effects):
  - `nucleoDesdeId(id: string): string` — `"12300011" → "11"`.
  - `idDesdeNucleo(nucleo: string): string` — `"11" → "12300011"` (left-pad 5).
  - `parseVariacionCodigo(codigo: string): { idPadre, rand } | null`.
  - `generarVariacionCodigo(idPadre: string, existentes: ArticuloSubvariacion[]): string`
    — random 3-alfanum con reintento ante colisión local.
  - `slugCategoria(nombre: string): string` — normaliza nombre → slug
    determinístico (lowercase, espacios → guiones, sin diacríticos).
- `shared/src/collections.ts`:
  - Añadir `COL_CATEGORIAS = "categorias_web_new_version"`.
  - Añadir `COL_SUBCATEGORIAS = "subcategorias_web_new_version"`.
  - Añadir `paths.categoria(nid, cid)` y `paths.subcategoria(nid, sid)`.
  - **Cambiar firma de `paths.storageArticuloSubvariacion`**: pasar de
    `(artId, idx)` a `(artId, codigo)`. La migración de fase 4 mueve los
    archivos en Storage al nuevo path.
- `admin-web/src/features/articulos/articuloService.ts` — consolidación:
  - `siguienteId(...)` debe llamar internamente a
    `siguienteArticuloId(...)` de `shared/src/ids.ts` en vez de duplicar la
    lógica del parsing/parseInt. La función externa permanece (necesita el
    `runTransaction` por encima) pero su núcleo es del shared.
- `firestore.rules`:
  - Permitir lectura/escritura a admins autenticados con
    `negocioId == nid` en `negocios_web_new_version/{nid}/categorias_web_new_version/{cid}`
    y `.../subcategorias_web_new_version/{sid}`. Mismo patrón que las reglas
    actuales para artículos.

**Criterio de aceptación**

- `npx tsc --noEmit` pasa en `shared`, `admin-web` y `nodo-web` (3 paquetes).
- Los helpers nuevos tienen tests unitarios mínimos:
  - Round-trip `id ↔ núcleo` (incluyendo casos límite `12300001 ↔ 1` y
    `12399999 ↔ 99999`).
  - `parseVariacionCodigo` rechaza inputs inválidos (sin guiones, núcleo no
    numérico, rand de longitud incorrecta).
  - `generarVariacionCodigo` no produce duplicados con un array de 100
    entries existentes.
- `firebase deploy --only firestore:rules` no falla.
- Ningún consumer de `ArticuloSubvariacion.id: number` tiene errores de
  tipo (gracias al campo opcional retenido).

**Dependencias**

Ninguna.

**Riesgo**

Bajo. Solo tipos, funciones puras, constantes y reglas. Sin runtime nuevo.

**Bandera de retorno**

`git revert` del commit + redeploy de las reglas viejas. Como nada en runtime
usa los nuevos tipos todavía, no hay datos contaminados.

---

## Fase 2 — Categorías y Subcategorías en admin-web

**Objetivo**

UI completa de CRUD para categorías y subcategorías. Los paths/constantes
ya existen (Fase 1).

**Tocar**

- `admin-web/src/features/categorias/` (nuevo):
  - `categoriaService.ts` — `crear`, `editar`, `borrar`, `listar` (categorías
    y subcategorías), con validación de unicidad por slug en transacción
    (`runTransaction` que rechaza si el doc ya existe).
  - `useCategorias.ts` — `onSnapshot` de las dos colecciones.
- `admin-web/src/routes/categorias/CategoriasPage.tsx` (nuevo) — CRUD UI con
  formulario para crear categoría, listado, expansión que muestra
  subcategorías por categoría, botones de editar/borrar.
- `admin-web/src/routes/AppLayout.tsx` (o equivalente) — entry "Categorías"
  en la navegación lateral.

**Criterio de aceptación**

- Admin puede crear, renombrar y eliminar categorías y subcategorías.
- No se pueden crear dos categorías con el mismo nombre normalizado.
- No se puede crear una subcategoría sin categoría asociada (validación en
  el form).
- Al borrar una categoría se permiten subcategorías huérfanas (decisión #12
  del spec). UI las pinta como "(sin categoría)".
- Las colecciones existen en Firestore con datos reales del entorno de pruebas.

**Dependencias**

Fase 1 (tipos `Categoria`/`Subcategoria`, helpers `slugCategoria`,
constantes/paths, reglas Firestore).

**Riesgo**

Bajo. Módulo nuevo aislado, no toca artículos.

**Bandera de retorno**

Vaciar las colecciones desde la consola de Firestore + revert del código
admin-web.

---

## Fase 3 — Categoría/Subcategoría/Etiquetas en artículos + Migración

**Objetivo**

Conectar los artículos con las categorías nuevas y las etiquetas. Backfill
de los datos legacy (`genero`, `subgenero`, `hashtags`) en una operación
única vía Cloud Function.

**Tocar**

- `admin-web/src/routes/articulos/ArticuloEditPage.tsx`:
  - Reemplazar inputs `genero` / `subgenero` por **selects** que leen
    `useCategorias`. Subcategoría se habilita solo si hay categoría
    seleccionada y se filtra a las subcats de esa categoría.
  - Reemplazar input `hashtags` por **chips** de etiquetas (array libre).
- `admin-web/src/features/articulos/articuloService.ts`:
  - Aceptar `categoriaId`, `subcategoriaId`, `etiquetas` en `ArticuloInput`.
- `admin-web/src/routes/articulos/ArticulosPage.tsx`:
  - Filtros por categoría, subcategoría y etiqueta.
- `functions/migrarArticulosLegacy.js` (nuevo, v2 onCall):
  - Recorre artículos del negocio, deduplica `genero`/`subgenero` como
    categorías/subcategorías, parsea `hashtags` a `etiquetas[]`, popula los
    campos nuevos, **NO borra los campos legacy** todavía (fase 6).
  - Idempotente: re-ejecutarla no duplica categorías ni etiquetas.
  - Timeout extendido (`540_000`).
- `admin-web/src/routes/ajustes/AjustesPage.tsx` — botón "Migrar artículos a
  categorías v2" que llama la CF (mismo patrón ya consolidado de
  `migrarDataLegacy`).

**Criterio de aceptación**

- Crear y editar un artículo asocia categoría/subcategoría/etiquetas
  correctamente.
- Tras correr la CF de migración: cada artículo tiene `categoriaId` (si
  tenía `genero`) y `etiquetas[]` (si tenía `hashtags`). Los campos legacy
  siguen presentes pero ya no se editan.
- Filtrar artículos por categoría en `ArticulosPage` muestra solo los que
  correspondan; los huérfanos aparecen al filtrar "(sin categoría)".

**Dependencias**

Fases 1 y 2.

**Riesgo**

Medio. La CF de migración escribe a producción. Probar primero en negocio
de pruebas.

**Bandera de retorno**

La CF es idempotente y no destructiva (no borra `genero`/`hashtags`). Si
algo sale mal, los datos legacy siguen ahí; revert del UI deja al admin
editando con los selectores viejos.

---

## Fase 4 — Subvariaciones v2 en admin-web (con migración Storage)

**Objetivo**

Migrar el `SubvariacionesEditor` al esquema v2 (con `codigo: "v-NN-XXX"`,
`referencia`, `cantidad` por subvariación). Migrar archivos en Storage al
path nuevo. Eliminar el `id?: number` deprecado del tipo cuando todos los
consumers ya usen `codigo`.

El POS sigue ignorando el campo nuevo (back-compat: se trata el padre
como vendible mientras `negocio.usaSubvariacionesV2` esté en `false` —
rollout per-negocio en Fase 5).

**Tocar**

- `admin-web/src/features/articulos/SubvariacionesEditor.tsx`:
  - Inputs por subvariación: `nombre`, `referencia`, `cantidad`, imagen.
  - Display read-only del `codigo` (`v-NN-XXX`) generado al guardar.
  - Aviso UX: "Al guardar con subvariaciones, el código del padre
    `12300011` queda inhabilitado al escaneo cuando el negocio active
    `usaSubvariacionesV2`".
  - **`sigla` permanece sólo en el padre**; cada subvariación usa su `referencia`.
- `admin-web/src/features/articulos/articuloService.ts`:
  - `crearArticulo`/`actualizarArticulo`: generar `codigo` para nuevas
    subvariaciones (con `generarVariacionCodigo` de Fase 1), preservar
    codigos existentes al editar.
  - Si `subvariaciones.length > 0`: en migración inicial,
    `articulo.cantidad` = `sum(subvariaciones.cantidad)` (snapshot
    informativo); en ediciones posteriores el campo del padre se ignora.
  - Storage: usar `paths.storageArticuloSubvariacion(artId, codigo)` (firma
    nueva de Fase 1).
- `functions/migrarSubvariacionesLegacy.js` (nuevo, v2 onCall):
  - Convierte `subvariaciones[i].id: number` a
    `subvariaciones[i].codigo: "v-NN-XXX"` para artículos existentes con
    subvariaciones.
  - **Mueve los archivos en Storage**: `{artId}_sv0.webp` →
    `{artId}_v-NN-aaa.webp` (rename = copy + delete; conservar best-effort).
  - Calcula `articulo.cantidad = sum(subvariaciones.cantidad)` como
    snapshot.
  - Idempotente. Solo asigna codigos a entries que no lo tengan y solo
    mueve archivos cuyo destino aún no exista.
- `shared/src/schema.ts`:
  - **Eliminar `ArticuloSubvariacion.id?: number`** (ya nadie lo usa después
    de migrar el editor y el service). El tipo queda con `codigo: string`
    obligatorio.

**Criterio de aceptación**

- Crear un artículo con 3 subvariaciones genera tres `codigo` distintos del
  tipo `v-NN-XXX`.
- Editar el artículo y agregar una cuarta subvariación deja los 3 codigos
  previos intactos y genera 1 nuevo.
- Eliminar una subvariación NO recicla codigos existentes (queda agujereado
  el array).
- Migración de un artículo legacy con
  `[{ id: 0, nombre: "Rojo" }, { id: 1, nombre: "Azul" }]` produce
  `[{ codigo: "v-X-aaa", nombre: "Rojo" }, { codigo: "v-X-bbb", nombre: "Azul" }]`.
- En `ArticulosPage`, un artículo con 3 variaciones aparece como 1 header
  del padre + 3 filas de variaciones.
- **Auditoría manual previa al despliegue**: grep `articulo.cantidad` y
  `\.cantidad` en `admin-web/src` y `nodo-web/src` y validar que cada uso
  considere el caso `subvariaciones?.length > 0`. Anotar excepciones.
- Las imágenes de subvariación cargan correctamente desde el path nuevo
  (`{artId}_v-NN-aaa.webp`).

**Dependencias**

Fase 1.

**Riesgo**

Medio. La CF mueve archivos en Storage (operación con efectos secundarios).
Hacer dry-run en el negocio de pruebas y verificar que los URLs nuevos
resuelven antes de ejecutar en producción.

**Bandera de retorno**

La CF es idempotente. Si la generación de codigos o el move falla, los
datos viejos (`id: number` + archivos `_sv{idx}.webp`) siguen presentes
hasta que se sobreescriban. Si se necesita rollback completo, restaurar
desde backup de Firestore + Storage.

---

## Fase 5 — POS resuelve subvariaciones (lectura + carrito + ticket)

**Objetivo**

Que nodo-web entienda los codigos `v-NN-XXX`, bloquee el padre inhabilitado,
persista la subvariación elegida en cada venta, y respete la bandera
`usaSubvariacionesV2` para rollout per-negocio.

**Tocar**

- `nodo-web/src/features/negocio/useNegocio.ts` (nuevo):
  - `onSnapshot` al doc del negocio (`paths.negocio(negocioId)`), expone
    `negocio.usaSubvariacionesV2`. Mismo patrón que `useSucursal`.
- `nodo-web/src/features/articulos/useArticulos.ts`:
  - En el mismo `onSnapshot` callback que rebuildea `byId/bySigla`,
    construir el `searchIndex: SearchEntry[]` (decisión #15 del spec).
  - El index se ordena ascendente por `idPadre`; las variaciones de un
    padre quedan agrupadas en el orden del array embebido.
  - **Switch por bandera**: si `usaSubvariacionesV2 === false`, el
    `searchIndex` se construye al modo legacy (un padre = una entrada,
    sin descomponer variaciones). Cuando la bandera es `true`, las
    variaciones reemplazan al padre como entradas.
- `nodo-web/src/features/ventas/useBarcodeBusqueda.ts`:
  - Detectar prefijo `v-` con `parseVariacionCodigo` (helper de Fase 1).
  - Reconstruir `idPadre`, buscar en `byId`, luego buscar la subvariación
    en el array embebido.
  - Si llega un `id` 8-dig de un padre con `subvariaciones?.length > 0` y
    la bandera está activa, rechazar con mensaje "Este artículo tiene
    variaciones; escanea la del color/talla específica".
  - Si la bandera está `false`: comportamiento legacy (escaneo del padre =
    OK, codigos `v-NN-XXX` no se reconocen).
- `nodo-web/src/features/ventas/BuscadorArticulo.tsx`:
  - Filtrar contra `searchIndex`, no contra `articulos`.
  - Al click en una sugerencia, `byId.get(idPadre)` para obtener el
    artículo completo y llamar a
    `agregar(padre, { subvariacionCodigo, subvariacionNombre })`.
- `nodo-web/src/features/ventas/carritoStore.ts`:
  - `agregar(art, { talla?, cantidad?, subvariacionCodigo?, subvariacionNombre? })`.
  - El `key` del item en carrito incorpora `subvariacionCodigo` cuando
    aplique para no fusionar variaciones del mismo padre.
  - El `precio` del item siempre se toma de `padre.precioVenta`.
- `nodo-web/src/features/ventas/ventaService.ts`:
  - `crearVenta` persiste `subvariacionCodigo` y `subvariacionNombre` en
    cada `VentaArticulo` cuando aplique.
  - **Decremento de stock**: si la venta llevó subvariación, decrementar
    `padre.subvariaciones[i].cantidad`; si no, `padre.cantidad`.
- `nodo-web/src/features/ventas/CarritoPanel.tsx`,
  `ConfirmarVentaModal.tsx`, `TicketModal.tsx`:
  - Renderizar el código `v-NN-XXX` o el nombre de la subvariación en cada item.
- `admin-web/src/routes/ajustes/AjustesPage.tsx`:
  - Toggle "Activar subvariaciones v2" que escribe
    `negocio.usaSubvariacionesV2`. Aviso de "esto cambia el comportamiento
    del POS de inmediato".

**Criterio de aceptación**

(con `usaSubvariacionesV2 = true`)

- Escanear el id padre de un artículo con variaciones → rechazo visible
  con mensaje.
- Escanear `v-11-6Ad` → carrito recibe el item con `subvariacionCodigo` y
  `subvariacionNombre` poblados, precio del padre.
- Buscar por nombre del padre con variaciones → autocomplete muestra las
  variaciones, NO el padre.
- Confirmar venta → la `Venta` en Firestore tiene
  `articulos[i].subvariacionCodigo`.
- Stock: vender una subvariación decrementa
  `padre.subvariaciones[i].cantidad` (no `padre.cantidad`).
- Bajar `usaSubvariacionesV2` a `false` desde admin-web revierte el
  comportamiento del POS al modo legacy sin perder datos.

**Dependencias**

Fases 1 y 4.

**Riesgo**

Alto. Es la fase que toca el flujo productivo del POS. Activar la bandera
**solo** después de validar fase 4 en el negocio de pruebas.

**Bandera de retorno**

Bajar `negocio.usaSubvariacionesV2 = false` desde admin-web (o desde la
consola de Firestore). El POS vuelve al modo legacy sin restart. El revert
del código nodo-web es solo para deshacer cambios estructurales graves.

---

## Fase 6 — Módulo Ingreso de Mercancía + Reportes + Limpieza Legacy

**Objetivo**

Tres entregables independientes que cierran el proyecto:

1. Página `/ingreso-mercancia` en admin-web que escanea códigos y suma
   stock.
2. Reportes `BuscarPorArticuloPage` y `MasVendidosPage` reflejan
   subvariaciones (árbol por padre, despliegue de variaciones).
3. Limpieza final del esquema (borrar campos legacy `genero`, `subgenero`,
   `hashtags`).

**Tocar**

- `admin-web/src/features/ingreso-mercancia/` (nuevo):
  - `BarcodeScannerInput.tsx` — gemelo del scanner de nodo-web adaptado.
  - `useIngresoMercancia.ts` — hook que orquesta scan → resolver código
    (mismo algoritmo `v-NN-XXX` de Fase 1) → modal → confirmar suma.
  - `ingresoService.ts` — `sumarStock(articuloId, subvariacionCodigo?, delta)`
    y log opcional en `ingresos_mercancia/{id}` (collection nueva, opcional).
- `admin-web/src/routes/ingreso-mercancia/IngresoMercanciaPage.tsx` (nuevo)
  — UI principal con kiosk-mode (cadena de scans rápidos sin salir de la
  página).
- `admin-web/src/routes/reportes/BuscarPorArticuloPage.tsx`,
  `MasVendidosPage.tsx`:
  - **Árbol por padre**: agrupar resultados por `id` del padre. Si el
    padre tiene `subvariaciones?.length > 0`, expandirlo despliega filas
    por `subvariacionCodigo` con sus métricas (cantidad vendida,
    ingresos).
  - Filtros: por padre y opcionalmente por subvariación específica.
  - Ventas legacy sin `subvariacionCodigo` agrupan en una fila virtual
    "(sin variación)" bajo el padre.
- `shared/src/schema.ts`:
  - Borrar `Articulo.genero`, `Articulo.subgenero`, `Articulo.hashtags`
    (después de validar que la migración de Fase 3 quedó completa en
    producción).
- `functions/limpiarLegacy.js` (nuevo) — borra los campos legacy de los
  docs en Firestore (one-shot, no idempotente porque no hay nada que
  preservar).

**Criterio de aceptación**

- Escanear el id padre de un artículo simple → modal "sumar X al stock" →
  tras confirmar, `padre.cantidad` aumenta.
- Escanear `v-NN-XXX` → modal "sumar X al stock" de esa variación → tras
  confirmar, `padre.subvariaciones[i].cantidad` aumenta.
- Escanear el id padre de un artículo con variaciones → mensaje "elige la
  variación" o list de las variaciones del padre.
- Reportes muestran árbol por padre con expansión de variaciones; ventas
  legacy se agrupan en "(sin variación)".
- Tras correr la CF de limpieza: `genero`, `subgenero`, `hashtags` ya no
  existen en ningún artículo.
- Tras eliminar los tipos del schema: `npx tsc --noEmit` pasa porque ya
  no hay referencias.

**Dependencias**

- Fase 3 (etiquetas/categorías migradas en producción).
- Fase 5 (POS estable con subvariaciones v2 activado en al menos un
  negocio).

**Riesgo**

Bajo en lo nuevo (módulo aislado, reportes son lectura), medio en la
limpieza (borrado destructivo). Hacer la limpieza con backup completo de
Firestore previo.

**Bandera de retorno**

- Para el módulo de ingreso y los reportes: revert.
- Para la limpieza: el backup de Firestore previo es la única vuelta
  atrás. Sin él, los datos legacy se pierden.

---

## Notas operativas

### Pipeline de despliegue por fase

1. **Cloud Functions** primero (`firebase deploy --only functions`).
   Cualquier nueva CF debe estar viva antes que el UI que la llama.
2. **Reglas Firestore** (`firebase deploy --only firestore:rules`)
   antes de admin-web/nodo-web si las nuevas reglas habilitan permisos
   que el UI asume.
3. **admin-web** (`firebase deploy --only hosting:admin-web`).
4. **nodo-web** (`firebase deploy --only hosting:nodo-web`).
5. **Migraciones manuales**: dispararlas desde la UI de admin-web
   después del paso 3, una vez que el código nuevo esté vivo.

### Migraciones idempotentes

- Las CFs `migrarArticulosLegacy`, `migrarSubvariacionesLegacy`,
  `limpiarLegacy` son llamables desde admin-web vía `httpsCallable` con
  `timeout: 540_000`.
- Las dos primeras son idempotentes (re-ejecutar = no-op cuando ya
  migrado).
- `limpiarLegacy` es destructiva — backup obligatorio antes.

### Bandera `usaSubvariacionesV2`

- Vive en el doc del negocio (`paths.negocio(nid)`).
- Default `false` desde Fase 1.
- En admin-web se controla desde `AjustesPage` (Fase 5).
- En nodo-web se lee con el hook `useNegocio` (Fase 5).
- Bajarla a `false` revierte el POS al modo legacy sin restart.

### Backup pre-Fase-6

Backup completo de Firestore + Storage antes de correr `limpiarLegacy`.
Los datos `genero`/`subgenero`/`hashtags` se pierden permanentemente tras
la ejecución.
