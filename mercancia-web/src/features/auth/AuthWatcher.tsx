import { useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/config";
import { logout, useSession } from "@/hooks/useSession";
import { paths, type UsuarioMercancia } from "@shared";

/**
 * Componente sin UI que vigila en tiempo real el doc del usuario logueado.
 * Mientras haya `binding + auth`, se suscribe al doc en
 * `usuariosMercancia_web_new_version`. Si:
 *
 *   - el doc se borra, o
 *   - `habilitado` pasa a `false`,
 *
 * llama a `logout()` automáticamente. La sesión queda limpia y `App.tsx`
 * redirige a `/login` por su Protected guard. El binding (sucursal) se
 * preserva — el usuario solo sale de su sesión, no del dispositivo.
 *
 * **Caveat con reglas abiertas (Fase 3B en `docs/13-rules-pendientes-`
 * `produccion.md`)**: este listener cubre la sesión legítima en navegador
 * legítimo. Si alguien con el PIN robado usa el SDK de Firestore desde
 * fuera de la app, se salta la verificación. La defensa real es la CF
 * `loginMercanciaConPin` + claims que se aplica al cerrar reglas.
 *
 * **Caveat de race**: si el operador hace tap en "Guardar" en el mismo
 * frame en que el admin lo deshabilita, la escritura puede colarse antes
 * de que el listener gatille. Daño máximo = una edición. Aceptable mientras
 * reglas estén abiertas.
 */
export function AuthWatcher() {
  const { binding, auth } = useSession();

  useEffect(() => {
    if (!binding || !auth) return;
    const ref = doc(
      db,
      paths.usuarioMercancia(
        binding.negocioId,
        binding.sucursalId,
        auth.usuarioId,
      ),
    );
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          logout();
          return;
        }
        const data = snap.data() as UsuarioMercancia;
        if (!data.habilitado) {
          logout();
        }
      },
      (err) => {
        // Errores de red: NO desloguear (esperar reconexión). Sólo log.
        console.warn("AuthWatcher snapshot error:", err);
      },
    );
    return unsub;
  }, [binding?.negocioId, binding?.sucursalId, auth?.usuarioId]);

  return null;
}
