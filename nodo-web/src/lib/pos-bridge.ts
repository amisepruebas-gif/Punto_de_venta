/**
 * Adaptador del bridge nativo `window.POS`.
 *
 * El bridge solo existe cuando `nodo-web` corre dentro de la APK Android
 * (clase `PosBridge` con `@JavascriptInterface`). En navegadores normales,
 * `window.POS` es `undefined` y los métodos devuelven `{ disponible: false }`
 * para que la UI pueda mostrar fallbacks (PDF, scanner por cámara, etc.).
 *
 * Convenciones del bridge nativo (ver `docs/12-pos-android-webview-plan.md`):
 *   - `@JavascriptInterface` solo soporta tipos primitivos + String, así que
 *     todos los métodos van JSON-in / JSON-out.
 *   - Métodos asíncronos devuelven `{ ok, requestId }` y el resultado real
 *     llega vía `window.POS.dispatch(nombre, payload)` que el bridge
 *     invoca con `webView.evaluateJavascript()`.
 */

// ============================================================
// Forma del bridge nativo (lo que inyecta `addJavascriptInterface`).
// ============================================================

interface NativePOS {
  /** "true" | "false" — sondeo barato. */
  disponible(): string;
  /** "1.0.0" o similar. */
  version(): string;

  // Síncronos
  listarImpresorasBluetooth(): string;
  seleccionarImpresoraBluetooth(jsonInput: string): string;
  listarDispositivosUsb(): string;
  seleccionarImpresoraUsb(jsonInput: string): string;
  estado(): string;

  // Asíncronos — devuelven { ok, requestId } sincronamente.
  imprimirTicket(jsonInput: string): string;
  imprimirEtiqueta(jsonInput: string): string;
  abrirCajon(): string;
  tomarFoto(jsonInput: string): string;

  // Mantenimiento
  vaciarCacheImagenes(): string;
  /** Poda granular del cache nativo. Disponible a partir del build con
   *  PosBridge.java actualizado; el TS verifica con `typeof === "function"`. */
  podarCacheImagenes?(jsonInput: string): string;
  /** Estadísticas del cache nativo (hits/misses/bytes). */
  estadisticasCacheImagenes?(): string;
  /** Cierra la activity. Disponible a partir del build con
   *  `cerrarApp` en PosBridge.java; verificar con `typeof === "function"`. */
  cerrarApp?(): string;
  /** Indica si hay teclado físico conectado (`{ok:true, tiene:bool}`).
   *  Disponible a partir del build con PosBridge.java actualizado. */
  tieneTecladoFisico?(): string;
  /** Diagnóstico: keyboard, hardKeyboardHidden, manufacturer, etc. */
  debugTeclado?(): string;

  // Telemetría de tráfico Firestore — almacenamiento en filesystem APK.
  // Disponibles a partir del build con PosBridge.java actualizado; código TS
  // verifica con `typeof === "function"` antes de invocar.
  traficoEscribir?(ymd: string, json: string): string;
  traficoLeer?(ymd: string): string;
  traficoListarDias?(): string;
  traficoBorrar?(ymd: string): string;
}

declare global {
  interface Window {
    POS?: NativePOS;
    /** Event-bus que la APK invoca con evaluateJavascript. La web lo provee. */
    __posDispatch?: (evento: string, payload: unknown) => void;
    /** Atajo de diagnóstico: `__debugTeclado()` desde la consola de
     *  Chrome DevTools (chrome://inspect) muestra el estado raw del IME
     *  en la tablet conectada. */
    __debugTeclado?: () => Resultado<DebugTeclado>;
  }
}

// ============================================================
// Detección
// ============================================================

export function posDisponible(): boolean {
  try {
    return typeof window !== "undefined"
      && typeof window.POS !== "undefined"
      && window.POS.disponible() === "true";
  } catch {
    return false;
  }
}

export function posVersion(): string | null {
  if (!posDisponible()) return null;
  try {
    return window.POS!.version();
  } catch {
    return null;
  }
}

// ============================================================
// Tipos públicos del lado web (no los del bridge crudo).
// ============================================================

export type ImpresoraBluetooth = {
  mac: string;
  nombre: string;
  conectada?: boolean;
};

export type DispositivoUsb = {
  vendorId: number;
  productId: number;
  nombre: string;
  conPermiso?: boolean;
};

export type EstadoPos = {
  impresoraBT: { mac?: string; nombre?: string; conectada: boolean } | null;
  impresoraUSB: {
    vendorId?: number;
    productId?: number;
    nombre?: string;
    conPermiso: boolean;
  } | null;
};

export type Resultado<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; codigoError?: string };

// ============================================================
// Helpers internos
// ============================================================

function parse<T>(jsonResp: string, op: string): Resultado<T> {
  try {
    const r = JSON.parse(jsonResp);
    if (r && r.ok) return { ok: true, data: r as T };
    return {
      ok: false,
      error: r?.error ?? `${op} falló`,
      codigoError: r?.codigoError,
    };
  } catch (e) {
    return {
      ok: false,
      error: `Respuesta no parseable de ${op}: ${(e as Error).message}`,
    };
  }
}

function noBridge<T>(): Resultado<T> {
  return { ok: false, error: "Bridge nativo no disponible (web normal)" };
}

// ============================================================
// API pública
// ============================================================

export function listarImpresorasBluetooth(): Resultado<{
  dispositivos: ImpresoraBluetooth[];
}> {
  if (!posDisponible()) return noBridge();
  return parse(window.POS!.listarImpresorasBluetooth(), "listarImpresorasBluetooth");
}

export function seleccionarImpresoraBluetooth(
  mac: string,
): Resultado<Record<string, never>> {
  if (!posDisponible()) return noBridge();
  return parse(
    window.POS!.seleccionarImpresoraBluetooth(JSON.stringify({ mac })),
    "seleccionarImpresoraBluetooth",
  );
}

export function listarDispositivosUsb(): Resultado<{
  dispositivos: DispositivoUsb[];
}> {
  if (!posDisponible()) return noBridge();
  return parse(window.POS!.listarDispositivosUsb(), "listarDispositivosUsb");
}

export function seleccionarImpresoraUsb(
  vendorId: number,
  productId: number,
): Resultado<Record<string, never>> {
  if (!posDisponible()) return noBridge();
  return parse(
    window.POS!.seleccionarImpresoraUsb(JSON.stringify({ vendorId, productId })),
    "seleccionarImpresoraUsb",
  );
}

export function getEstado(): Resultado<EstadoPos> {
  if (!posDisponible()) return noBridge();
  return parse(window.POS!.estado(), "estado");
}

export function vaciarCacheImagenes(): Resultado<Record<string, never>> {
  if (!posDisponible()) return noBridge();
  return parse(window.POS!.vaciarCacheImagenes(), "vaciarCacheImagenes");
}

/** Estadísticas acumuladas del cache nativo de imágenes (persistidas). */
export type EstadisticasCacheImagenes = {
  hits: number;
  misses: number;
  bytesEvitados: number;
  archivosEnCache: number;
  bytesEnDisco: number;
};

/**
 * Poda granular: borra del cache nativo todas las entradas cuyo path
 * canónico no esté en `pathsVigentes`. Idempotente.
 *
 * `pathsVigentes` deben ser paths canónicos de Storage tal como los
 * produce `canonicalStoragePath` (`shared/src/storageUrl.ts`):
 * `bucket/o/<encodedPath>`. Pasarle URLs completas no funcionará — el
 * cache nativo indexa por path canónico, no por URL.
 *
 * Salvaguarda: si `pathsVigentes` está vacío el bridge nativo aborta sin
 * borrar nada (evita borrar todo durante el primer arranque antes de que
 * la web haya cargado el catálogo).
 */
export function podarCacheImagenes(
  pathsVigentes: string[],
): Resultado<{ eliminadas: number }> {
  if (!posDisponible()) return noBridge();
  if (typeof window.POS!.podarCacheImagenes !== "function") {
    return { ok: false, error: "podarCacheImagenes no soportado por este APK" };
  }
  return parse(
    window.POS!.podarCacheImagenes(JSON.stringify({ pathsVigentes })),
    "podarCacheImagenes",
  );
}

/** Snapshot puntual de las estadísticas del cache nativo. */
export function estadisticasCacheImagenes(): Resultado<EstadisticasCacheImagenes> {
  if (!posDisponible()) return noBridge();
  if (typeof window.POS!.estadisticasCacheImagenes !== "function") {
    return {
      ok: false,
      error: "estadisticasCacheImagenes no soportado por este APK",
    };
  }
  return parse<EstadisticasCacheImagenes>(
    window.POS!.estadisticasCacheImagenes(),
    "estadisticasCacheImagenes",
  );
}

/** Cierra la activity del APK. En navegador normal, retorna error. */
export function cerrarApp(): Resultado<Record<string, never>> {
  if (!posDisponible()) return noBridge();
  if (typeof window.POS!.cerrarApp !== "function") {
    return { ok: false, error: "cerrarApp no soportado por este APK" };
  }
  return parse(window.POS!.cerrarApp(), "cerrarApp");
}

/** Diagnóstico crudo del teclado/IME. Útil para imprimir desde la consola
 *  o desde un panel de ajustes en tablets donde la franja negra aparece
 *  aunque haya teclado USB conectado. */
export type DebugTeclado = {
  keyboard: number;
  hardKeyboardHidden: number;
  keyboardHidden: number;
  tieneTecladoFisico: boolean;
  manufacturer: string;
  model: string;
  sdkInt: number;
};

export function debugTeclado(): Resultado<DebugTeclado> {
  if (!posDisponible()) return noBridge();
  if (typeof window.POS!.debugTeclado !== "function") {
    return { ok: false, error: "debugTeclado no soportado por este APK" };
  }
  return parse<DebugTeclado>(window.POS!.debugTeclado(), "debugTeclado");
}

if (typeof window !== "undefined") {
  window.__debugTeclado = debugTeclado;
}

/** Snapshot puntual: ¿hay teclado físico conectado? Para reactividad
 *  ante plug/unplug, usa `suscribirTecladoFisicoCambio` o el hook
 *  `useTecladoFisico`. */
export function tieneTecladoFisico(): boolean {
  if (!posDisponible()) return false;
  if (typeof window.POS!.tieneTecladoFisico !== "function") return false;
  const r = parse<{ tiene?: boolean }>(
    window.POS!.tieneTecladoFisico(),
    "tieneTecladoFisico",
  );
  return r.ok && !!r.data.tiene;
}

// ============================================================
// Suscripción a cambios de teclado físico (plug/unplug en caliente).
// El APK invoca `__posDispatch("onTecladoFisicoCambio", {tiene})` desde
// `MainActivity.onConfigurationChanged`.
// ============================================================

type TecladoFisicoListener = (tiene: boolean) => void;
const tecladoFisicoListeners = new Set<TecladoFisicoListener>();

export function suscribirTecladoFisicoCambio(
  listener: TecladoFisicoListener,
): () => void {
  tecladoFisicoListeners.add(listener);
  return () => {
    tecladoFisicoListeners.delete(listener);
  };
}

// ============================================================
// Async — patrón requestId + evento.
// ============================================================

const pendientes = new Map<string, (r: Resultado<unknown>) => void>();

if (typeof window !== "undefined") {
  window.__posDispatch = (evento, payload) => {
    if (
      evento === "onPrintResult"
      || evento === "onFotoResult"
    ) {
      const p = payload as { requestId?: string; ok?: boolean; error?: string };
      const cb = p.requestId ? pendientes.get(p.requestId) : undefined;
      if (cb && p.requestId) {
        pendientes.delete(p.requestId);
        cb(p.ok ? { ok: true, data: payload } : { ok: false, error: p.error ?? "error" });
      }
    } else if (evento === "onTecladoFisicoCambio") {
      const p = payload as { tiene?: boolean };
      const tiene = !!p.tiene;
      for (const l of tecladoFisicoListeners) {
        try {
          l(tiene);
        } catch (e) {
          console.error("tecladoFisicoListener error:", e);
        }
      }
    }
  };
}

function llamarAsync<T>(
  fn: (json: string) => string,
  input: unknown,
  op: string,
): Promise<Resultado<T>> {
  return new Promise((resolve) => {
    if (!posDisponible()) {
      resolve(noBridge());
      return;
    }
    const respSync = parse<{ requestId: string }>(
      fn(JSON.stringify(input ?? {})),
      op,
    );
    if (!respSync.ok) {
      resolve(respSync);
      return;
    }
    const requestId = respSync.data.requestId;
    pendientes.set(requestId, (final) => resolve(final as Resultado<T>));
    // Safety net — si el bridge no responde en 30s, timeout.
    setTimeout(() => {
      if (pendientes.has(requestId)) {
        pendientes.delete(requestId);
        resolve({ ok: false, error: "TIMEOUT", codigoError: "TIMEOUT" });
      }
    }, 30_000);
  });
}

export type ImprimirTicketInput = {
  formato: string; // ESC/POS pre-armado por la web (con [L] [C] [R] \n)
  abrirCajon?: boolean;
};

export function imprimirTicket(input: ImprimirTicketInput) {
  return llamarAsync<unknown>(
    (j) => window.POS!.imprimirTicket(j),
    input,
    "imprimirTicket",
  );
}

export type ImprimirEtiquetaInput = {
  tspl: string;
  copias?: number;
};

export function imprimirEtiqueta(input: ImprimirEtiquetaInput) {
  return llamarAsync<unknown>(
    (j) => window.POS!.imprimirEtiqueta(j),
    input,
    "imprimirEtiqueta",
  );
}

export function abrirCajon() {
  return llamarAsync<unknown>(
    () => window.POS!.abrirCajon(),
    {},
    "abrirCajon",
  );
}

export type TomarFotoInput = {
  facing?: "front" | "back";
  maxLado?: number;
  calidad?: number;
  formato?: "jpeg" | "webp";
};

export type FotoResult = {
  dataUrl: string;
  ancho: number;
  alto: number;
  bytes: number;
  timestamp: number;
};

export function tomarFoto(input: TomarFotoInput = {}) {
  return llamarAsync<{ foto: FotoResult }>(
    (j) => window.POS!.tomarFoto(j),
    input,
    "tomarFoto",
  );
}
