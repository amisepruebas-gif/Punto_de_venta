import { useEffect, useState } from "react";
import { onIdTokenChanged, type User } from "firebase/auth";
import { auth } from "../firebase/config";

export type AuthUser = {
  user: User;
  claims: {
    role?: "superadmin" | "admin" | "vendedor" | "nodo";
    negocioId?: string;
    sucursalId?: string;
    nodoId?: string;
  };
};

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // FIX F7: usamos `onIdTokenChanged` (no `onAuthStateChanged`). El primero
    // fire en (a) login/logout AND (b) token refresh. El segundo solo en (a).
    // Esto importa porque la Fase F7 hace Google sign-in + CF que setea
    // claims server-side + `getIdToken(true)` para refresh. Con
    // onAuthStateChanged el cliente NO se enteraba del nuevo `role:"admin"`
    // hasta expiración natural (1 h) — efectivamente bloqueaba el login
    // por Google.
    const unsub = onIdTokenChanged(auth, async (u) => {
      if (!u) {
        setUser(null);
        setLoading(false);
        return;
      }
      const tokenResult = await u.getIdTokenResult();
      setUser({
        user: u,
        claims: {
          role: tokenResult.claims.role as AuthUser["claims"]["role"],
          negocioId: tokenResult.claims.negocioId as string | undefined,
          sucursalId: tokenResult.claims.sucursalId as string | undefined,
          nodoId: tokenResult.claims.nodoId as string | undefined,
        },
      });
      setLoading(false);
    });
    return unsub;
  }, []);

  return { user, loading };
}
