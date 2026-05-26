import { useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/config";
import {
  COL_NEGOCIOS,
  COL_DATOS,
  DOC_REFRESCO_RENDER,
} from "@shared";
import { limpiarRender, recargarConCacheBust } from "@/lib/limpiarRender";
import { useNodoSession } from "@/hooks/useNodoSession";

const LS_KEY = "amise_nodo_refresco_render_huella";

/**
 * Escucha el doc remoto `negocios/{nid}/datos/refrescoRender` y, cuando
 * detecta que la `huella` cambió respecto a la última vista, dispara
 * `limpiarRender()` + `recargarConCacheBust()`.
 *
 * Mecanismo:
 *   - Admin-web bumpea el doc desde NodosPage al click "Forzar recarga".
 *   - Cada nodo guarda en localStorage la última huella vista.
 *   - Primer load (no hay huella en LS): persiste sin recargar para
 *     evitar un loop infinito o un refresh espurio cuando una tablet
 *     entra fresca al sistema.
 *   - Cambio detectado: limpia SW + workbox + reload con cache-bust.
 *
 * Se monta a nivel de App, así está activo desde que el usuario tiene
 * sesión (negocioId) en adelante.
 */
export function useRefrescoRender(): void {
  const { negocioId } = useNodoSession();

  useEffect(() => {
    if (!negocioId) return;
    const ref = doc(
      db,
      `${COL_NEGOCIOS}/${negocioId}/${COL_DATOS}/${DOC_REFRESCO_RENDER}`,
    );
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as { huella?: string };
        const huellaRemota = data.huella;
        if (!huellaRemota) return;

        const huellaLocal = localStorage.getItem(LS_KEY);

        if (huellaLocal === null) {
          // Primer load: persiste sin recargar. Evita refresh espurio
          // cuando una tablet nueva ve la huella por primera vez.
          localStorage.setItem(LS_KEY, huellaRemota);
          return;
        }

        if (huellaLocal !== huellaRemota) {
          // Persistir ANTES de recargar — si recargas y la persistencia
          // no quedó, el siguiente arranque vería la misma huella vieja
          // y entraría en loop.
          localStorage.setItem(LS_KEY, huellaRemota);
          // Disparar limpieza + reload sin bloquear el listener.
          (async () => {
            try {
              await limpiarRender();
            } catch (e) {
              console.warn("[refrescoRender] limpiarRender fallo:", e);
            }
            recargarConCacheBust();
          })();
        }
      },
      (err) => {
        console.warn("[refrescoRender] onSnapshot error:", err);
      },
    );
    return unsub;
  }, [negocioId]);
}
