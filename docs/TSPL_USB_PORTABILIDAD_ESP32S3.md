# Análisis del módulo USB→TSPL y portabilidad a ESP32-S3

> **Objetivo**: documentar exactamente qué librerías, APIs y protocolos usa el flujo de impresión de etiquetas (USB) en `nodo_1` (y su origen `AndroidStudioProjects/codigos`) para evaluar si puede trasladarse a una placa **ESP32-S3**.
>
> **Spoiler de conclusión**: el protocolo a nivel cable (TSPL en ASCII sobre USB Bulk OUT) **es 100 % portable** a ESP32-S3. Lo que **no** es portable es la capa de Android (`UsbManager`, `BroadcastReceiver`, `SharedPreferences`, `AlertDialog`); hay que reescribirla con la **USB Host Library de ESP-IDF**. La buena noticia: TSPL no necesita driver, solo bytes.

---

## 1. Inventario del código fuente actual

| Archivo                                                             | Rol                                                                                                          |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `nodo_1/app/src/main/java/com/example/nodo_1/principal.java`       | Implementación incompleta dentro de la app principal (`onCreate` en `:329`, `sendTspl` en `:1366`).        |
| `nodo_1/app/src/main/res/xml/device_filter.xml`                    | Filtro de dispositivo USB (con placeholders sin reemplazar).                                                 |
| `nodo_1/app/src/main/AndroidManifest.xml`                          | **No** declara `uses-feature usb.host` ni el `intent-filter` `USB_DEVICE_ATTACHED`.                          |
| `AndroidStudioProjects/codigos/codigos/app/.../MainActivity.java`  | Versión de referencia, casi completa (con bug lógico en línea `158`).                                        |
| `AndroidStudioProjects/codigos/codigos/app/src/main/AndroidManifest.xml` | Versión correcta del manifest (`<uses-feature usb.host>` + `intent-filter` + `meta-data device_filter`). |

---

## 2. Librerías utilizadas

### 2.1 De qué **NO** depende este flujo

- ❌ **No usa** `com.dantsu.escposprinter` (librería ESC/POS de DantSu). Esa es la otra rama del proyecto, dedicada a tickets POS por Bluetooth.
- ❌ **No usa** ninguna librería TSPL de terceros (ej. `tsc-printer-sdk`, `LabelPrinter`, etc.).
- ❌ **No usa** drivers nativos (`libusb`, `usbserial-for-android`, `felhr85/UsbSerial`, `mik3y/usb-serial-for-android`).

### 2.2 De qué **SÍ** depende

Únicamente del **USB Host API nativo de Android** (paquete `android.hardware.usb`), incluido en el framework desde API 12. Clases concretas:

| Clase                          | Uso en el código                                                            |
| ------------------------------ | --------------------------------------------------------------------------- |
| `android.hardware.usb.UsbManager` | Servicio de sistema (`Context.USB_SERVICE`); enumera, pide permisos.    |
| `android.hardware.usb.UsbDevice`  | Representa la impresora; expone `vendorId`, `productId`, interfaces.    |
| `android.hardware.usb.UsbDeviceConnection` | Handle abierto; expone `claimInterface`, `bulkTransfer`.       |
| `android.hardware.usb.UsbInterface`        | Conjunto de endpoints; el código usa `getInterface(0)`.        |
| `android.hardware.usb.UsbEndpoint`         | Endpoint individual; el código busca `XFER_BULK` + `DIR_OUT`.  |
| `android.hardware.usb.UsbConstants`        | Constantes (`USB_ENDPOINT_XFER_BULK`, `USB_DIR_OUT`).          |
| `android.app.PendingIntent` + `BroadcastReceiver` | Mecanismo Android para autorización de USB (no aplica fuera de Android). |
| `android.content.SharedPreferences`        | Persiste `vendorId`/`productId` del último dispositivo.        |

> Conclusión de librerías: **toda la dependencia es framework Android**. No hay que reemplazar `.jar`/`.aar` al portar; hay que reemplazar el host completo.

---

## 3. Protocolo de comunicación

### 3.1 Capa de aplicación: **TSPL**

TSPL = **TSC Printer Language**, lenguaje de comandos en **texto ASCII** propietario de TSC Auto ID. Cada comando termina en `\n`. Es **stateless** desde el punto de vista del transporte: el emisor empuja bytes y la impresora interpreta.

Comandos efectivamente generados por el código (ver `principal.java:1288-1339`):

```
SIZE 29 mm, 14 mm
GAP 3 mm, 0 mm
DENSITY 8
SPEED 4
DIRECTION 0
REFERENCE 0,0
SET TEAR ON
SET TEAR ADJUST 5
CLS
TEXT 85,10,"1",0,2,2,"$<precio>"
BARCODE 40,35,"128",30,0,0,2,3,"<barcode>"
TEXT 40,70,"1",0,2,2,"<barcode>"
PRINT <quantity>
```

Características relevantes para portar:
- Sin handshake. Sin ACK/NAK aplicativo. **Fire-and-forget**.
- Sin checksums ni framing. El "fin de comando" es `\n`.
- Codificación: `US_ASCII` (`StandardCharsets.US_ASCII` en `principal.java:1392`).
- Tamaño típico de un job: ~200-400 bytes. **No hay riesgo de fragmentación** en un único `bulkTransfer` (max packet 64 B en USB 2.0 Full-Speed, pero el stack maneja internamente la división).

> Nota: si la impresora soportara también **ZPL** (Zebra) o **ESC/POS**, hablaríamos de capas distintas. **Aquí solo es TSPL**.

### 3.2 Capa de transporte: **USB Bulk Transfer (clase Printer 0x07)**

```
Host (Android / ESP32-S3)
   │
   │  USB 2.0 Full-Speed (12 Mbps típico)
   │
   ▼
Impresora TSPL
 ├── Configuration #1
 │    └── Interface #0  (clase 0x07 = USB Printer, normalmente)
 │         ├── Endpoint OUT  type=Bulk   ← se usa este
 │         └── Endpoint IN   type=Bulk   ← no se usa (status read opcional)
```

El código actual:
1. Hace `device.getInterface(0)` (asume la primera interfaz).
2. Recorre endpoints buscando `XFER_BULK + DIR_OUT`.
3. Llama `connection.bulkTransfer(endpointOut, buffer, length, 2000ms)`.

**No** se hace lectura del endpoint IN. **No** se usa control transfer. **No** se enumera más de una interfaz. Esto es típico de impresoras "tontas" tipo USB Printer Class.

### 3.3 Vendor/Product IDs

`device_filter.xml` tiene placeholders literales (`VENDOR_ID`, `PRODUCT_ID`). En tiempo de ejecución la app usa el selector manual (`showDeviceSelectionDialog`) y guarda el ID en `SharedPreferences`. **No conocemos el VID/PID real desde el código**; hay que leerlo en runtime con la impresora física conectada.

> Acción pendiente: cuando tengas la impresora conectada, anota los IDs (visibles en el Toast del diálogo) y rellénalos tanto en `device_filter.xml` como en el firmware ESP32.

---

## 4. Flujo end-to-end (estado actual de Android)

```
[Usuario pulsa "imprimir"]
        │
        ▼
sendCodigo_registrado()  ──►  buildTsplCommand_*()
        │                            │
        ▼                            ▼
selectUsbDevice(tspl)         (string TSPL)
        │
        ▼
usbManager.openDevice(currentUsbDevice)   ── (requiere permiso ya concedido)
        │
        ▼
sendTspl(connection, device, tspl)
        │
        ├── device.getInterface(0)
        ├── connection.claimInterface(...)
        ├── busca endpoint Bulk OUT
        └── connection.bulkTransfer(ep, bytes, len, 2000)
```

Permiso USB (asíncrono):
```
checkOrSelectUsbDevice()
  └─► requestUsbPermission(device, null)
         └─► usbManager.requestPermission(device, pendingIntent)
                  ↓ (sistema muestra diálogo al usuario)
         BroadcastReceiver.onReceive(ACTION_USB_PERMISSION)
                  ↓ (si concedido)
              usbManager.openDevice(device) → guarda en `usbConnection`
```

---

## 5. Mapa Android ↔ ESP32-S3

| Concepto                                  | Android (actual)                           | ESP32-S3 equivalente                                                      |
| ----------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------- |
| Stack USB                                 | Framework `android.hardware.usb`           | **ESP-IDF USB Host Library** (`usb_host.h`) o **TinyUSB en modo host**.   |
| Permisos                                  | `UsbManager.requestPermission` + Broadcast | No existe — el host ESP arranca y enumera directo.                        |
| Listado de dispositivos                   | `usbManager.getDeviceList()`               | `usb_host_client_register()` + callbacks `NEW_DEV` / `DEV_GONE`.          |
| Abrir dispositivo                         | `usbManager.openDevice(device)`            | `usb_host_device_open(client, addr, &dev_hdl)`.                           |
| Reclamar interfaz                         | `connection.claimInterface(iface, true)`   | `usb_host_interface_claim(client, dev_hdl, bInterfaceNumber, bAlternate)`.|
| Buscar endpoint Bulk OUT                  | Loop manual sobre `usbInterface.getEndpoint(i)` | Parseo del descriptor de configuración (`usb_print_config_descriptor`).   |
| Enviar bytes                              | `connection.bulkTransfer(ep, buf, len, T)` | `usb_host_transfer_alloc` + `usb_host_transfer_submit` (transfer Bulk).   |
| Persistencia VID/PID                      | `SharedPreferences`                        | NVS (`nvs_flash`) o hardcode en config.                                   |
| UI selección dispositivo                  | `AlertDialog`                              | No aplica (un único dispositivo) o pantalla local + botón.                |

---

## 6. Aptitud del ESP32-S3 para esta tarea

### 6.1 Hardware

| Requisito                | ESP32-S3                                                     | Veredicto |
| ------------------------ | ------------------------------------------------------------ | --------- |
| USB OTG Host (Full-Speed)| **Sí** — USB-OTG integrado, hasta 12 Mbps (USB 2.0 FS).      | ✅        |
| Tamaño de RAM            | 320 KB SRAM + 8 MB PSRAM (en variantes); el job pesa <1 KB.  | ✅        |
| Flash                    | 4-16 MB; sobra para firmware + assets.                       | ✅        |
| Alimentación al puerto   | El ESP32-S3 **no provee 5 V** desde su puerto; necesita VBUS externo (la impresora suele tener su propia fuente, así que solo se conectan D+/D−/GND). | ⚠️ ver §6.4 |

### 6.2 Software (ESP-IDF ≥ 5.0)

Componentes necesarios:
- **`usb_host`** (oficial Espressif): núcleo del stack host.
- **Driver USB Printer Class**: Espressif **no** provee uno listo (al cierre de este doc). Hay que implementarlo encima de `usb_host` haciendo Bulk OUT crudo. No es complicado: la clase 0x07 es trivial (sin set-up complejo, sin alternate settings raros).
- Alternativa: **TinyUSB** (incluido en ESP-IDF 5.x como `esp_tinyusb`) en modo host — también soporta transferencias bulk genéricas.

Boilerplate mínimo (pseudocódigo idiomático ESP-IDF):

```c
// 1. Instalar host
usb_host_config_t host_cfg = { .intr_flags = ESP_INTR_FLAG_LEVEL1 };
usb_host_install(&host_cfg);

// 2. Registrar cliente y task de eventos
usb_host_client_register(&client_cfg, &client_hdl);

// 3. Esperar callback NEW_DEV → abrir
usb_host_device_open(client_hdl, dev_addr, &dev_hdl);
usb_host_interface_claim(client_hdl, dev_hdl, 0, 0);

// 4. Localizar endpoint Bulk OUT recorriendo el config descriptor
const usb_config_desc_t *cfg;
usb_host_get_active_config_descriptor(dev_hdl, &cfg);
// ... parse interfaces y endpoints, guardar bEndpointAddress del Bulk OUT

// 5. Enviar TSPL
usb_transfer_t *xfer;
usb_host_transfer_alloc(buffer_len, 0, &xfer);
memcpy(xfer->data_buffer, tspl_ascii, buffer_len);
xfer->num_bytes = buffer_len;
xfer->bEndpointAddress = ep_out_addr;
xfer->device_handle = dev_hdl;
xfer->callback = on_xfer_done;
usb_host_transfer_submit(xfer);
```

### 6.3 Implementación TSPL en ESP32

Trivial: los `buildTsplCommand_*` de Java se traducen a `snprintf` en C. Ejemplo:

```c
int build_tspl_registrado(char *out, size_t cap,
                          const char *price, const char *barcode, int qty) {
    return snprintf(out, cap,
        "SIZE 29 mm, 14 mm\n"
        "GAP 3 mm, 0 mm\n"
        "DENSITY 8\n"
        "SPEED 4\n"
        "DIRECTION 0\n"
        "REFERENCE 0,0\n"
        "SET TEAR ON\n"
        "SET TEAR ADJUST 5\n"
        "CLS\n"
        "TEXT 85,10,\"1\",0,2,2,\"$%s\"\n"
        "BARCODE 40,35,\"128\",30,0,0,2,3,\"%s\"\n"
        "TEXT 40,70,\"1\",0,2,2,\"%s\"\n"
        "PRINT %d\n",
        price, barcode, barcode, qty);
}
```

### 6.4 Riesgos / pendientes técnicos

1. **VBUS 5 V**: el USB-OTG del ESP32-S3 no inyecta 5 V por defecto. Si la impresora se autoalimenta (lo normal), conecta solo D+/D−/GND y comparte tierra. Si necesitara VBUS, usa un boost externo o un MAX4793 / TPS2051.
2. **Resistencias de pull-up/pull-down**: para que el ESP32 actúe como host, los pads D+/D− deben quedar libres del pull-up de 1.5 kΩ que llevarían en modo device. Las DevKit oficiales de S3 (USB-OTG nativo en GPIO19/GPIO20) ya están preparadas; tarjetas custom tienen que cuidar la topología.
3. **Detección VID/PID**: hay que conseguirlos primero con la impresora real. Plan: corre un sniff en la app Android existente, anota lo que muestra el `AlertDialog` (`showDeviceSelectionDialog`) y úsalo para filtrar también en el firmware.
4. **Clase 0x07 vs vendor-specific**: la mayoría de impresoras TSC declaran clase Printer (0x07), pero algunas son **vendor-specific**. Da igual a efectos de Bulk OUT — solo cambia el identificador en el descriptor; el envío de bytes funciona igual.
5. **Sin lectura de status**: el código actual no lee endpoint IN. Si quieres detectar "sin papel", "cabezal abierto", etc. tendrás que añadir Bulk IN y parsear (no necesario para imprimir).
6. **Concurrencia**: en ESP-IDF la task de eventos del host debe correr siempre que haya cliente registrado. Atarla a un task con prioridad media (ej. 5) y usar una queue para enviar jobs.
7. **Hot-plug**: el ESP debe escuchar `USB_HOST_CLIENT_EVENT_DEV_GONE` y limpiar handles. La app Android lo resuelve con el `BroadcastReceiver`; en el ESP es responsabilidad del firmware.

---

## 7. Veredicto de portabilidad

| Aspecto                         | Apto para ESP32-S3 | Comentario                                                              |
| ------------------------------- | ------------------ | ----------------------------------------------------------------------- |
| Protocolo aplicativo (TSPL)     | ✅ 100 %           | Texto ASCII, sin estado, sin ACK. `snprintf` y listo.                   |
| Transporte (USB Bulk OUT, FS)   | ✅                 | Cubierto por `usb_host` o TinyUSB-host de ESP-IDF.                      |
| Capa Android (`UsbManager`, etc.) | ❌ no portable    | Hay que reescribir con APIs ESP-IDF (esfuerzo medio).                   |
| Permiso/UI                      | ➖ no aplica       | El ESP enumera y abre directo; sin UI ni dialog.                        |
| VID/PID                         | ⚠️ pendiente       | Falta confirmar contra el hardware real.                                |
| Alimentación                    | ⚠️ revisar         | Confirmar que la impresora se autoalimenta; si no, añadir boost VBUS.   |

**Conclusión global**: SÍ es apto. El esfuerzo está en la capa USB host (no en TSPL). Como referencia de horas para alguien con ESP-IDF previo: ~1-2 días para el primer "hello world" imprimiendo, ~1 semana para algo robusto con hot-plug y manejo de errores.

---

## 8. Cómo proceder (pasos concretos)

1. **Confirmar VID/PID de la impresora**: corre la app Android actual con la impresora conectada y abre `showDeviceSelectionDialog`; anota los valores que aparecen en el `Toast`/lista.
2. **Hardware ESP32-S3**: usar una DevKit oficial **ESP32-S3-DevKitC-1** (tiene el USB-OTG en GPIO19/20). Verificar VBUS.
3. **Proyecto ESP-IDF**: `idf.py create-project tspl_printer`. Añadir el componente `usb_host` (built-in en IDF ≥ 5.0).
4. **Stub de host**: ejemplo oficial `examples/peripherals/usb/host/usb_host_lib` como punto de partida; sustituir el "any device" por filtro VID/PID.
5. **Bulk OUT**: tras `interface_claim`, parsear descriptor de config para localizar el endpoint Bulk OUT, guardar `bEndpointAddress`.
6. **Generar y enviar TSPL**: portar `buildTsplCommand_registrado` y `buildTsplCommand_no_registrado` a C; un único `usb_host_transfer_submit` por job.
7. **Trigger**: definir cómo dispara el ESP la impresión (botón físico, MQTT, BLE, HTTP, UART desde otro micro). Aquí decides la arquitectura final del producto.
8. **Iterar**: una vez imprime, añadir hot-plug, retry, watchdog y persistencia de VID/PID en NVS si quieres permitir varias impresoras.

---

## 9. Resumen ejecutivo de una línea

> El protocolo es **TSPL ASCII sobre USB Bulk OUT**, sin librería de terceros — toda la dependencia actual es `android.hardware.usb`; al ESP32-S3 se traslada con la **USB Host Library de ESP-IDF**, manteniendo idéntica la generación de comandos. Apto.
