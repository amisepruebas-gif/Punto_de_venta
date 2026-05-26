/**
 * Limpia el caché de renderizado del nodo-web: desregistra Service Worker(s)
 * y borra los caches `workbox*` (HTML/JS/CSS precacheados). NO toca el
 * caché de imágenes (`img-static`) ni el cache nativo de la APK.
 *
 * Tras invocar `limpiarRender()`, el caller decide si recarga la página
 * para tomar el bundle nuevo. Helper `recargarConCacheBust()` hace exactly
 * eso: agrega `?_t=<timestamp>` y hace `location.replace`.
 *
 * Compartido entre:
 *   - El modal "Recargar app" de Ajustes (AppCard).
 *   - El hook `useRefrescoRender` que escucha la señal remota disparada
 *     por admin-web desde `NodosPage`.
 */
export async function limpiarRender(): Promise<void> {
  if ("serviceWorker" in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
  }
  if (typeof caches !== "undefined") {
    const keys = await caches.keys();
    // Solo workbox-precache* (HTML/JS/CSS). NO `img-static` (eso es
    // responsabilidad de la opción "Imágenes" del modal de ajustes).
    await Promise.all(
      keys
        .filter((k) => k.startsWith("workbox"))
        .map((k) => caches.delete(k).catch(() => false)),
    );
  }
}

/** Recarga la página agregando `?_t=<timestamp>` para evitar HTTP cache. */
export function recargarConCacheBust(): void {
  const url = new URL(window.location.href);
  url.searchParams.set("_t", String(Date.now()));
  window.location.replace(url.toString());
}
