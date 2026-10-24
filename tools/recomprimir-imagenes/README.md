# Recomprimir imágenes de artículos

Deja todas las imágenes de `media_web_new_version/articulos/` en **menos de 500 KB**
(WebP con la mayor calidad posible). Es el complemento de las subidas nuevas de
admin-web y mercancia-web, que ya comprimen a 500 KB al elegir la foto: este script
arregla las que se subieron antes, **una sola vez**.

Vive aparte de `functions/` (con su propio `package.json`) para que `sharp` no entre al deploy.

## Qué hace

- Lista los `.webp` bajo `media_web_new_version/articulos/` y toma los que pesan **más de 500 KB**.
  Los demás no se tocan; por eso correrlo otra vez no recomprime lo ya recomprimido.
- Re-codifica cada uno desde el original buscando la **mayor calidad WebP (95 → 55)** que quede en
  500 KB o menos. Si ni con 55 entra, reduce el lado mayor ×0.85 (hasta 800 px). Es la misma regla
  que `compressToWebP` en el navegador. Si ni así baja, deja el original y lo avisa.
- Lo sube al **mismo path** conservando `contentType`, `cacheControl`, `contentDisposition` y la
  metadata personalizada, en especial `firebaseStorageDownloadTokens`: las URLs guardadas en
  Firestore siguen funcionando. Tras cada subida verifica el token (si se perdió lo repone; si no
  puede, lo marca como error).
- Si alguien reemplaza una imagen mientras el script corre, esa no se pisa (`ifGenerationMatch`).
- Un error en un archivo no detiene a los demás. Código de salida `1` si hubo errores.

## Requisitos

- Node 22 o superior.
- Una cuenta con permiso para listar, leer, crear y borrar objetos del bucket
  (rol *Storage Object Admin* o la cuenta de servicio del Admin SDK).

```bash
cd tools/recomprimir-imagenes
npm install
```

## Credenciales (Application Default Credentials)

Una de las dos:

- Con tu usuario de Google: `gcloud auth application-default login`
- Con una clave de cuenta de servicio (guárdala **fuera del repo**):
  - PowerShell: `$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\ruta\clave.json"`
  - cmd: `set GOOGLE_APPLICATION_CREDENTIALS=C:\ruta\clave.json`

## Uso

El bucket es el `storageBucket` de la config web (hoy `amisetienda-c7eab.appspot.com`, ver
`admin-web/src/firebase/config.ts`). Orden recomendado:

```bash
# 1. Ver qué se tocaría (solo lectura): candidatos con su tamaño actual
node recomprimir.js --bucket amisetienda-c7eab.appspot.com --dry-run

# 2. Probar con las 3 más pesadas, guardando el original de cada una
node recomprimir.js --bucket amisetienda-c7eab.appspot.com --limit 3 --backup-dir C:\respaldo-imagenes

# 3. Revisar esas imágenes en el admin y, si están bien, la corrida completa
node recomprimir.js --bucket amisetienda-c7eab.appspot.com --backup-dir C:\respaldo-imagenes
```

| Opción | Efecto |
| --- | --- |
| `--bucket <nombre>` | Bucket de Storage (o variable `STORAGE_BUCKET`). Obligatorio. |
| `--dry-run` | Lista los candidatos y su tamaño. No descarga ni modifica nada. |
| `--limit <N>` | Procesa como máximo N candidatos, los más pesados primero. |
| `--backup-dir <carpeta>` | Guarda ahí una copia de cada original antes de sobrescribirlo (usa una carpeta fuera del repo). |

## Ojo

- **Sobrescribir no se puede deshacer.** `--backup-dir` guarda la imagen original (no su metadata).
  Revisa también si el bucket tiene *soft delete* o versionado.
- Las tablets que ya tienen la imagen en caché (el service worker de nodo-web las guarda hasta
  30 días por URL) seguirán mostrando la versión anterior hasta que expire. Nada se rompe: la URL
  no cambia.

## Pruebas

```bash
npm test
```

Usan imágenes generadas y un bucket falso en memoria (sin red ni credenciales). Para ensayar con el
SDK real sin tocar producción, levanta el emulador (`firebase emulators:start --only storage
--project demo-prueba`), define `FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199` y usa
`--bucket demo-prueba.appspot.com`. Ojo: el emulador ignora `ifGenerationMatch`.
