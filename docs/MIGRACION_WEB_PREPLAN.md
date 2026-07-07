# Migración Web — Pre-Plan (nodo + dispositivo)

> Documento de análisis previo a la planificación de implementación.
> Scope: migrar las apps Android `nodo_1` y `dispositivo_1` a dos apps web distintas, con soporte multi-nodo / multi-sucursal y preservación del formato de datos (ventas, mensajes, artículos, cortes) en Firestore.
>
> **Fuera de scope**: la carpeta `dispositivo_1/mensajes/` (cliente Electron de mensajería).

---

## 0. TL;DR (lo crítico para alinearse)

1. **Dos apps web independientes**, mismo backend Firebase:
   - `nodo-web` → PWA para tablets — vendedor de sucursal (ventas + cortes + mensajes).
   - `admin-web` → PWA para PC/móvil — super admin (CRUD artículos + variantes + imágenes + vistas admin).
2. **Preservar schema de datos** en `ventas_n`, `mensajes_n`, `articulos_n`, `corte_1`. La lógica puede cambiar, pero los documentos deben ser legibles por cualquier cliente legacy aún vivo.
3. **Introducir multi-sucursal** como ciudadano de primera clase. Hoy **no existe** en el código. Propuesta: namespace por `negocioId/sucursalId` + marcar cada venta/corte/mensaje con `nodoId` + `sucursalId`.
4. **Arreglar la race condition** que hoy pierde ventas cuando dos nodos escriben simultáneamente. La solución mínima es `arrayUnion`; la solución robusta es "un documento por venta" bajo el día.
5. **Ya existe backend para multi-negocio** (Cloud Functions + reglas con `/negocios/{negocioId}/...`), pero ninguna app Android lo usa. La web **sí debe** usarlo desde el día uno.
6. **Ya existe `dispositivo_1/app-web/`** (PWA Vite) con chat + ventas read-only + mercancía CRUD. Hay que decidir: continuar sobre ese scaffold o empezar limpio. Recomendación: reaprovecharlo para `admin-web` y crear `nodo-web/` limpio.

---

## 1. Inventario de features por app

### 1.1 `nodo_1` (Android tablet → `nodo-web`)

Lo que hace hoy y debe seguir haciendo en web:

| Área | Archivos clave | A conservar |
|---|---|---|
| **Ventas** | `com/example/nodo_1/principal.java` (creación, líneas 1713-1922), `modulos_carga/subir_documento_sobre_fechas.java` (persistencia, 28-139) | Schema del registro de venta (§3.1), trigger `datos/ventas_ac.huella_venta` |
| **Cortes de caja** | `venta/corte.java` (18-35), `com/example/nodo_1/corte_hist.java` | Schema del corte (§3.4), path `corte_1/{y}/{m}/{d}` |
| **Mensajes** | `com/example/nodo_1/mandarPorMensaje.java` (25-150), `adapter/adap_mensajes.java` | Schema del mensaje (§3.3), `datos/mensajes_ac.huella_mensaje`, flags protocolo (`nuevoDia`, `inicioDeMes`, `inicioAño`) |
| **Pase de lista** | `pase_de_lista/actualizar_venta_mensaje_paseDeLista.java` (29-62), `modulos_descarga/mensajes.java` (688-741) | `notificar_de_reibido/{deviceId}.huella_mensaje` (confirmación de lectura cross-device) |
| **Lectura de artículos** | `modulos_descarga/articulos.java` (44-100) | Consumir `articulos_n/{id}` + `datos/articulos_ac` (read-only desde nodo) |
| **Identidad nodo** | `registro_dispositivo.java` (67-97) | UUID 9 chars en `datos/dispositivos_mensaje.{uuid}` con `tipoApp: "nodo"` |
| **Ajustes de venta** | `ajustes.java` (60-674) — switches, `datos/transferencia_datos`, `datos/equipoDeTrabajo` | Mismo schema |

Descartar: cámara barcode (`barcodeCamara/`), impresoras Bluetooth (`async/Async*Print`), reconocimiento facial MLKit, pop-ups Android, navigation entre activities, SharedPreferences.

### 1.2 `dispositivo_1` (Android admin → `admin-web`)

| Área | Archivos clave | Nota |
|---|---|---|
| **CRUD artículos** | `com/example/dispositivo_1/ingresoMercancia.java`, `editar_articulos.java`, `adapter/adapIngresoMercancia.java` (51-200), `adapter/adapEditarArticulo.java` | Incluye generador de ID secuencial (§3.2) |
| **Subvariaciones (imagen x variante)** | `adapter/adapSubvariacion.java`, `editar_articulos.java` (pop_subvariaciones.xml) | Ya existe. Schema §3.2 |
| **Tallas (grupos)** | `propiedades_articulos/tallas.java`, `agregar_tallas_etc.java` | Grupos compartidos referenciados por nombre |
| **Promociones** | `propiedades_articulos/mayoreo_articulos.java`, `tres_x_n.java`, `generarDescuento.java`, `seña.java` | Flags en el documento del artículo |
| **Vistas de ventas** | `com/example/dispositivo_1/ventas.java`, `adapter/adapterHistorialDos.java` (39-250) | Historial por día/mes/año, lectura |
| **Más vendidos** | `com/example/dispositivo_1/mas_vendidos.java` (~180-210), `adapter/adapMasvendidos.java` | Agregación client-side sobre `ventas_n` |
| **Consulta por artículo** | `com/example/dispositivo_1/buscar_por_id.java` | Filtra ventas por `articulos[].id` |
| **Vista por precios** | `propiedades_articulos/articulos_por_precio.java` | Filtro sobre `articulos_n` |
| **Cortes** | `com/example/dispositivo_1/corte.java` (43-88), `adapter/adap_corte_1.java` | Lee `corte_1/{y}/{m}/{d}` |
| **Apartados / abonos** | `modulos_descarga/apartados.java`, `adapter/adapterAbonos.java`, `pop/popAgrearAbonoAprtado.java` | Colección `apartados/{id}` + sync `datos/apartados_ac` |
| **Equipo de trabajo** | `com/example/dispositivo_1/equipo_de_trabajo.java` (127-147) | `datos/equipoDeTrabajo.{idUsuario}` |
| **Mensajería** | `com/example/dispositivo_1/mensaje_class.java`, `adap_mensajes.java`, `pop_mensajes.java` | Consumidor de `mensajes_n` (mismo que nodo) |
| **Push FCM** | `push/MyFirebaseMessagingService.java`, `push/EnviarNotificacionActivity.java`, Cloud Function `enviar` | Topic `negocio_{negocioId}` (o `"all"` legacy) |

Descartar: pop-ups Android (`pop/` 30+ archivos), barcode ZXing, teclado custom, sliding panels, adaptadores RecyclerView.

---

## 2. Decisiones arquitecturales críticas (requieren tu confirmación)

### 2.1 Modelo multi-sucursal / multi-nodo

**Problema**: hoy no existe el concepto. Todas las ventas de todos los dispositivos van al mismo path plano `ventas_n/{y}/{m}/{d}`. Dos nodos en sucursales distintas se mezclan.

**Propuesta** — modelo jerárquico en Firestore:

```
/negocios/{negocioId}/
├── sucursales/{sucursalId}                     ← metadata (nombre, dirección, teléfono)
│   └── nodos/{nodoId}                          ← registro de cada tablet
├── articulos_n/{artId}                         ← compartido entre sucursales del mismo negocio
├── datos/{docKey}                              ← ajustes, equipo, tallas, etc.
├── mensajes_n/{y}/{m}/{d}                      ← compartido entre sucursales (chat del negocio)
└── sucursales_data/{sucursalId}/
    ├── ventas_n/{y}/{m}/{d}                    ← ventas por sucursal
    ├── corte_1/{y}/{m}/{d}                     ← cortes por sucursal
    ├── apartados/{apartadoId}                  ← apartados por sucursal
    └── datos/{docKey}                          ← config por sucursal (datos de transferencia, etc.)
```

**Justificación**:
- Artículos y mensajes son del negocio (todo super-admin maneja un catálogo; chat es global).
- Ventas/cortes/apartados son de la sucursal (un super admin con 3 sucursales quiere los totales separados).
- Si un negocio tiene una sola sucursal, funciona igual.
- Las `firestore.rules` ya contemplan parcialmente `/negocios/{negocioId}/...` (ver líneas 49-146); hay que extenderlas con el nivel `sucursales_data`.

**Campos añadidos a cada documento** (sin cambiar los existentes):
- Venta individual: `nodoId`, `sucursalId` (ambos strings).
- Corte: `nodoId`, `sucursalId`, ya tiene `dispositivo` pero pasa a ser `nodoId`.
- Mensaje: ya tiene `id` (= deviceId); añadir `sucursalId` para filtrar vista por sucursal.

**Decisión abierta ❓**: ¿los artículos son por negocio (catálogo unificado) o por sucursal (cada sucursal con su inventario)? Hoy el código asume catálogo único. **Recomendación**: catálogo único con campo `stock[sucursalId] = cantidad` por sucursal → cambio mínimo al schema de artículo (solo se parte el campo `cantidad` en un map). Confirmar.

### 2.2 Concurrencia en ventas (bug actual crítico)

**Estado actual** (medido en código, no suposición):
- `modulos_carga/subir_documento_sobre_fechas.java:66-88` lee `jsonVenta` local, agrega la nueva venta al array `registro`, y hace `.update({registro: arrayCompleto})` — **sobreescribe** la versión del servidor.
- Si nodo A y nodo B venden simultáneamente en la misma sucursal el mismo día, la última escritura gana y **se pierde** la otra venta.

**Propuestas** (de menor a mayor cambio):

| Opción | Cambio | Coste | Riesgo residual |
|---|---|---|---|
| A. `arrayUnion` en el field `registro` | Mínimo — sustituir el `.update({registro: arr})` por `.update({registro: arrayUnion(nuevaVenta)})` | Bajo | Límite de 1 MB por documento → después de ~1000 ventas/día el doc revienta. Ya pasa hoy, solo que más tarde |
| B. **Un doc por venta** bajo `ventas_n/{y}/{m}/{d}/items/{ventaId}` | Cambio de schema — los lectores deben hacer subcollection query en vez de leer un solo doc | Medio | Ninguno. Escalable hasta ∞. Lecturas por día son N docs en vez de uno (aceptable con `onSnapshot` a la subcoleción) |
| C. Transacción (`runTransaction`) alrededor del append | Lee+modifica+escribe atómico | Alto (latencia por round-trip) | Resuelve race pero sigue con límite de 1 MB |

**Recomendación**: **Opción B** para el green-field web. Es la única que escala y la única que no sufre el límite de 1 MB. Requiere que el `admin-web` adapte su lógica de "Más vendidos" y "historial" para leer subcolecciones (trivial con `collectionGroup` o `collection(...).get()`).

**Decisión abierta ❓**: ¿romper compatibilidad del schema de ventas con los Android legacy? Si los Android seguirán corriendo en algún dispositivo → necesitamos Opción A como bridge (coexisten formato array y formato subcollection y admin-web lee ambos). Si se apagan al migrar → Opción B limpia.

### 2.3 Numeración de ventas y cortes

El número de venta hoy es secuencial por día (`numeroDeVenta = lenArray`) generado client-side. Con dos nodos → colisión.

**Propuesta**: transacción atómica sobre un contador en `negocios/{negocioId}/sucursales_data/{sucursalId}/contadores/{YYYY-MM-DD}` con campo `ultimoNumeroVenta`. Cada venta hace `runTransaction` → `numeroDeVenta = ultimoNumeroVenta + 1` → escribe incremento + la venta. Esto garantiza numeración única y monotónica por sucursal por día.

Misma estrategia para `idVenta_corte` y `idApartado` (contadores independientes).

### 2.4 Autenticación y roles

Las Cloud Functions existentes (`functions/index.js:81-116`) ya definen tres roles: `superadmin`, `admin`, `vendedor`. Las rules usan `request.auth.token.role` y `request.auth.token.negocioId` como custom claims.

**Propuesta**:
- `admin-web` exige `role == "superadmin"` o `role == "admin"` + matching `negocioId`.
- `nodo-web` exige `role == "vendedor"` + matching `negocioId` + `sucursalId` en custom claim (nuevo).
- Login vía Firebase Auth email/password (como ya está en `createUser` → `functions/index.js:165-207`). Google Sign-In opcional para admin.
- El super admin crea usuarios (vendedores) y los asigna a una sucursal desde `admin-web`. Cada tablet se loguea con las credenciales del vendedor.

**Decisión abierta ❓**: ¿un tablet = un usuario? ¿o un tablet compartido con selector de vendedor para cada venta? Hoy `ajustes.java:2194-2199` guarda un "equipo de trabajo" y cada venta lleva `enTurno` (nombre libre), lo que sugiere lo segundo. **Recomendación**: conservar este modelo — el tablet se loguea con una cuenta-sucursal, y cada venta pide/selecciona al vendedor del `equipoDeTrabajo` para el campo `enTurno`.

### 2.5 Identidad del nodo web

Hoy el UUID 9-char se genera una vez y queda en SharedPreferences (`registro_dispositivo.java:67-97`). En web, el equivalente natural es `localStorage["nodoId"]` generado en primera visita y registrado en `negocios/{negocioId}/sucursales/{sucursalId}/nodos/{nodoId}`.

**Riesgo**: si el usuario limpia storage o cambia de navegador, pierde identidad. Solución: el primer login del vendedor pide confirmación ("¿este es un nuevo nodo o es el 'Caja 2' existente?") y ofrece fusionar.

### 2.6 Imágenes

- Principal: `media/articulos/{id}.{ext}` ya existe (§3.2).
- Por variante: `media/articulos/{id}_sv{idx}.{ext}` ya existe (§3.2).
- **Cap 5 MB** ya en `storage.rules`.
- **Recomendación web**: compresión client-side a WebP si > 2 MB (canvas + `toBlob`). Ya está contemplado en el `PLAN_APP_WEB.md` existente.

---

## 3. Schemas a preservar (contrato con Android legacy y backend)

Esta sección es **normativa**. Cualquier escritura desde web debe cumplirla.

### 3.1 Venta — `registro[]` en `ventas_n/{año}/{mes}/{día}`

Path año/mes/día en **sin padding** (`2026/3/15`, no `2026/03/15`). El Android usa ambos formatos inconsistentemente; el `PLAN_APP_WEB.md` existente lo documenta (§ventas.js).

Objeto de venta:

```json
{
  "numeroDeVenta": "0",                    // string, secuencial del día (usar contador transaccional §2.3)
  "id_registro": "2026 3 15",              // string "año mes día" con espacios, sin cero-padding
  "huella": "20260315162045789",           // string, timestamp ms (generarID())
  "enTurno": "Carlos",                     // nombre del vendedor (del equipoDeTrabajo)
  "montoCobro": "2500",                    // string, total
  "montoPago": "3000",                     // string, lo que entregó el cliente
  "cambio": "500",                         // string
  "movimiento": "pagoEfectivo",            // "pagoEfectivo"|"pagoTransferencia"|"pagoTarjeta"|"pagoDividido"
  "articulos": [
    {
      "id": "12300001",
      "cantidad": "2",
      "precio": "500",                     // o "precioVenta" — revisar inconsistencia
      "nombrePublico": "Camiseta",
      "descripcion": "Ref XYZ",
      "talla": "M",                        // opcional
      "seña": "100",                       // opcional (apartado con seña)
      "descuento": "50"                    // opcional
    }
  ],
  "apartado": "0",                         // "0" normal, "1" apartado
  "idApartado": "",                        // presente si apartado == "1"
  "fecha": "15 mar. 2026 4:20:45 p. m.",   // string localizado Android
  "datosPagoDividido": { ... }             // solo si movimiento == "pagoDividido" (subfield)
}
```

**Campos nuevos a añadir** (retrocompatibles — Android ignora desconocidos):
- `nodoId`, `sucursalId` (strings).
- Opcionalmente `fechaISO` (timestamp ISO 8601) en paralelo a `fecha` para facilitar queries web.

### 3.2 Artículo — `articulos_n/{id}`

```json
{
  "id": "12300001",                        // secuencial base 12300001 (§ adapIngresoMercancia.java:51-65)
  "nombre": "Camiseta Básica",
  "sigla": "CB",                           // única, 2-3 caracteres
  "referencia": "CAM-001",
  "codigo": "12300001",                    // = id
  "cantidad": "50",
  "preciCompra": "50.00",                  // ojo: typo histórico ("preciCompra" no "precioCompra")
  "precioVenta": "100.00",
  "utilidad": "50.00",                     // = precioVenta - preciCompra
  "utilidadTotal": "2500.00",              // = utilidad * cantidad
  "genero": "Unisex",
  "subgenero": "Casual",
  "hashtags": "#casual #comfort",
  "fecha": "2026-03-15 10:30:45",
  "imagenUrl": "https://...",              // Storage download URL
  "tallas": "Camisetas",                   // referencia al grupo en datos/tallas
  "seña": "",                              // presencia = true, acepta seña
  "3x2": "",                               // presencia = true
  "mayoreo": "75.00",                      // precio unitario por cantidad
  "cantMayoreo": "10",                     // cantidad mínima
  "descuento": "10",                       // % descuento
  "promoBandera": "1",
  "subvariaciones": [
    { "id": 0, "nombre": "Vista frontal", "imagenUrl": "https://.../{id}_sv0.webp" },
    { "id": 1, "nombre": "Azul", "imagenUrl": "https://.../{id}_sv1.webp" }
  ]
}
```

**Campos nuevos propuestos** (para multi-sucursal):
- `stockPorSucursal: {sucursalId: cantidadInt}` (reemplaza o complementa `cantidad`). Si se decide catálogo único por negocio con stock por sucursal.

### 3.3 Mensaje — `mensajes[]` en `mensajes_n/{año}/{mes}/{día}`

```json
{
  "texto": "Mensaje de alerta",
  "hora": "4:20:45 p. m.",                 // localizado, no ISO
  "usuario": "Admin",
  "id": "abc123def",                       // deviceId (9 chars)
  "corte": "",                             // referencia a corte si aplica
  "huella": "20260315162045789",
  "nuevoDia": "15",                        // flag protocolo — SOLO en el primer mensaje del día
  "inicioDeMes": "3",                      // flag — SOLO en el primer mensaje del mes
  "inicioAño": "2026"                      // flag — SOLO en el primer mensaje del año
}
```

Los flags `nuevoDia` / `inicioDeMes` / `inicioAño` son **críticos** — los consumidores (Android + Electron) los usan para separar secciones en la UI. Web debe preservarlos (`app-web/src/chat.js` ya lo hace — `PLAN_APP_WEB.md` línea 186).

Trigger: `datos/mensajes_ac.huella_mensaje` (string). Escribir nueva huella después de cada append.

Confirmación: `notificar_de_reibido/{deviceId}.huella_mensaje` — cada cliente marca la última huella que leyó (pase de lista).

### 3.4 Corte — `registro[]` en `corte_1/{año}/{mes}/{día}`

```json
{
  "estado": "corte_iniciar",               // "corte_iniciar" | "corte_enCurso" | "corte_finalizado"
  "idVenta_corte": "2026-3-15-5",          // apunta a el numeroDeVenta donde se cerró
  "nombre_corte": "Corte Jesus",
  "fecha_inicio": "2026-03-15 10:00:00",
  "fecha_fin": "2026-03-15 18:30:00",
  "totalEfectivo": "10000",
  "totalTransferencia": "5000",
  "totalTarjeta": "3000",
  "totalGeneral": "18000",
  "dispositivo": "abc123def"               // = nodoId
}
```

Añadir `sucursalId` al campo raíz.

Trigger: `datos/ventas_ac.huella_venta` (mismo que ventas — un solo trigger cubre ambos).

### 3.5 Apartado — `apartados/{apartadoId}`

```json
{
  "cliente": "Juan Pérez",
  "telefonoCliente": "555-1234",
  "articulos": [...],
  "seña": 200.00,
  "totalApartado": 1500.00,
  "abonos": [
    { "fecha": "2026-03-15", "monto": 200.00, "estado": "pagado", "tipo": "seña" },
    { "fecha": "2026-03-22", "monto": 500.00, "estado": "pagado", "tipo": "abono" }
  ],
  "estado": "pendiente",                   // "pendiente"|"parcial"|"completo"|"cancelado"
  "fechaCreacion": "2026-03-15",
  "huella": "..."
}
```

Añadir `sucursalId`.

Trigger: `datos/apartados_ac.huella_apartado` + array per-device (mismo patrón que artículos — ver `modulos_descarga/apartados.java`).

### 3.6 Identidad del dispositivo — `datos/dispositivos_mensaje.{uuid}`

```json
{
  "nombre_dispositivo": "Caja 1",
  "nombre_Sucursal": "Tienda Central",     // hoy string libre → pasa a ser sucursalId
  "nombre_PersonaQueIngreso": "Jesus",
  "marca dispotitivo": "Samsung",          // (sí, typo histórico)
  "modelo dispotitivo": "Galaxy Tab A",
  "fechaRegistro": "24/04/2026 10:30:15",
  "id": "abc123def",
  "nodo": "abc123def",                     // = id
  "androidId": "...",                      // en web: poner null o userAgent hash
  "tipoApp": "nodo"                        // "nodo" | "dispositivo"
}
```

### 3.7 Protocolo de sync de artículos — `datos/articulos_ac`

```json
{
  "huella": "20260315162045789",
  "12300001": [
    { "abc123def": false },                // nodoId → flag procesado
    { "xyz789ghi": true }
  ]
}
```

Cuando todos los nodos del negocio/sucursal están `true`, se elimina la entry (no toda la colección — solo la entry del artículo). Si la entry queda vacía → el Android borra el doc `articulos_ac` completo (§ `modulos_descarga/articulos.java:44-100`). Web debe seguir el mismo protocolo (ya documentado en `PLAN_APP_WEB.md` §S6).

---

## 4. Stack propuesto

### 4.1 `nodo-web` (tablet vendedor)

| Capa | Elección | Justificación |
|---|---|---|
| Bundler | Vite 5 | Dev rápido, PWA plugin maduro |
| Framework | Preact o Vanilla JS con Web Components | Nodo es simple (ventas + cortes + mensajes). Si reusamos el scaffold `app-web/`, es vanilla. Aceptable |
| UI | Tailwind CSS + componentes a mano | Tablet: botones grandes, grid-based numpad |
| State | Signals (preact/signals) o stores manuales | Reactividad suficiente sin Redux |
| Offline | Firestore persistence + Service Worker (Workbox via vite-plugin-pwa) | Ya validado en `app-web/` |
| Concurrencia | `arrayUnion` puente + migrar a doc-por-venta | Ver §2.2 |
| Input | Teclado numérico nativo (`inputmode="decimal"`), scanner opcional vía WebUSB o `html5-qrcode` | `BarcodeDetector` API si disponible |

**Mínimo navegador**: Chrome 90+ en tablet Android, Safari 15+ en iPad.

### 4.2 `admin-web` (super admin PC/móvil)

| Capa | Elección | Justificación |
|---|---|---|
| Bundler | Vite 5 | |
| Framework | **React 18** o seguir vanilla | React conviene por la densidad de componentes (formularios con subvariaciones, tallas, promos). El `dispositivo_1/app-web/` que ya existe parece mezclar ambos — revisar antes de decidir |
| UI | Tailwind + Radix UI (unstyled primitives) o Shadcn | Admin tiene tablas, modales, drag-drop imagen |
| State | Zustand o React Query (TanStack Query) + signals | Cache de `articulos_n` |
| Tablas | TanStack Table | Para "más vendidos", historial ventas |
| Gráficas | Recharts o Chart.js | "Vista por precios", reportes |
| Offline | Firestore persistence (admin no necesita offline profundo — trabaja con red) | |
| Deploy | Firebase Hosting, mismo proyecto `amisetienda-c7eab` | Ya configurado en `dispositivo_1/app-web/firebase.json` |

**Decisión abierta ❓**: mantener `app-web/` (vanilla Vite) y renombrarlo a `admin-web/`, o empezar nuevo en React? Si las features pendientes (subvariaciones, tallas, apartados, equipo, cortes, gráficas) son muchas → React vale la pena. Si el vanilla ya cubre 60% → continuar.

### 4.3 Backend compartido

- **Firebase project**: `amisetienda-c7eab` (ya en `google-services.json`).
- **Firestore rules**: extender `firestore.rules` con el nivel `sucursales_data` bajo `negocios/{negocioId}/`, y bloquear escrituras legacy root (`ventas_n/{path=**}`) para forzar tráfico al nuevo namespace. Coexistencia temporal: rules permiten ambas pero los clientes nuevos solo escriben en `/negocios/...`.
- **Cloud Functions**: ya existen `createBusiness`, `setCustomClaims`, `assignUserToBusiness`, `checkSubscriptionLimits`, `enviar`, `createUser`. Añadir:
  - `createSucursal(negocioId, nombre, direccion)` — crea doc + contadores iniciales.
  - `createNodo(negocioId, sucursalId, nombre)` — registra tablet y devuelve `nodoId`.
  - `registrarVenta(negocioId, sucursalId, nodoId, venta)` — opcional; server-side para robustecer el contador secuencial y race protection. **Recomendado** porque protege contra clients maliciosos y centraliza numeración.
- **Storage rules**: ya capean 5 MB; añadir scoping por `negocioId` si se quiere aislamiento.
- **FCM**: `enviar` ya usa topic `negocio_{negocioId}` (functions/index.js:58). Web-admin usa esto, nodo-web se suscribe al topic.

---

## 5. Mecanismos de concurrencia & consistencia (detalle)

### 5.1 Numeración de venta

Escritura de venta con transacción:

```js
await runTransaction(db, async (tx) => {
  const contadorRef = doc(db, `negocios/${negocioId}/sucursales_data/${sucursalId}/contadores/${ymd}`);
  const snap = await tx.get(contadorRef);
  const prev = snap.exists() ? snap.data().ultimoNumeroVenta : -1;
  const numeroDeVenta = (prev + 1).toString();

  const ventaRef = doc(collection(db, `negocios/${negocioId}/sucursales_data/${sucursalId}/ventas_n/${y}/${m}/${d}/items`));
  tx.set(ventaRef, { ...venta, numeroDeVenta, nodoId, sucursalId });
  tx.set(contadorRef, { ultimoNumeroVenta: prev + 1 }, { merge: true });
});
```

Con Opción B (doc-por-venta) no necesitamos `arrayUnion`; cada venta es un documento autónomo bajo `items/`. Si no se toma Opción B, sustituir por `arrayUnion` + numeración derivada del tamaño del array (race pequeña pero aceptable ~ millisegundos).

### 5.2 Huella (trigger de sync)

Después de escribir una venta, escribir también `datos/ventas_ac.huella_venta = generarID()` con `set(..., {merge: true})`. Los nodos escuchan este doc con `onSnapshot`; cuando la huella cambia, sincronizan el día actual. Este mecanismo **ya existe y funciona** — solo hay que replicarlo.

### 5.3 Artículos — sync distribuido

Protocolo del Android (documentado en `PLAN_APP_WEB.md` §S6 y `modulos_descarga/articulos.java:44-100`):

1. Admin edita artículo → escribe `articulos_n/{id}` + `datos/articulos_ac.{id} = [{deviceId1: false}, {deviceId2: false}, ...]` con flags falso para todos los dispositivos registrados, excepto el propio que queda `true`.
2. Cada nodo escucha `datos/articulos_ac` — al ver su flag en false:
   - Descarga `articulos_n/{id}`.
   - Marca su flag a `true`.
   - Si todos los flags ya son `true` → elimina la entry `{id}` del doc.
   - Si no quedan entries → elimina `datos/articulos_ac` completo.

Web debe implementar idéntico, **incluido el registro del `webNodoId` en `datos/dispositivos_mensaje` al primer login** — si no, Android/Electron no saben que debe recibir el cambio y quedan las entries fantasma.

---

## 6. Plan de fases propuesto (alto nivel — se detallará en plan principal tras confirmación)

Cada fase se puede pausar para validar.

### Fase 0 — Decisiones y setup (días)
- Confirmar decisiones abiertas §2 (multi-sucursal, concurrencia opción A vs B, stock por sucursal, admin-web React vs vanilla).
- Extender `firestore.rules` con `sucursales_data` y bloquear rutas legacy root en writes (read-only para consumidores antiguos).
- Implementar/actualizar Cloud Functions: `createSucursal`, `createNodo`, `registrarVenta` (opcional pero recomendado).
- Seed: crear "negocio 0" con 1 sucursal default, migrar `articulos_n` y `datos/equipoDeTrabajo` legacy al namespace nuevo (script one-shot).

### Fase 1 — `nodo-web` MVP (semanas)
- Login vendedor (email/password), guardar nodoId en localStorage.
- UI ventas: selector vendedor (equipoDeTrabajo), búsqueda artículo, carrito, pagos (efectivo/transferencia/tarjeta/dividido), cobro.
- Escritura de venta vía transacción + `arrayUnion` o doc-por-venta (según §2.2).
- Mensajería (lectura + escritura, preservando flags protocolo).
- Cortes de caja (iniciar, en curso, finalizar).
- PWA instalable en tablet.

### Fase 2 — `admin-web` MVP (semanas)
- Login super admin.
- Gestión de negocios + sucursales + nodos (crear, asignar, dar de baja).
- Gestión de usuarios (vendedores) y equipo de trabajo.
- CRUD artículos con subvariaciones, tallas, mayoreo, 3x2, descuento, seña.
- Upload imagen principal + por subvariación con compresión WebP.
- Historial ventas por sucursal, filtros (día/mes/año/vendedor/forma de pago).
- Mensajería.

### Fase 3 — Reportes admin (semana)
- Más vendidos por rango.
- Consulta venta por artículo (`buscar_por_id`).
- Vista por precios.
- Historial de cortes.
- Apartados + abonos (lectura + gestión).

### Fase 4 — Polish y deploy
- Reglas Firestore finales (bloquear writes legacy root, limitar por custom claims).
- Storage rules con cap 5 MB verificado.
- FCM push para mensajes (topic por negocio).
- Deploy a Firebase Hosting con sitios separados: `nodo.{dominio}` y `admin.{dominio}`.
- Script de migración de datos legacy si hay data histórica en las rutas planas.

---

## 7. Matriz de referencias — dónde está cada cosa en el código Android

Para implementación, cuando haya dudas de semántica, consultar:

| Duda | Archivo | Línea |
|---|---|---|
| Cómo se crea una venta y sus campos | `nodo_1/app/src/main/java/com/example/nodo_1/principal.java` | 1713-1922 |
| Cómo se sube a Firestore | `nodo_1/app/src/main/java/modulos_carga/subir_documento_sobre_fechas.java` | 28-139 |
| Cómo se escribe la huella de venta | `nodo_1/app/src/main/java/pase_de_lista/actualizar_venta_mensaje_paseDeLista.java` | 29-62 |
| Cómo se genera `huella` | `nodo_1/app/src/main/java/com/example/nodo_1/editar_articulos.java` | `generarID()` |
| Cómo se descargan ventas | `nodo_1/app/src/main/java/modulos_descarga/ventas.java` | 60-310 |
| Corte init / estados | `nodo_1/app/src/main/java/venta/corte.java` | 18-35 |
| Crear mensaje + flags protocolo | `nodo_1/app/src/main/java/com/example/nodo_1/mandarPorMensaje.java` | 25-150 |
| Descarga mensajes / pase de lista | `nodo_1/app/src/main/java/modulos_descarga/mensajes.java` | 58-300, 688-741 |
| Sync protocol artículos | `nodo_1/app/src/main/java/modulos_descarga/articulos.java` | 44-100 |
| Generador ID secuencial 12300001 | `dispositivo_1/app/src/main/java/adapter/adapIngresoMercancia.java` | 51, 58-65 |
| Validaciones required artículo | `dispositivo_1/app/src/main/java/adapter/adapIngresoMercancia.java` | 129-177 |
| Upload imagen principal | `dispositivo_1/app/src/main/java/com/example/dispositivo_1/ingresoMercancia.java` | 114-125 |
| Subvariaciones | `dispositivo_1/app/src/main/java/adapter/adapSubvariacion.java` | (archivo completo) |
| Schema apartado + abonos | `dispositivo_1/app/src/main/java/modulos_descarga/apartados.java` | (archivo completo) |
| Reportes más vendidos | `dispositivo_1/app/src/main/java/com/example/dispositivo_1/mas_vendidos.java` | ~180-210 |
| Consulta por artículo | `dispositivo_1/app/src/main/java/com/example/dispositivo_1/buscar_por_id.java` | (archivo completo) |
| Equipo de trabajo | `dispositivo_1/app/src/main/java/com/example/dispositivo_1/equipo_de_trabajo.java` | 127-147 |
| Registro dispositivo UUID 9ch | `nodo_1/app/src/main/java/com/example/nodo_1/registro_dispositivo.java` | 67-97 |
| Ajustes + switches + transferencia_datos | `nodo_1/app/src/main/java/com/example/nodo_1/ajustes.java` | 60-674, 515-525 |
| Cloud Functions actuales | `dispositivo_1/functions/index.js` | 58, 81-116, 121-160, 165-207, 213-253, 258-349 |
| Firestore rules actuales | `dispositivo_1/firestore.rules` | 49-146 (multi-negocio), 154-174 (legacy) |
| Storage rules | `dispositivo_1/storage.rules` | 24-44 |
| PWA ya iniciada | `dispositivo_1/app-web/` | ver `PLAN_APP_WEB.md` |

---

## 8. Decisiones abiertas — requieren respuesta antes del plan principal

Recopiladas de §2 más otras que surgieron:

1. **[§2.1] Stock**: ¿catálogo único por negocio con `stockPorSucursal: {sucursalId: qty}`, o artículos separados por sucursal?
2. **[§2.2] Concurrencia**: ¿Opción A (`arrayUnion`, compatible con Android) o Opción B (doc-por-venta, clean break)? Depende de si los Android siguen vivos después de la migración.
3. **[§2.4] Tablet vendedor**: ¿un login por tablet con selector de vendedor por venta (como hoy), o login individual por vendedor en cada venta?
4. **[§4.2] Admin-web**: ¿React (nuevo) o continuar vanilla desde `app-web/`?
5. **[Pregunta nueva] `dispositivo_1/app-web/`**: ¿pasa a ser el nuevo `admin-web` o se descarta? Ya tiene chat + ventas read-only + CRUD artículos + PWA deploy funcionando.
6. **[Pregunta nueva] Datos legacy**: ¿hay data histórica en `ventas_n`, `mensajes_n`, `articulos_n` planos que haya que migrar al namespace `/negocios/{id}/...`? Si sí, ¿cuánta?
7. **[Pregunta nueva] Android sunset**: ¿los Android siguen operando en paralelo o se apagan con el lanzamiento? Determina el grado de backward-compat que necesitamos.
8. **[Pregunta nueva] Dominio y branding**: ¿dominios separados (nodo.x.com, admin.x.com), subpath (/nodo, /admin), o dos sitios Firebase Hosting distintos?
9. **[Pregunta nueva] Escaneo de códigos de barras**: ¿necesario en nodo-web para tablet? Android usa cámara + ZXing. Web: `BarcodeDetector` API (limitado a Chrome Android) o `html5-qrcode`. Si no es crítico, postponer.
10. **[Pregunta nueva] Ticket / impresión**: Android imprime por Bluetooth (`async/AsyncBluetoothEscPosPrint.java`). Web no tiene acceso nativo a Bluetooth serial. Alternativas: Web Bluetooth API (solo Chrome), servidor local por puerto USB, o imprimir PDF desde el navegador (peor UX). **¿Qué se necesita en el día 1?**

---

## 9. Qué produce este documento

Este es el **pre-plan**: el análisis exhaustivo del código actual, la propuesta de schema objetivo, y la lista de decisiones pendientes.

**Siguiente paso sugerido**: responder las 10 preguntas de §8 (aunque sea con "sí/no/escoge A") y, con eso en mano, generar el **plan principal** que detalle archivo a archivo la estructura de `nodo-web/` y `admin-web/`, las migraciones de rules/functions, y los criterios de aceptación por fase.
