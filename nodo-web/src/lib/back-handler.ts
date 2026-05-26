import { useEffect } from "react";

/**
 * Stack-based registry para manejar el "back" físico/gesto del Android.
 *
 * Convención:
 *   - Cada handler devuelve `true` si CONSUMIÓ el evento (cerró un modal,
 *     navegó, etc.) y `false` si no aplica.
 *   - El stack se itera de top a bottom: el último handler registrado tiene
 *     prioridad (típicamente porque es el modal más recientemente abierto).
 *   - Si ningún handler consume, se hace `window.history.back()` por default
 *     (que en una SPA con React Router navega a la página anterior).
 *
 * El APK Android invoca `window.__handleAndroidBack()` desde su
 * `OnBackPressedCallback`. La función devuelve `"true"` si la web se hizo
 * cargo, `"false"` si la app debería responder con su default (cerrar app).
 *
 * En navegador normal, no se invoca y los handlers no se ejecutan — el
 * back del navegador hace su trabajo nativo.
 */

type BackHandler = () => boolean;
const stack: BackHandler[] = [];

declare global {
  interface Window {
    __handleAndroidBack?: () => boolean;
  }
}

if (typeof window !== "undefined") {
  window.__handleAndroidBack = () => {
    // Top → bottom; primer handler que diga `true` consume.
    for (let i = stack.length - 1; i >= 0; i--) {
      try {
        if (stack[i]()) return true;
      } catch (e) {
        console.error("back-handler error:", e);
      }
    }
    // Sin handlers que consuman — navegar atrás si hay historial.
    if (window.history.length > 1) {
      window.history.back();
      return true;
    }
    // En la raíz sin nada que cerrar: avisamos al APK que no consumimos
    // para que decida (puede cerrar la app si quiere).
    return false;
  };
}

export function pushBackHandler(handler: BackHandler): () => void {
  stack.push(handler);
  return () => {
    const i = stack.indexOf(handler);
    if (i >= 0) stack.splice(i, 1);
  };
}

/**
 * Hook para registrar un handler de back. El handler se desregistra al
 * desmontar. Importante: el array de deps controla cuándo se RE-registra
 * (si tu handler depende de state, asegúrate de incluirlo en deps).
 */
export function useBackHandler(
  handler: BackHandler,
  deps: React.DependencyList,
) {
  useEffect(() => {
    return pushBackHandler(handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
