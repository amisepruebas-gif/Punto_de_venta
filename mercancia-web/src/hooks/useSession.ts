import { useEffect, useState } from "react";

/**
 * Sesión local de mercancia-web. Persiste en `localStorage`. Dos partes:
 *
 *  - `binding` (negocioId + sucursalId): se elige una vez en FirstRun y
 *    sobrevive a logouts. Reseteable desde el botón "Cambiar sucursal".
 *  - `auth` (usuarioId + nombre): se establece tras login PIN exitoso. Se
 *    limpia en logout.
 */

const KEY_BINDING = "mercancia.binding.v1";
const KEY_AUTH = "mercancia.auth.v1";

export type Binding = {
  negocioId: string;
  negocioNombre: string;
  sucursalId: string;
  sucursalNombre: string;
};

export type AuthSession = {
  usuarioId: string;
  nombre: string;
  /** ms epoch del login. */
  ts: number;
};

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage bloqueado (modo incógnito) — la app no persiste pero corre.
  }
}

export function getBinding(): Binding | null {
  return readJson<Binding>(KEY_BINDING);
}

export function setBinding(b: Binding | null) {
  writeJson(KEY_BINDING, b);
  window.dispatchEvent(new Event("mercancia-session-change"));
}

export function getAuth(): AuthSession | null {
  return readJson<AuthSession>(KEY_AUTH);
}

export function setAuth(a: AuthSession | null) {
  writeJson(KEY_AUTH, a);
  window.dispatchEvent(new Event("mercancia-session-change"));
}

export function logout() {
  setAuth(null);
}

/**
 * Hook reactivo. Re-render cuando cambia binding o auth (via custom event
 * o storage event entre pestañas).
 */
export function useSession() {
  const [binding, setB] = useState<Binding | null>(() => getBinding());
  const [auth, setA] = useState<AuthSession | null>(() => getAuth());

  useEffect(() => {
    function reload() {
      setB(getBinding());
      setA(getAuth());
    }
    window.addEventListener("mercancia-session-change", reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener("mercancia-session-change", reload);
      window.removeEventListener("storage", reload);
    };
  }, []);

  return { binding, auth };
}
