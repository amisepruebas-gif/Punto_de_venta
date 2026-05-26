# POS Web → APK Android (WebView + bridge nativo)

> Plan de auditoría y migración para envolver el POS web (`nodo-web`) en una
> APK Android que reuse el código de hardware del proyecto `nodo_1`.
> Generado: 2026-04-25. **No hay código todavía** — esto es contrato.

## Scope confirmado por el usuario (2026-04-25)

| Hardware | En scope | Notas |
|---|---|---|
| Impresora **Bluetooth** (tickets, ESC/POS) | ✅ Sí | Reutilizar `pagoTarjeta/uno.java` + lib DantSu. |
| Impresora **USB** etiquetas/stickers (TSPL) | ✅ Sí | Histórico de problemas — el usuario la modificará en el futuro; el bridge debe quedar maleable. |
| **Scanner USB HID** | ❌ No requiere bridge | El scanner inyecta el código + Enter en el input enfocado. La web ya lo maneja (input enfocado en `BuscadorArticulo`). Cero código nativo. |
| **Cámara para fotos** (chat, otros) | ✅ Sí (nuevo) | Requisito nuevo — no existe ni en `nodo_1` ni en `nodo-web` actual. Se añade al contrato del bridge. |
| Cajón registradora, balanza, NFC, banda magnética, terminal de tarjeta | ❌ No | Fuera de scope. |

---

## Fase 1 — Auditoría del proyecto Android (`nodo_1`)

### 1.1 Hardware integrado y dónde vive

| Hardware | Tecnología | Clases / archivos relevantes | Acoplamiento |
|---|---|---|---|
| **Impresora térmica** | ESC/POS por Bluetooth — lib `com.github.DantSu:ESCPOS-ThermalPrinter-Android:3.3.0` | `async/AsyncEscPosPrint.java` (core), `async/AsyncBluetoothEscPosPrint.java` (wrapper BT), `async/AsyncEscPosPrinter.java` (data holder), `pagoTarjeta/uno.java` (formato del ticket + `selectedDevice_static`) | **Bajo.** El `BluetoothConnection` es estático en `pagoTarjeta.uno.selectedDevice_static`; cualquier Activity puede dispararla. La selección/MAC se persiste en `SharedPreferences("MyAppSettings", "SelectedPrinterMAC")`. |
| **Impresora de etiquetas** | TSPL por USB (Android `UsbManager` + `bulkTransfer`) | `com/example/nodo_1/principal.java` líneas 1230-1410 | **Alto.** Toda la lógica vive dentro de la Activity `principal`. Vendor/Product ID en `SharedPreferences` (`vendorId`, `productId`). Debe extraerse a un manager. |
| **Scanner barcode (cámara)** | `com.journeyapps:zxing-android-embedded:4.3.0` con Activity custom `MyCaptureActivity` | `barcodeCamara/MyCaptureActivity.java` + `IntentIntegrator` desde múltiples activities | **Bajo.** Se invoca por Intent y devuelve por `onActivityResult`. |
| **Scanner barcode (USB HID)** | Teclado virtual — el lector inyecta caracteres + Enter en el campo enfocado | Listeners `setOnKeyListener()` sobre `AutoCompleteTextView` (`principal.java:2061-2077`). Resolución vía `resolverCodigo()` (línea 2093) | **Medio.** Depende de qué view tenga foco. Re-arquitectable a "global key sniffer" en la Activity. |
| **Caja registradora** | No implementado. ESC/POS soporta el comando `0x1B 0x70` por el puerto RJ11 de la impresora pero el código no lo manda. | — | — |
| **Tarjeta de pago** | SDK `payclip` listado pero **comentado** en `build.gradle` líneas 47-48. | — | Inactivo. |
| Balanza, NFC, banda magnética | No encontrado. | — | — |

### 1.2 Arquitectura de Activities

Activities relevantes en `com.example.nodo_1`:

```
initLog                  — launcher
principal                — POS de venta (la pantalla principal)
ventas                   — historial de ventas
admin / administrador    — configuración
ajustes                  — settings
ingresoMercancia         — alta de stock
editar_articulos         — alta/edición catálogo
registro_dispositivo     — first-run
buscar_por_id            — búsqueda
pedidos                  — apartados
equipo_de_trabajo        — equipo
corte_hist               — historial corte
vistaArticulosTodos      — catálogo
```

Servicios: `ChatHeadService` (UI flotante, no hardware), `MyFirebaseMessagingService` (push, no hardware).

Helpers / managers: `generales.java` (BT enum + MAC storage en `SharedPreferences`), `pagoTarjeta/uno.java` (estado estático del printer y format del ticket).

### 1.3 Dependencias relevantes (`nodo_1/app/build.gradle`)

- `com.github.mik3y:usb-serial-for-android:3.8.1` — usado mínimamente; el USB real se hace con `UsbManager` directo.
- `com.github.DantSu:ESCPOS-ThermalPrinter-Android:3.3.0` — impresora BT.
- `com.google.zxing:core:3.3.3` — decoding.
- `com.journeyapps:zxing-android-embedded:4.3.0` — UI cámara scanner.
- `minSdk 24` (Android 7.0), `targetSdk 34` (Android 14).

### 1.4 Permisos (`AndroidManifest.xml`)

```
BLUETOOTH, BLUETOOTH_ADMIN
BLUETOOTH_CONNECT, BLUETOOTH_SCAN, BLUETOOTH_ADVERTISE   (12+)
ACCESS_COARSE_LOCATION, ACCESS_FINE_LOCATION             (BT discovery)
INTERNET
POST_NOTIFICATIONS, VIBRATE
READ_MEDIA_IMAGES, READ_EXTERNAL_STORAGE, WRITE_EXTERNAL_STORAGE (≤32)
```

Faltan:
- `CAMERA` no está en manifest (zxing pide en runtime; se debe añadir).
- `usb-feature` no declarado; UsbManager funciona sin él pero conviene declararlo.

---

## Fase 2 — Plan de migración

### 2.1 Recomendación de estructura del repo

**Recomendado: agregar un módulo Gradle nuevo al repo existente `nodo_1`**, no fork ni app separada.

```
nodo_1/                              ← repo actual
├── app/                             ← APK Android original (queda intacto)
├── hardware/   (nuevo módulo lib)   ← código reusable extraído
│     ├── PrinterBluetooth.java      (ESC/POS BT — del actual `pagoTarjeta/uno`
│     │                                + `async/AsyncEscPosPrint`)
│     ├── PrinterUsbLabel.java       (TSPL — extraído de `principal.java`)
│     ├── TsplBuilder.java           (helpers de comandos TSPL)
│     └── CaptureFoto.java           (CameraX activity + helpers)
└── webview-pos/   (nuevo módulo APK) ← APK nueva que envuelve la web
      ├── MainActivity.java          (WebView + lifecycle)
      ├── PosBridge.java             (@JavascriptInterface)
      ├── FotoActivity.java          (CameraX preview launched by bridge)
      └── AndroidManifest.xml
```

> No incluido en `:hardware`: scanner USB HID (no requiere código nativo)
> ni `MyCaptureActivity` (zxing-cam — la web cubre cámara-scan por sí
> misma).

**Por qué no fork:** duplicaría dependencias y divergencia inevitable.
**Por qué no app separada del cero:** habría que copiar el código de hardware → bug-for-bug.
**Por qué módulo de librería + APK nueva:**
- `:hardware` queda compartido entre `:app` (POS Android original) y `:webview-pos` (POS web envuelto).
- Las dos APK se compilan independientes y conviven en el mismo proyecto Gradle.
- Cuando arreglas un bug en `:hardware`, se arregla para las dos.

**Trade-off:** hay que tocar `:app` para que importe `:hardware` en lugar de tener el código inline. Es trabajo, pero acotado y deja a `:app` operativo.

### 2.2 Contrato del bridge JS ↔ Native

Restricción: `@JavascriptInterface` solo soporta `String`, `boolean`, `int`, `long`, `double`. **Patrón obligado: JSON-in / JSON-out** para datos complejos. Eventos asíncronos van por `webView.evaluateJavascript()`.

**Namespace global:** `window.POS`. Las funciones síncronas devuelven JSON string; las que tardan (impresión) son async — devuelven inmediatamente un `requestId` y emiten un evento al terminar.

#### Métodos síncronos (consulta + selección)

```ts
// Detecta si el bridge está disponible (la web usa esto para fallback).
window.POS.disponible(): "true" | "false"

// Versión del bridge — útil para feature-detection futura.
window.POS.version(): string  // "1.0.0"

// Lista impresoras Bluetooth ya emparejadas al sistema.
window.POS.listarImpresorasBluetooth(): string
// → JSON: { ok: true, dispositivos: [{ mac, nombre, conectada }] }
//   o    { ok: false, error: "BT_DESACTIVADO" | "PERMISO_DENEGADO" }

// Selecciona la impresora a usar (la guarda en SharedPreferences).
window.POS.seleccionarImpresoraBluetooth(jsonInput: string): string
// jsonInput: { mac: "AA:BB:CC:DD:EE:FF" }
// → { ok: true } o { ok: false, error }

// Lista dispositivos USB conectados (para escoger impresora etiquetas).
window.POS.listarDispositivosUsb(): string
// → { ok: true, dispositivos: [{ vendorId, productId, nombre, conPermiso }] }

// Selecciona impresora USB para etiquetas TSPL.
window.POS.seleccionarImpresoraUsb(jsonInput: string): string
// jsonInput: { vendorId: 1234, productId: 5678 }
// → { ok: true } — NOTA: dispara permisos USB Android (modal nativa)

// Estado actual.
window.POS.estado(): string
// → { ok: true, impresoraBT: { mac?, nombre?, conectada }, impresoraUSB: {...},
//     scannerHidActivo: bool, bandera: { multipleImpresoras: bool } }
```

#### Métodos async (requestId + evento)

```ts
// Imprime un ticket. Devuelve requestId inmediatamente; el resultado llega
// vía `window.POS.onPrintResult(requestId, jsonResult)`.
window.POS.imprimirTicket(jsonInput: string): string
// jsonInput shape (espejo del template ESC/POS):
// {
//   formato: "[L]Hola[C]Mundo[R]Total\n",   // string ESC/POS pre-armado
//   abrirCajon?: bool                         // dispara 0x1B 0x70 al final
// }
// devuelve sincronamente: { ok: true, requestId: "r-1234" }
// luego (en evento): { requestId, ok: bool, error?, codigoError? }

// Imprime una etiqueta TSPL (precio).
window.POS.imprimirEtiqueta(jsonInput: string): string
// jsonInput: { tspl: "SIZE 29 mm, 14 mm\nGAP ...\n", copias: 1 }
// devuelve: { ok, requestId }

// Abre el cajón vía la impresora BT (si tiene puerto RJ11).
window.POS.abrirCajon(): string
// → { ok, requestId }
```

#### Métodos async — Cámara

```ts
// Toma una foto usando la cámara nativa de la tablet.
// Para los casos que la web ya cubre (BarcodeDetector / zxing-browser
// para escaneo) NO se usa este método — solo para CAPTURA de imagen
// para subir (chat, reporte, identificación, etc.).
window.POS.tomarFoto(jsonInput: string): string
// jsonInput: {
//   facing?: "front" | "back",            // default "back"
//   maxLado?: number,                     // default 1600 px (lado mayor)
//   calidad?: number,                     // 0..1, default 0.85 (jpeg)
//   formato?: "jpeg" | "webp"             // default "webp"
// }
// devuelve: { ok, requestId }
// luego (evento): {
//   requestId,
//   ok: bool,
//   error?: "PERMISO_DENEGADO" | "CANCELADO" | "DESCONOCIDO",
//   foto?: {
//     dataUrl: "data:image/webp;base64,...", // listo para <img src=>
//     ancho: number,
//     alto: number,
//     bytes: number,
//     timestamp: number  // millis epoch
//   }
// }
```

**Por qué `dataUrl` y no un archivo:** la web ya tiene flujos para subir
imágenes a Firebase Storage (admin-web pasa por `compressToWebP`). Pasar
el `dataUrl` directo evita que la APK tenga que tocar Firebase. La web
recibe la foto, la pasa por su pipeline normal (compressToWebP → upload).

**Alternativa con HTML5 `<input>` (sin bridge nativo):** la WebView
soporta `<input type="file" accept="image/*" capture="environment">` que
lanza la app de cámara del Android. Es **gratis** (no hace falta
`window.POS.tomarFoto`) si configuras `WebChromeClient.onShowFileChooser`
correctamente. Recomendación: **empezar con HTML5** y agregar el método
nativo solo si hay un caso que necesite preview/retake personalizado o
metadatos extra.

#### Eventos: native → JS

El bridge inyecta JS evaluando `window.POS.dispatch("nombre", payload)`. La web registra listeners con un mini event-bus que el código de la APK garantiza que existe (lo inyecta en `onPageFinished`):

```ts
// Resultado de impresión asíncrona.
window.POS.onPrintResult({ requestId, ok, error?, codigoError? })

// Resultado de tomar foto (cuando se usa el método nativo).
window.POS.onFotoResult({ requestId, ok, error?, foto? })

// Cambio de estado (impresora desconectada, BT off, etc.).
window.POS.onEstadoChange(jsonState)
```

> Nota: el evento `onBarcode` que apareció en versiones previas de este
> documento se eliminó del scope. El scanner USB HID se sigue manejando
> como hoy: el scanner inyecta el código + Enter en el input enfocado del
> autocomplete del POS web; cero bridge.

#### Códigos de error estandarizados

```
BT_DESACTIVADO          el Bluetooth del Android está apagado
PERMISO_DENEGADO        el usuario no concedió BLUETOOTH_CONNECT u otros
NO_HAY_IMPRESORA        no hay seleccionada o no responde
TIMEOUT                 conexión BT colgó
USB_PERMISO_DENEGADO    el modal nativo de USB se canceló
USB_DESCONECTADO        el cable salió
DESCONOCIDO             cualquier excepción no clasificada (incluye `error`)
```

### 2.3 Refactor del hardware (extracción al módulo `:hardware`)

#### Bluetooth Printer

**Hoy** (`async/`, `pagoTarjeta/uno.java`):

- `selectedDevice_static` es estático y vive en `pagoTarjeta.uno`. Mezcla format del ticket con la conexión BT.
- `MAC` se lee de `SharedPreferences` con clave hardcoded.

**Refactor:**

```
hardware/PrinterBluetooth.java
  - estática: getInstance(Context)  → singleton.
  - listarPareadas(): List<{mac, name}>
  - seleccionar(mac)                → guarda en SharedPreferences encapsulado.
  - imprimirEscPos(formato): Future → ejecuta el AsyncTask y devuelve resultado.
  - getEstado()                     → { mac, conectada }
```

`pagoTarjeta/uno.java` se queda con la responsabilidad de **formatear el texto** (eso es lógica de negocio, no hardware). El `webview-pos` no la usa: la web ya formatea su propio string ESC/POS y se lo manda cocinado.

#### USB Label Printer (TSPL)

**Hoy** (todo dentro de `principal.java` 1230-1410):

```
principal.java:
  UsbManager usbManager;
  UsbDevice currentUsbDevice;
  selectUsbDevice() / sendTspl(byte[]) / buildTsplCommand_*
  BroadcastReceiver para ACTION_USB_PERMISSION
```

**Refactor:**

```
hardware/PrinterUsbLabel.java
  - getInstance(Context)
  - listarDispositivos(): List<{vendorId, productId, name}>
  - solicitarPermiso(vendorId, productId, callback)
  - imprimirTspl(byte[] payload, copias): Future<{ok, error}>
  - desconectar()
```

`buildTsplCommand_registrado` y `buildTsplCommand_no_registrado` se mueven a `hardware/TsplBuilder.java` para que admin-web pueda generar el TSPL desde la web (formateo) y mandarlo cocinado. Si la web prefiere generar TSPL ella misma, también se puede.

#### Barcode (scanner USB HID)

**No requiere código nativo** — el scanner USB es un teclado virtual:
inyecta el código y un Enter en el input que tenga el foco. La web
(`BuscadorArticulo`) ya lo maneja porque su `<input>` mantiene autofoco
en la pantalla de venta. La APK solo asegura que el WebView no robe el
foco para sí.

`MyCaptureActivity` (escáner por cámara con zxing) se queda en `:app`
actual. Para `:webview-pos`, la web ya cubre cámara-scan vía
`BarcodeDetector` / `zxing-browser`.

#### Cámara para fotos (NUEVO)

```
hardware/CaptureFoto.java
  - lanzarFotoCamara(Activity, opts, callback)
    Usa CameraX (recomendado) o ACTION_IMAGE_CAPTURE como fallback.
    opts: { facing: front|back, maxLado, calidad, formato }
    callback: ok(byte[] jpeg/webp, ancho, alto) | error(codigo)
```

Implementación recomendada: **CameraX** (`androidx.camera`) con preview
embebido en una Activity ligera (`FotoActivity`) que arranca el
WebViewActivity. Maneja:

- selección front/back,
- escalado al lado mayor solicitado (`Bitmap.createScaledBitmap`),
- compresión a WebP (Android 11+) o JPEG fallback,
- devuelve el resultado vía `setResult(RESULT_OK, intent)` con el byte[]
  serializado o un URI temporal.

`PosBridge.tomarFoto()` arranca `FotoActivity` y, al volver, codifica
el byte[] como `data:image/webp;base64,...` y emite el evento
`onFotoResult` por `evaluateJavascript`.

**HTML5 alternativa:** mientras se construye `FotoActivity`, configurar
`WebChromeClient.onShowFileChooser` para que `<input type="file"
accept="image/*" capture="environment">` lance la cámara del sistema.
La web obtiene el `File` y lo procesa por su pipeline normal. Esta vía
es **viable desde el día 1** sin bridge.

### 2.4 Estrategia de fallback (web sin APK)

La web (`nodo-web`) se carga igual en navegador estándar y en la APK envuelta. Detección y branch:

```ts
// nodo-web/src/lib/pos-bridge.ts (nuevo)
export const pos = {
  disponible: () => Boolean((window as any).POS),
  imprimirTicket: async (formato: string) => {
    if (!pos.disponible()) {
      // Fallback: generar PDF y abrirlo / compartirlo (lo que ya hay).
      return ticketServiceFallbackPDF(formato);
    }
    return llamarBridgeAsync("imprimirTicket", { formato });
  },
  // ...
};
```

- Si `window.POS` existe → impresión real, abrir cajón, scanner USB integrado al carrito por evento.
- Si no existe → flujo actual (PDF + scanner por cámara o por foco en input).

La web **no se ramifica en componentes**, solo en el adaptador `pos-bridge.ts`. El resto del código sigue llamando `pos.imprimirTicket(...)`.

### 2.5 Configuración del WebView

```java
WebView wv = findViewById(R.id.webview);
WebSettings s = wv.getSettings();
s.setJavaScriptEnabled(true);
s.setDomStorageEnabled(true);
s.setDatabaseEnabled(true);
s.setAllowFileAccess(false);                     // seguridad
s.setAllowContentAccess(false);
s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
s.setMediaPlaybackRequiresUserGesture(false);    // cámara sin gesture
s.setLoadWithOverviewMode(true);
s.setUseWideViewPort(true);
s.setSupportZoom(false);

// Permisos automáticos (cámara para zxing-browser).
wv.setWebChromeClient(new WebChromeClient() {
  @Override public void onPermissionRequest(PermissionRequest req) {
    runOnUiThread(() -> req.grant(req.getResources()));
  }
});

// Bridge.
wv.addJavascriptInterface(new PosBridge(this, wv), "POS");

// Hardware acceleration.
wv.setLayerType(View.LAYER_TYPE_HARDWARE, null);

// Debugging en builds debug.
if (BuildConfig.DEBUG) WebView.setWebContentsDebuggingEnabled(true);

// URL — se inyecta el origen del POS web; en desarrollo apunta a localhost.
wv.loadUrl(BuildConfig.POS_WEB_URL);
```

**`MainActivity.dispatchKeyEvent(KeyEvent)`** se override para capturar el escáner USB **antes** de que el WebView reciba la tecla (evita que escriba el código en el input enfocado, lo cual interferiría con la búsqueda).

**`onBackPressed`** delega al WebView (`canGoBack` → `goBack()`) excepto en la pantalla raíz, donde sale.

Permisos extra a añadir en `webview-pos/AndroidManifest.xml`:

```
<uses-permission android:name="android.permission.CAMERA" />
<uses-feature   android:name="android.hardware.usb.host" android:required="false" />
<uses-feature   android:name="android.hardware.bluetooth_le" android:required="false" />
<intent-filter>
  <action android:name="android.hardware.usb.action.USB_DEVICE_ATTACHED"/>
</intent-filter>
```

---

## Fase 3 — Riesgos y decisiones pendientes

1. **¿La web vive servida desde Firebase Hosting o empaquetada como assets en la APK?**
   - **Hosting** (online): siempre la última versión, requiere internet al arrancar.
   - **Assets** (offline): WebView carga `file:///android_asset/index.html`, requiere release de APK por cada cambio del POS.
   - Recomiendo **híbrido**: cargar de Hosting con cache offline (Service Worker que ya tiene `nodo-web`) y fallback a assets en frío. Decidir.

2. **MAC de impresora: ¿se sigue guardando en SharedPreferences local o se mueve al doc del sucursal/nodo en Firestore?** Si se centraliza, cualquier nodo puede imprimir en la impresora correcta sin re-config. Si se queda local, la APK nueva tiene que migrar el valor del `:app` original o pedir que se reseleccione.

3. **¿`webview-pos` reemplaza al `:app` actual o coexisten?**
   - Coexistir tiene costo: dos APK en la tablet, dos íconos.
   - Reemplazar exige que la web cubra al 100 % las funciones del Android original (apartados, corte, mensajes, ingreso, admin). Hoy `nodo-web` no las cubre todas.
   - Recomiendo coexistir hasta tener paridad funcional, después decidir.

4. **Versionado del bridge:** la web detecta `window.POS.version()`. Cuando cambien firmas, hay que mantener compat hacia atrás o forzar actualización de APK. Mejor versionar desde el día 1 (`"1.0.0"`).

5. **AsyncTask es deprecado** (la lib `ESCPOS-ThermalPrinter-Android` lo usa). En `targetSdk 34` sigue funcionando pero con warnings. Considerar reemplazarlo por `kotlinx.coroutines` o `Executor` cuando refactoricemos a `:hardware` — sin urgencia, pero anótalo.

6. **Permisos runtime en Android 12+:** la APK debe pedir `BLUETOOTH_CONNECT` y `BLUETOOTH_SCAN` con `requestPermissions()`. Hoy `:app` lo asume — funcionará en tablets ya configuradas pero falla en una recién instalada. La nueva APK debe tener el flujo de prompt explícito.

7. **Seguridad del bridge:** `addJavascriptInterface` expone los métodos a **cualquier JS cargado** en el WebView. Si la web carga un iframe externo o se hace XSS, el atacante puede llamar `window.POS.imprimirTicket(...)`. Mitigación: cargar la web con CSP estricta, prohibir iframes con `WebViewClient.shouldInterceptRequest`. Anotar.

---

## Fase 4 — Próximos pasos sugeridos (no implementar todavía)

1. **Extraer `PrinterBluetooth`** al módulo `:hardware` desde `pagoTarjeta/uno.java` + `async/AsyncEscPosPrint*.java`. Validar que `:app` sigue compilando e imprimiendo tickets reales.
2. **Extraer `PrinterUsbLabel` + `TsplBuilder`** desde `principal.java:1230-1410`. Validar `:app`.
3. **Crear `:webview-pos`** con un WebView "tonto" que carga la web (sin bridge todavía). Habilita HTML5 `<input capture>` para fotos vía `WebChromeClient.onShowFileChooser` (cámara funcionando "gratis").
4. **Implementar `PosBridge` síncrono** — `disponible`, `version`, `listarImpresoras*`, `seleccionar*`, `estado`. La web detecta `window.POS` y empieza a usarlo.
5. **Implementar `imprimirTicket` (BT)** async con `requestId` + `evaluateJavascript`. Adaptar `pos-bridge.ts` en la web para enrutar tickets al bridge cuando `disponible() === true`.
6. **Implementar `imprimirEtiqueta` (USB TSPL)** mismo patrón. Pruebas con impresora real (es la que ha dado problemas).
7. **Implementar `tomarFoto` con CameraX** + `FotoActivity` (paso opcional — solo si la HTML5 file-input no alcanza). Devolver `dataUrl` por evento.
8. Smoke completo: tickets BT + etiquetas USB + foto desde chat (HTML5 o nativo) en hardware real.

Cada paso es atómico, el sistema queda funcional al final del paso, y el
`:app` original sigue operativo durante toda la migración.
